import { NextRequest } from "next/server";
import { createRequire } from "module";
import Groq from "groq-sdk";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { UserProfile } from "@/lib/models/UserProfile";
import { CREDITS } from "@/lib/credits";

export const runtime    = "nodejs";
export const maxDuration = 60;

/* ── Canvas — CJS require at module scope (avoids ESM async-import races) ── */
const _require = createRequire(import.meta.url);
const { createCanvas } = _require("canvas") as typeof import("canvas");

/* ── Model IDs ───────────────────────────────────────────────────────────── */
const VISION_MODEL = "llama-3.2-11b-vision-preview"; // ONLY source of truth for scanned PDFs
const TEXT_MODEL   = "llama-3.3-70b-versatile";      // for text-extractable documents

const MIN_TEXT_CHARS = 50; // below this → document is treated as scanned

/* ── pdfjs singleton ─────────────────────────────────────────────────────── */
let _pdfjs: any = null;

async function getPdfjs(): Promise<any> {
  if (_pdfjs) return _pdfjs;

  _pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs" as string) as any;

  /* Cross-platform worker URL:
     Unix  /abs/path → file:///abs/path   (file:// + leading-/ = 3 slashes)
     Win   D:\path   → file:///D:/path    (file:/// + normalised = 3 slashes) */
  const { resolve, sep } = await import("path");
  const abs  = resolve(process.cwd(), "node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs");
  const wUrl = abs.startsWith("/") ? `file://${abs}` : `file:///${abs.split(sep).join("/")}`;
  _pdfjs.GlobalWorkerOptions.workerSrc = wUrl;

  console.log("[pdfjs] workerSrc:", wUrl);
  return _pdfjs;
}

/* ── Analysis system prompt ──────────────────────────────────────────────── */
const SYSTEM = `You are AI Nexus — an expert document analyst.

Rules:
- Describe what you see precisely, then answer the user's question directly.
- Use **bold headings** and bullet points for clarity.
- STRICT: Do NOT generate code blocks unless the user explicitly asks for code.
- Answer ONLY from the document content. Never guess or hallucinate.`;

/* ════════════════════════════════════════════════════════════════════════════
   renderPdfToImages
   Returns base64 PNG strings, one per rendered page (up to maxPages).
   Returns [] if pdfjs/canvas throw — caller must treat this as a hard error
   for scanned PDFs, NOT as a prompt to guess from the filename.
   ════════════════════════════════════════════════════════════════════════════ */
async function renderPdfToImages(pdfBuffer: Buffer, maxPages = 3): Promise<string[]> {
  const images: string[] = [];
  let pdfDoc: any = null;

  try {
    const pdfjs = await getPdfjs();

    pdfDoc = await pdfjs.getDocument({
      data:            new Uint8Array(pdfBuffer),
      useSystemFonts:  true,
      disableFontFace: false,
      isEvalSupported: false,
      verbosity:       0,
    }).promise;

    const total = pdfDoc.numPages;
    const pages = Math.min(total, maxPages);
    console.log(`[renderPdfToImages] PDF has ${total} page(s) — rendering ${pages}`);

    for (let p = 1; p <= pages; p++) {
      const page     = await pdfDoc.getPage(p);
      const viewport = page.getViewport({ scale: 1.5 });
      const w        = Math.floor(viewport.width);
      const h        = Math.floor(viewport.height);
      const canvas   = createCanvas(w, h);
      const ctx      = canvas.getContext("2d");

      await page.render({ canvasContext: ctx, viewport }).promise;

      const b64 = canvas.toBuffer("image/png").toString("base64");
      images.push(b64);
      page.cleanup();
      console.log(`[renderPdfToImages] page ${p}: ${w}×${h}px  ${Math.round(b64.length * 0.75 / 1024)}KB`);
    }

    console.log(`[renderPdfToImages] SUCCESS — ${images.length} image(s) produced`);
  } catch (err) {
    /* Log the real stack trace — visible in Next.js terminal / Vercel logs */
    console.error(
      "[renderPdfToImages] RENDER FAILED:\n",
      err instanceof Error ? err.stack : String(err)
    );
  } finally {
    await pdfDoc?.destroy().catch(() => {});
  }

  return images;
}

