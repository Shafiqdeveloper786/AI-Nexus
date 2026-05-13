import { NextRequest } from "next/server";
import Groq from "groq-sdk";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { UserProfile } from "@/lib/models/UserProfile";
import { CREDITS } from "@/lib/credits";

export const runtime    = "nodejs";
export const maxDuration = 60;

/* ── Models ──────────────────────────────────────────────────────────────────
   VISION_PRIMARY   — Llama 4 Scout (best multimodal accuracy)
   VISION_FALLBACK  — Llama 3.2 Vision (auto-used if primary is unavailable)
   TEXT_MODEL       — Llama 3.3 70B (plain-text content)
   ─────────────────────────────────────────────────────────────────────────── */
const VISION_PRIMARY  = "meta-llama/llama-4-scout-17b-16e-instruct";
const VISION_FALLBACK = "llama-3.2-11b-vision-preview";
const TEXT_MODEL      = "llama-3.3-70b-versatile";

const MIN_TEXT_CHARS = 80;

const ANALYSIS_SYSTEM = `You are AI Nexus — an expert document and image analyst.

**Response guidelines:**
- Describe visual content precisely, then answer the user's question directly.
- For text documents: identify key information and answer directly.
- Use **bold headings** and bullet points. Be thorough but concise.

**STRICT RULE:** Do NOT generate fenced code blocks unless the user explicitly requests code. Document analysis must use pure Markdown text formatting only.`;

/* ── buildWorkerUrl ───────────────────────────────────────────────────────────
   Cross-platform pdfjs worker URL — fixes the 4-slash bug on Linux/Vercel.
   Unix:    /var/task/node_modules/... → file:///var/task/node_modules/...  (3 /)
   Windows: D:\path\node_modules\...  → file:///D:/path/node_modules/...   (3 /)
   ─────────────────────────────────────────────────────────────────────────── */
function buildWorkerUrl(workerAbsPath: string): string {
  /* On Unix the path already starts with /, so file:// + /path = file:///path */
  if (workerAbsPath.startsWith("/"))
    return `file://${workerAbsPath}`;
  /* On Windows normalise backslashes and add the extra / for the drive letter */
  return `file:///${workerAbsPath.replace(/\\/g, "/")}`;
}

/* ── renderPdfToImages ────────────────────────────────────────────────────────
   Renders the first `maxPages` PDF pages to base64 PNG strings using
   pdfjs-dist v5 + canvas (both are in serverExternalPackages — not bundled).
   Always returns [] on any error; caller must handle gracefully.
   ─────────────────────────────────────────────────────────────────────────── */
async function renderPdfToImages(pdfBuffer: Buffer, maxPages = 3): Promise<string[]> {
  const images: string[] = [];
  let   pdfDoc:  any     = null;

  try {
    const [pdfjs, canvasMod, path] = await Promise.all([
      import("pdfjs-dist/legacy/build/pdf.mjs" as string) as Promise<any>,
      import("canvas")                                    as Promise<any>,
      import("path")                                      as Promise<any>,
    ]);

    /* ── Cross-platform worker URL (the previous Linux bug fixed here) ── */
    const workerAbs = path.resolve(
      process.cwd(),
      "node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs"
    );
    pdfjs.GlobalWorkerOptions.workerSrc = buildWorkerUrl(workerAbs);
    console.log("[renderPdfToImages] workerSrc =", pdfjs.GlobalWorkerOptions.workerSrc);

    pdfDoc = await pdfjs.getDocument({
      data:            new Uint8Array(pdfBuffer),
      useSystemFonts:  true,
      disableFontFace: false,
      verbosity:       0,
    }).promise;

    const pages = Math.min(pdfDoc.numPages, maxPages);
    console.log("[renderPdfToImages] rendering %d / %d page(s)", pages, pdfDoc.numPages);

    for (let p = 1; p <= pages; p++) {
      const page     = await pdfDoc.getPage(p);
      const viewport = page.getViewport({ scale: 1.5 });
      const canvas   = canvasMod.createCanvas(
        Math.floor(viewport.width),
        Math.floor(viewport.height)
      );
      await page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;
      images.push(canvas.toBuffer("image/png").toString("base64"));
      page.cleanup();
    }

    console.log("[renderPdfToImages] produced %d image(s)", images.length);
  } catch (err) {
    /* Log the real error so it shows in server logs for debugging */
    console.error("[renderPdfToImages] FAILED:", err instanceof Error ? err.stack ?? err.message : err);
  } finally {
    await pdfDoc?.destroy().catch(() => {});
  }

  return images;
}

