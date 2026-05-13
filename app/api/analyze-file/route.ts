import { NextRequest } from "next/server";
import Groq from "groq-sdk";
import { auth } from "@/lib/auth";

export const runtime    = "nodejs";
export const maxDuration = 60;

/* ── Models ──────────────────────────────────────────────────────────────────
   VISION_PRIMARY   — Llama 4 Scout (multimodal, preferred)
   VISION_FALLBACK  — Llama 3.2 Vision (used if primary returns 503 / errors)
   TEXT_MODEL       — fast text analysis for text-based PDFs and documents
   ─────────────────────────────────────────────────────────────────────────── */
const VISION_PRIMARY  = "meta-llama/llama-4-scout-17b-16e-instruct";
const VISION_FALLBACK = "llama-3.2-11b-vision-preview";
const TEXT_MODEL      = "llama-3.3-70b-versatile";

/* Min extractable chars before we classify a PDF as "text-based" */
const MIN_TEXT_CHARS = 80;

const ANALYSIS_SYSTEM = `You are AI Nexus — an expert document and image analyst.

**Response guidelines:**
- For images / scanned documents: describe what you see precisely, then answer the question.
- For text documents: identify the key information and answer directly.
- Use **bold headings** and bullet points to structure your response clearly.
- Lead with the most important finding. Be thorough but concise.

**STRICT RULE — Code blocks:**
Do NOT generate any fenced code blocks (\`\`\`...\`\`\`) unless the user explicitly asks for code. Document analysis responses must be pure text with Markdown formatting only.`;

/* ── Try vision model with automatic fallback ────────────────────────────── */
async function callVision(
  groq: Groq,
  content: any[],
  maxTokens = 1500
): Promise<any> {
  try {
    return await groq.chat.completions.create({
      model:      VISION_PRIMARY,
      messages:   [{ role: "user", content }],
      stream:     true,
      max_tokens: maxTokens,
    });
  } catch (primaryErr: unknown) {
    const msg = primaryErr instanceof Error ? primaryErr.message : String(primaryErr);
    console.warn("[analyze-file] Vision primary failed (%s) — trying fallback", msg.slice(0, 60));
    return groq.chat.completions.create({
      model:      VISION_FALLBACK,
      messages:   [{ role: "user", content }],
      stream:     true,
      max_tokens: maxTokens,
    });
  }
}

/* ── PDF-to-PNG renderer (pdfjs-dist v5 + canvas) ───────────────────────────
   Returns an array of base64-encoded PNG strings, one per page rendered.
   Falls back to [] on any error so the caller can degrade gracefully.
   ─────────────────────────────────────────────────────────────────────────── */
async function renderPdfToImages(pdfBuffer: Buffer, maxPages = 3): Promise<string[]> {
  const images: string[] = [];
  let pdfDoc: any = null;

  try {
    /* Both imports are listed in serverExternalPackages so webpack won't bundle them */
    const [pdfjs, canvasMod, pathMod] = await Promise.all([
      import("pdfjs-dist/legacy/build/pdf.mjs" as string) as Promise<any>,
      import("canvas") as Promise<any>,
      import("path") as Promise<any>,
    ]);

    /* Build an absolute file:// URL for the pdfjs worker (required in v5) */
    const workerAbs = pathMod.resolve(
      "node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs"
    );
    pdfjs.GlobalWorkerOptions.workerSrc =
      new URL("file:///" + workerAbs.split(pathMod.sep).join("/")).href;

    pdfDoc = await pdfjs.getDocument({
      data:           new Uint8Array(pdfBuffer),
      useSystemFonts: true,
      disableFontFace: false,
      verbosity:       0,
    }).promise;

    const totalPages = Math.min(pdfDoc.numPages, maxPages);
    console.log(`[analyze-file] Rendering ${totalPages} page(s) from PDF`);

    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
      const page     = await pdfDoc.getPage(pageNum);
      const viewport = page.getViewport({ scale: 1.5 });
      const width    = Math.floor(viewport.width);
      const height   = Math.floor(viewport.height);

      const canvas   = canvasMod.createCanvas(width, height);
      const ctx      = canvas.getContext("2d");

      await page.render({ canvasContext: ctx, viewport }).promise;

      const buf = canvas.toBuffer("image/png");
      images.push(buf.toString("base64"));
      page.cleanup();
    }
  } catch (err) {
    console.error("[renderPdfToImages]", err instanceof Error ? err.message : err);
  } finally {
    await pdfDoc?.destroy().catch(() => {});
  }

  return images;
}

/* ── PDF text extractor (pdf-parse v2) ───────────────────────────────────── */
async function extractPdfText(pdfBuffer: Buffer): Promise<string> {
  try {
    const { PDFParse } = await import("pdf-parse") as any;
    const parser = new PDFParse({ data: pdfBuffer, verbosity: 0 });
    const result = await parser.getText();
    return (result.text ?? "").trim();
  } catch (err) {
    console.warn("[extractPdfText] failed:", err instanceof Error ? err.message : err);
    return "";
  }
}

/* ── Request body ─────────────────────────────────────────────────────────── */
interface AnalyzeBody {
  question:    string;
  fileContent: string;   // base64 for ALL file types
  fileType:    "image" | "text" | "pdf";
  fileName:    string;
  mimeType?:   string;
}