/* ── extractPdfText ──────────────────────────────────────────────────────── */
async function extractPdfText(pdfBuffer: Buffer): Promise<string> {
  try {
    /* Handle both pdf-parse v1 (function) and v2 (class) APIs */
    const mod = _require("pdf-parse") as any;
    if (typeof mod === "function") {
      const result = await mod(pdfBuffer);
      return (result.text ?? "").trim();
    }
    const PDFParse = mod.PDFParse ?? mod.default?.PDFParse;
    if (PDFParse) {
      const result = await new PDFParse({ data: pdfBuffer, verbosity: 0 }).getText();
      return (result.text ?? "").trim();
    }
    return "";
  } catch (err) {
    console.warn("[extractPdfText] failed:", err instanceof Error ? err.message : err);
    return "";
  }
}

/* ── visionStream — ONLY real page images, never filename guesses ────────── */
async function visionStream(
  groq:      Groq,
  pageImages: string[],
  textCtx:    string,
  fileName:   string,
  userQ:      string,
  maxTokens   = 1500,
): Promise<any> {
  const prompt = [
    {
      type: "text",
      text: (
        `You are analysing a PDF document: "${fileName}"\n` +
        `${pageImages.length} page(s) are attached as PNG images.\n` +
        (textCtx ? `\nExtracted searchable text (use as additional context):\n${textCtx}\n` : "") +
        `\n---\nUser question: ${userQ}\n\n` +
        `IMPORTANT: Answer ONLY based on the visual content of the attached pages. ` +
        `Do not guess or use the filename as a source of information.`
      ),
    },
    ...pageImages.map((img) => ({
      type:      "image_url",
      image_url: { url: `data:image/png;base64,${img}` },
    })),
  ];

  /* Try vision model — hard failure if Groq is down */
  return groq.chat.completions.create({
    model:      VISION_MODEL,
    messages:   [{ role: "user", content: prompt as any }],
    stream:     true,
    max_tokens: maxTokens,
  });
}

/* ── textStream ──────────────────────────────────────────────────────────── */
async function textStream(
  groq:    Groq,
  content: string,
): Promise<any> {
  return groq.chat.completions.create({
    model:       TEXT_MODEL,
    messages:    [
      { role: "system", content: SYSTEM },
      { role: "user",   content },
    ],
    stream:      true,
    max_tokens:  1500,
    temperature: 0.35,
  });
}

/* ── pipe ────────────────────────────────────────────────────────────────── */
async function pipe(
  stream:  any,
  writer:  WritableStreamDefaultWriter<Uint8Array>,
  encoder: TextEncoder,
): Promise<void> {
  for await (const chunk of stream) {
    const t = chunk.choices[0]?.delta?.content ?? "";
    if (t) await writer.write(encoder.encode(t));
  }
}

/* ── Request body ─────────────────────────────────────────────────────────── */
interface AnalyzeBody {
  question:    string;
  fileContent: string;
  fileType:    "image" | "text" | "pdf";
  fileName:    string;
  mimeType?:   string;
}

/* ════════════════════════════════════════════════════════════════════════════
   POST /api/analyze-file

   Strict Vision-OCR Pipeline — NO GUESSING

   ┌─ IMAGE ──────────────────────────────────────────────────────────────────┐
   │  → visionStream(image)                                                   │
   │  → throws if Groq is down → "Vision Analysis Failed" streamed            │
   └──────────────────────────────────────────────────────────────────────────┘
   ┌─ PDF ────────────────────────────────────────────────────────────────────┐
   │  Run in parallel: renderPdfToImages() + extractPdfText()                 │
   │                                                                          │
   │  pages > 0                                                               │
   │    → visionStream(pages, textCtx)   ← REAL visual analysis              │
   │    → throws → "Vision Analysis Failed - Check Groq API Key/Quota"       │
   │                                                                          │
   │  pages == 0 + text ≥ MIN_TEXT_CHARS                                      │
   │    → textStream(extracted text)     ← text-based PDF, works fine        │
   │                                                                          │
   │  pages == 0 + text < MIN_TEXT_CHARS                                      │
   │    → HARD ERROR: "Vision Analysis Failed — PDF page rendering failed.   │
   │       Upload a page screenshot as a .jpg for visual analysis."          │
   │    NO GUESSING. NO FILENAME INFERENCE. PERIOD.                           │
   └──────────────────────────────────────────────────────────────────────────┘
   ┌─ TEXT FILE ──────────────────────────────────────────────────────────────┐
   │  → textStream(file content)                                              │
   └──────────────────────────────────────────────────────────────────────────┘

   Credits: CREDITS.IMAGE (12) deducted only on successful stream completion.
   ════════════════════════════════════════════════════════════════════════════ */