/* ── extractPdfText ──────────────────────────────────────────────────────────
   Extracts selectable text from a PDF. Returns "" on any failure.
   ─────────────────────────────────────────────────────────────────────────── */
async function extractPdfText(pdfBuffer: Buffer): Promise<string> {
  try {
    const { PDFParse } = await import("pdf-parse") as any;
    const result       = await new PDFParse({ data: pdfBuffer, verbosity: 0 }).getText();
    return (result.text ?? "").trim();
  } catch (err) {
    console.warn("[extractPdfText] failed:", err instanceof Error ? err.message : err);
    return "";
  }
}

/* ── callVision ───────────────────────────────────────────────────────────────
   Tries VISION_PRIMARY; if it fails tries VISION_FALLBACK.
   Returns null (instead of throwing) if both models are unavailable,
   so the caller can switch to a text-model path without crashing.
   ─────────────────────────────────────────────────────────────────────────── */
async function callVision(
  groq:      Groq,
  content:   any[],
  maxTokens  = 1500,
): Promise<any | null> {
  /* Try primary */
  try {
    const stream = await groq.chat.completions.create({
      model:      VISION_PRIMARY,
      messages:   [{ role: "user", content }],
      stream:     true,
      max_tokens: maxTokens,
    });
    console.log("[callVision] primary succeeded:", VISION_PRIMARY);
    return stream;
  } catch (primaryErr) {
    console.warn(
      "[callVision] primary failed (%s) → trying fallback",
      primaryErr instanceof Error ? primaryErr.message.slice(0, 80) : primaryErr
    );
  }

  /* Try fallback */
  try {
    const stream = await groq.chat.completions.create({
      model:      VISION_FALLBACK,
      messages:   [{ role: "user", content }],
      stream:     true,
      max_tokens: maxTokens,
    });
    console.log("[callVision] fallback succeeded:", VISION_FALLBACK);
    return stream;
  } catch (fallbackErr) {
    console.error(
      "[callVision] fallback ALSO failed:",
      fallbackErr instanceof Error ? fallbackErr.message.slice(0, 120) : fallbackErr
    );
    return null; // caller must handle this
  }
}

/* ── Request body ─────────────────────────────────────────────────────────── */
interface AnalyzeBody {
  question:    string;
  fileContent: string;   // base64
  fileType:    "image" | "text" | "pdf";
  fileName:    string;
  mimeType?:   string;
}

/* ════════════════════════════════════════════════════════════════════════════
   POST /api/analyze-file — Forced Multimodal Pipeline

   Every document type is processed through the Vision model where possible.

   PATH A — Image (.jpg / .png / .webp / .gif)
     callVision(image) → [primary → fallback → null]
     if null → apology token

   PATH B — PDF (any: text-based, scanned, mixed)
     Parallel: extractPdfText() + renderPdfToImages()
     ├─ pages rendered → callVision(pages + text context) → [primary → fallback]
     │     if vision returns null AND text available → TEXT_MODEL
     │     if vision returns null AND no text → apology token
     ├─ no pages + text available → TEXT_MODEL
     └─ nothing extracted → apology token

   PATH C — Text file (.txt / .md / .csv / .json)
     TEXT_MODEL with full content

   Credits: CREDITS.IMAGE (12) deducted after successful stream.
   ════════════════════════════════════════════════════════════════════════════ */