/* ── Route handler ────────────────────────────────────────────────────────── */
export async function POST(req: NextRequest) {
  /* Auth */
  const session = await auth();
  if (!session?.user?.email) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: AnalyzeBody;
  try { body = await req.json(); } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { question, fileContent, fileType, fileName, mimeType } = body;
  if (!fileContent) {
    return Response.json({ error: "fileContent is required" }, { status: 400 });
  }

  const groqKey = process.env.GROQ_API_KEY;
  if (!groqKey) {
    return Response.json({ error: "GROQ_API_KEY not configured" }, { status: 503 });
  }

  const groq   = new Groq({ apiKey: groqKey });
  const userQ  = question?.trim() || "Analyse this content and summarise the key points.";
  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
  const writer  = writable.getWriter();
  const encoder = new TextEncoder();

  /* ── Async processing ─────────────────────────────────────────────────── */
  (async () => {
    try {
      let stream: any;

      /* ────────────────────────────────────────────────────────────────────
         PATH A: Image file → vision model (primary → fallback)
         ──────────────────────────────────────────────────────────────────── */
      if (fileType === "image") {
        console.log("[analyze-file] Vision path — image file:", fileName);
        const dataUrl = `data:${mimeType ?? "image/jpeg"};base64,${fileContent}`;

        stream = await callVision(groq, [
          { type: "text",      text: userQ },
          { type: "image_url", image_url: { url: dataUrl } },
        ] as any[], 1024);

      /* ────────────────────────────────────────────────────────────────────
         PATH B: PDF — text extraction first, vision fallback for scanned PDFs
         ──────────────────────────────────────────────────────────────────── */
      } else if (fileType === "pdf") {
        const pdfBuffer  = Buffer.from(fileContent, "base64");

        /* Step 1 — try fast text extraction */
        const rawText    = await extractPdfText(pdfBuffer);
        const cleanLen   = rawText.replace(/\s+/g, "").length;
        const isTextBased = cleanLen >= MIN_TEXT_CHARS;

        console.log(
          "[analyze-file] PDF: cleanLen=%d isTextBased=%s  file=%s",
          cleanLen, isTextBased, fileName
        );

        if (isTextBased) {
          /* ── Text-based PDF → text model (fast) ── */
          const docContext =
            `**File:** \`${fileName}\`\n\n` +
            `**Extracted Text:**\n\n${rawText.slice(0, 14_000)}\n\n` +
            `---\n**Question:** ${userQ}`;

          stream = await groq.chat.completions.create({
            model: TEXT_MODEL,
            messages: [
              { role: "system", content: ANALYSIS_SYSTEM },
              { role: "user",   content: docContext },
            ],
            stream:      true,
            max_tokens:  1500,
            temperature: 0.4,
          });

        } else {
          /* ── Scanned/image PDF → render pages → vision model (primary → fallback) ── */
          await writer.write(encoder.encode(
            `🔍 **Analyzing document visual context…**\n\n`
          ));

          const pageImages = await renderPdfToImages(pdfBuffer, 3);

          if (pageImages.length > 0) {
            console.log("[analyze-file] Sending %d page image(s) to vision model", pageImages.length);

            const content: any[] = [
              {
                type: "text",
                text: `Analysing PDF document: "${fileName}" (${pageImages.length} page(s) rendered)\n\nQuestion: ${userQ}`,
              },
              ...pageImages.map((img) => ({
                type:      "image_url",
                image_url: { url: `data:image/png;base64,${img}` },
              })),
            ];

            stream = await callVision(groq, content, 1500);

          } else {
            /* Both text and render failed — helpful fallback */
            stream = await groq.chat.completions.create({
              model: TEXT_MODEL,
              messages: [
                { role: "system", content: ANALYSIS_SYSTEM },
                {
                  role: "user",
                  content:
                    `The uploaded file "${fileName}" appears to be a fully scanned/image-only PDF. ` +
                    `Text extraction returned ${cleanLen} usable characters, and page rendering failed. ` +
                    `Please respond to the user's question: "${userQ}" ` +
                    `by explaining that: (1) the PDF is likely scanned, (2) they can screenshot individual pages and upload as .jpg or .png for visual analysis, ` +
                    `(3) if they can copy any text from the PDF, pasting it directly in the chat will work best.`,
                },
              ],
              stream:      true,
              max_tokens:  400,
              temperature: 0.5,
            });
          }
        }

      /* ────────────────────────────────────────────────────────────────────
         PATH C: Plain text file (txt, md, csv, json…) → text model
         ──────────────────────────────────────────────────────────────────── */
      } else {
        const rawText    = Buffer.from(fileContent, "base64").toString("utf8");
        const docContext =
          `**File:** \`${fileName}\`\n\n` +
          `**Content:**\n\n${rawText.slice(0, 14_000)}\n\n` +
          `---\n**Question:** ${userQ}`;

        stream = await groq.chat.completions.create({
          model: TEXT_MODEL,
          messages: [
            { role: "system", content: ANALYSIS_SYSTEM },
            { role: "user",   content: docContext },
          ],
          stream:      true,
          max_tokens:  1500,
          temperature: 0.4,
        });
      }

      /* ── Stream response to client ──────────────────────────────────── */
      for await (const chunk of stream) {
        const text = chunk.choices[0]?.delta?.content ?? "";
        if (text) await writer.write(encoder.encode(text));
      }

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Analysis failed";
      console.error("[analyze-file] Error:", msg);
      await writer.write(encoder.encode(`\n\n⚠️ **Analysis Error:** ${msg}`));
    } finally {
      await writer.close().catch(() => {});
    }
  })();

  return new Response(readable, {
    headers: {
      "Content-Type":      "text/plain; charset=utf-8",
      "Cache-Control":     "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