export async function POST(req: NextRequest) {
  /* 1. Auth */
  const session = await auth();
  if (!session?.user?.email)
    return Response.json({ error: "Unauthorized" }, { status: 401 });

  const email = session.user.email;
  const name  = session.user.name ?? email.split("@")[0];

  /* 2. Body */
  let body: AnalyzeBody;
  try { body = await req.json(); }
  catch { return Response.json({ error: "Invalid JSON body" }, { status: 400 }); }

  const { question, fileContent, fileType, fileName, mimeType } = body;
  if (!fileContent)
    return Response.json({ error: "fileContent is required" }, { status: 400 });

  const groqKey = process.env.GROQ_API_KEY;
  if (!groqKey)
    return Response.json({ error: "GROQ_API_KEY not configured" }, { status: 503 });

  /* 3. DB + credit check */
  try { await connectDB(); }
  catch (e) {
    return Response.json({ error: "DB_CONNECTION_FAILED", message: String(e) }, { status: 503 });
  }

  let profile: any;
  try { profile = await (UserProfile as any).findOrCreate(email, name); }
  catch (e) {
    return Response.json({ error: "PROFILE_FETCH_FAILED", message: String(e) }, { status: 500 });
  }

  if (profile.subscription === "free" && profile.credits < CREDITS.IMAGE)
    return Response.json({
      error:    "NO_CREDITS",
      message:  `Document analysis costs ${CREDITS.IMAGE} credits. You have ${profile.credits} remaining.`,
      required: CREDITS.IMAGE,
      current:  profile.credits,
    }, { status: 403 });

  /* 4. Stream setup */
  const groq    = new Groq({ apiKey: groqKey });
  const userQ   = question?.trim() || "Analyse this document and summarise the key information.";
  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
  const writer  = writable.getWriter();
  const encoder = new TextEncoder();

  const writeStr = (s: string) => writer.write(encoder.encode(s));

  /* 5. Pipeline */
  (async () => {
    let succeeded = false;

    try {
      /* ── IMAGE ──────────────────────────────────────────────────── */
      if (fileType === "image") {
        console.log("[analyze-file] IMAGE path →", fileName, mimeType);
        const dataUrl = `data:${mimeType ?? "image/jpeg"};base64,${fileContent}`;

        let stream: any;
        try {
          stream = await visionStream(groq, [], "", "", userQ, 1024);
          /* Rebuild for image: override the content directly */
          stream = await groq.chat.completions.create({
            model:      VISION_MODEL,
            messages:   [{
              role:    "user",
              content: [
                { type: "text",      text: userQ },
                { type: "image_url", image_url: { url: dataUrl } },
              ] as any,
            }],
            stream:     true,
            max_tokens: 1024,
          });
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error("[analyze-file] Vision API error:", msg);
          await writeStr(
            `⚠️ **Vision Analysis Failed** — Check your Groq API key/quota.\n\n` +
            `_Error: ${msg}_`
          );
          return;
        }

        await pipe(stream, writer, encoder);
        succeeded = true;

      /* ── PDF ────────────────────────────────────────────────────── */
      } else if (fileType === "pdf") {
        const pdfBuffer = Buffer.from(fileContent, "base64");

        /* Emit status token — renders inside pre-created stable bubble */
        await writeStr("🔍 **Analyzing document visual context…**\n\n");

        /* Render pages and extract text IN PARALLEL */
        console.log("[analyze-file] PDF: starting parallel render + text extraction");
        const [pageImages, rawText] = await Promise.all([
          renderPdfToImages(pdfBuffer, 3),
          extractPdfText(pdfBuffer),
        ]);

        const cleanLen = rawText.replace(/\s+/g, "").length;
        console.log(
          "[analyze-file] PDF result — pages=%d  textChars=%d  file=%s",
          pageImages.length, cleanLen, fileName
        );

        /* ── Case 1: Pages rendered → REAL vision analysis ── */
        if (pageImages.length > 0) {
          console.log("[analyze-file] Sending %d page(s) to Vision model", pageImages.length);
          const textCtx = cleanLen >= MIN_TEXT_CHARS
            ? rawText.slice(0, 5_000)
            : "";

          let stream: any;
          try {
            stream = await visionStream(groq, pageImages, textCtx, fileName, userQ, 1500);
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            console.error("[analyze-file] Vision API error after rendering:", msg);
            await writeStr(
              `⚠️ **Vision Analysis Failed** — Check your Groq API key/quota.\n\n` +
              `PDF pages were rendered successfully (${pageImages.length} page(s)) ` +
              `but the Vision model returned an error:\n\n_${msg}_`
            );
            return;
          }

          await pipe(stream, writer, encoder);
          succeeded = true;

        /* ── Case 2: No pages rendered + usable text ── */
        } else if (cleanLen >= MIN_TEXT_CHARS) {
          console.log("[analyze-file] No pages rendered — using extracted text (%d chars)", cleanLen);
          const content =
            `**File:** \`${fileName}\`\n\n` +
            `**Extracted Text:**\n\n${rawText.slice(0, 14_000)}\n\n` +
            `---\n**Question:** ${userQ}`;

          let stream: any;
          try {
            stream = await textStream(groq, content);
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            await writeStr(`⚠️ **Analysis Failed** — Groq API error: ${msg}`);
            return;
          }

          await pipe(stream, writer, encoder);
          succeeded = true;

        /* ── Case 3: No pages + no text — HARD ERROR, NO GUESSING ── */
        } else {
          console.error(
            "[analyze-file] RENDER FAILURE — pages=0, textChars=%d  file=%s\n" +
            "Check server logs above for [renderPdfToImages] RENDER FAILED stack trace.",
            cleanLen, fileName
          );
          await writeStr(
            `⚠️ **Vision Analysis Failed** — PDF page rendering failed.\n\n` +
            `The system could not convert this PDF's pages into images for visual analysis. ` +
            `This is a server-side rendering error, not a content issue.\n\n` +
            `**To analyze this document:**\n` +
            `- Take a screenshot of the page and upload it as a **.jpg** or **.png** file.\n` +
            `- The Vision model will then read it directly from the image.`
          );
          /* No credit deduction — analysis did not happen */
          return;
        }

      /* ── TEXT FILE ──────────────────────────────────────────────── */
      } else {
        console.log("[analyze-file] TEXT path →", fileName);
        const rawText = Buffer.from(fileContent, "base64").toString("utf8");
        const content =
          `**File:** \`${fileName}\`\n\n` +
          `**Content:**\n\n${rawText.slice(0, 14_000)}\n\n` +
          `---\n**Question:** ${userQ}`;

        let stream: any;
        try {
          stream = await textStream(groq, content);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          await writeStr(`⚠️ **Analysis Failed** — Groq API error: ${msg}`);
          return;
        }

        await pipe(stream, writer, encoder);
        succeeded = true;
      }

    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[analyze-file] Unhandled top-level error:", err instanceof Error ? err.stack : err);
      try {
        await writeStr(`\n\n⚠️ **Unexpected Error:** ${msg}`);
      } catch { /* writer may already be closed */ }
    } finally {
      await writer.close().catch(() => {});

      /* Credit deduction — only on successful analysis */
      if (succeeded && profile.subscription === "free") {
        await UserProfile.updateOne({ email }, { $inc: { credits: -CREDITS.IMAGE } })
          .catch((e: unknown) => console.error("[analyze-file] credit deduction failed:", e));
        console.log("[analyze-file] Deducted %d credits from %s", CREDITS.IMAGE, email);
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