export async function POST(req: NextRequest) {
  /* ── 1. Auth ─────────────────────────────────────────────────────────── */
  const session = await auth();
  if (!session?.user?.email)
    return Response.json({ error: "Unauthorized" }, { status: 401 });

  const email = session.user.email;
  const name  = session.user.name ?? email.split("@")[0];

  /* ── 2. Parse body ───────────────────────────────────────────────────── */
  let body: AnalyzeBody;
  try   { body = await req.json(); }
  catch { return Response.json({ error: "Invalid JSON body" }, { status: 400 }); }

  const { question, fileContent, fileType, fileName, mimeType } = body;
  if (!fileContent)
    return Response.json({ error: "fileContent is required" }, { status: 400 });

  const groqKey = process.env.GROQ_API_KEY;
  if (!groqKey)
    return Response.json({ error: "GROQ_API_KEY not configured" }, { status: 503 });

  /* ── 3. DB + credit pre-check ────────────────────────────────────────── */
  try { await connectDB(); } catch (err) {
    return Response.json(
      { error: "DB_CONNECTION_FAILED", message: err instanceof Error ? err.message : String(err) },
      { status: 503 }
    );
  }

  let profile: any;
  try {
    profile = await (UserProfile as any).findOrCreate(email, name);
  } catch (err) {
    return Response.json(
      { error: "PROFILE_FETCH_FAILED", message: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }

  if (profile.subscription === "free" && profile.credits < CREDITS.IMAGE) {
    return Response.json(
      {
        error:    "NO_CREDITS",
        message:  `Document analysis costs ${CREDITS.IMAGE} credits. You have ${profile.credits} remaining.`,
        required: CREDITS.IMAGE,
        current:  profile.credits,
      },
      { status: 403 }
    );
  }

  /* ── 4. Stream setup ─────────────────────────────────────────────────── */
  const groq    = new Groq({ apiKey: groqKey });
  const userQ   = question?.trim() || "Analyse this content and summarise the key points.";
  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
  const writer  = writable.getWriter();
  const encoder = new TextEncoder();

  /* helper: write a string token then end stream */
  const writeAndClose = async (text: string) => {
    await writer.write(encoder.encode(text));
    await writer.close().catch(() => {});
  };

  /* ── 5. Async pipeline ───────────────────────────────────────────────── */
  (async () => {
    let analysisSucceeded = false;

    try {
      /* ────────────────────────────────────────────────────────────────────
         PATH A: Image file → Vision (primary → fallback → null)
         ──────────────────────────────────────────────────────────────────── */
      if (fileType === "image") {
        console.log("[analyze-file] PATH A — image:", fileName, mimeType);

        const stream = await callVision(groq, [
          { type: "text",      text: userQ },
          {
            type:      "image_url",
            image_url: { url: `data:${mimeType ?? "image/jpeg"};base64,${fileContent}` },
          },
        ] as any[], 1024);

        if (!stream) {
          await writeAndClose(
            "I'm unable to analyze this image right now due to high server load. " +
            "Please try again in a moment."
          );
          return;
        }

        for await (const chunk of stream) {
          const text = chunk.choices[0]?.delta?.content ?? "";
          if (text) await writer.write(encoder.encode(text));
        }
        analysisSucceeded = true;

      /* ────────────────────────────────────────────────────────────────────
         PATH B: PDF — Forced Multimodal
                 Always run BOTH text extraction AND page rendering in
                 parallel. Always prefer visual analysis via Vision model.
         ──────────────────────────────────────────────────────────────────── */
      } else if (fileType === "pdf") {
        const pdfBuffer = Buffer.from(fileContent, "base64");

        /* Emit status immediately into the stable pre-created bubble */
        await writer.write(encoder.encode("🔍 **Analyzing document visual context…**\n\n"));

        /* Run both operations concurrently — never sequential */
        const [rawText, pageImages] = await Promise.all([
          extractPdfText(pdfBuffer),
          renderPdfToImages(pdfBuffer, 3),
        ]);

        const cleanLen = rawText.replace(/\s+/g, "").length;
        console.log(
          "[analyze-file] PATH B — file=%s  pages=%d  textChars=%d",
          fileName, pageImages.length, cleanLen
        );

        let stream: any | null = null;

        /* ── Sub-path B1: Pages rendered → Vision model ── */
        if (pageImages.length > 0) {
          /* Merge extracted text as additional context for the vision model */
          const textContext = cleanLen >= MIN_TEXT_CHARS
            ? `\n\n**Extracted text (additional context — prioritise the visual pages):**\n${rawText.slice(0, 5_000)}`
            : "";

          const visionContent: any[] = [
            {
              type: "text",
              text: (
                `You are analyzing a PDF document: "${fileName}"\n` +
                `${pageImages.length} page(s) are attached as images.` +
                textContext +
                `\n\n---\nUser question: ${userQ}`
              ),
            },
            ...pageImages.map((img) => ({
              type:      "image_url",
              image_url: { url: `data:image/png;base64,${img}` },
            })),
          ];

          stream = await callVision(groq, visionContent, 1500);

          /* Vision failed but we have text → fall through to text model */
          if (!stream && cleanLen >= MIN_TEXT_CHARS) {
            console.warn("[analyze-file] Vision returned null — falling back to text model");
          }
        }

        /* ── Sub-path B2: No pages OR vision returned null → Text model ── */
        if (!stream && cleanLen >= MIN_TEXT_CHARS) {
          console.log("[analyze-file] Sub-path B2 — text model with %d chars", cleanLen);
          stream = await groq.chat.completions.create({
            model:       TEXT_MODEL,
            messages:    [
              { role: "system", content: ANALYSIS_SYSTEM },
              {
                role:    "user",
                content: (
                  `**Document:** \`${fileName}\`\n\n` +
                  `**Content:**\n\n${rawText.slice(0, 14_000)}\n\n` +
                  `---\n**Question:** ${userQ}`
                ),
              },
            ],
            stream:      true,
            max_tokens:  1500,
            temperature: 0.4,
          });
        }

        /* ── Sub-path B3: Truly nothing extracted ── */
        if (!stream) {
          /* Do NOT show guidance messages — make one final vision attempt
             using only the prompt (the model may still be able to help) */
          console.warn("[analyze-file] Sub-path B3 — no pages, no text. Final vision attempt.");
          stream = await callVision(groq, [
            {
              type: "text",
              text: (
                `A PDF file named "${fileName}" was uploaded but its visual content could not ` +
                `be rendered at this time. Please let the user know politely that the document ` +
                `could not be fully processed and suggest they re-upload it or paste the text content. ` +
                `Answer their question as best you can: ${userQ}`
              ),
            },
          ] as any[], 400);
        }

        if (!stream) {
          await writeAndClose(
            "I'm experiencing high load and couldn't process this document right now. " +
            "Please try again in a moment."
          );
          return;
        }

        for await (const chunk of stream) {
          const text = chunk.choices[0]?.delta?.content ?? "";
          if (text) await writer.write(encoder.encode(text));
        }
        analysisSucceeded = true;

      /* ────────────────────────────────────────────────────────────────────
         PATH C: Plain text file (.txt / .md / .csv / .json) → text model
         ──────────────────────────────────────────────────────────────────── */
      } else {
        console.log("[analyze-file] PATH C — text file:", fileName);
        const rawText = Buffer.from(fileContent, "base64").toString("utf8");

        const stream = await groq.chat.completions.create({
          model:       TEXT_MODEL,
          messages:    [
            { role: "system", content: ANALYSIS_SYSTEM },
            {
              role:    "user",
              content: (
                `**File:** \`${fileName}\`\n\n` +
                `**Content:**\n\n${rawText.slice(0, 14_000)}\n\n` +
                `---\n**Question:** ${userQ}`
              ),
            },
          ],
          stream:      true,
          max_tokens:  1500,
          temperature: 0.4,
        });

        for await (const chunk of stream) {
          const text = chunk.choices[0]?.delta?.content ?? "";
          if (text) await writer.write(encoder.encode(text));
        }
        analysisSucceeded = true;
      }

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unexpected analysis error";
      console.error("[analyze-file] Unhandled error:", err instanceof Error ? err.stack : err);
      try {
        await writer.write(
          encoder.encode(`\n\n⚠️ **Analysis Error:** ${msg}\n\n_Please try again._`)
        );
      } catch { /* writer may already be closed */ }
    } finally {
      await writer.close().catch(() => {});

      /* ── Credit deduction — only on successful analysis ─────────────── */
      if (analysisSucceeded && profile.subscription === "free") {
        try {
          await UserProfile.updateOne({ email }, { $inc: { credits: -CREDITS.IMAGE } });
          console.log(
            "[analyze-file] Deducted %d credits from %s  remaining≈%d",
            CREDITS.IMAGE, email, profile.credits - CREDITS.IMAGE
          );
        } catch (saveErr) {
          console.error("[analyze-file] Credit deduction failed:", saveErr);
        }
      }
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
