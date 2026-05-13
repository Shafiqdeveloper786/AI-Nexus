import { NextRequest } from "next/server";
import { createRequire } from "module";
import Groq from "groq-sdk";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { UserProfile } from "@/lib/models/UserProfile";
import { CREDITS } from "@/lib/credits";

export const runtime    = "nodejs";
export const maxDuration = 60;

/* ── Require native canvas via CJS (avoids ESM dynamic-import timing issues) */
const _require    = createRequire(import.meta.url);
const { createCanvas } = _require("canvas") as typeof import("canvas");

/* ── Models ─────────────────────────────────────────────────────────────────── */
const VISION_PRIMARY  = "meta-llama/llama-4-scout-17b-16e-instruct";
const VISION_FALLBACK = "llama-3.2-11b-vision-preview";
const TEXT_MODEL      = "llama-3.3-70b-versatile";
const MIN_TEXT_CHARS  = 50;

/* ── pdfjs singleton (initialised once per Lambda cold-start) ─────────────── */
let pdfjsLib: any = null;

async function getPdfjs(): Promise<any> {
  if (pdfjsLib) return pdfjsLib;
  pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs" as string) as any;

  /* Build cross-platform file:// URL for the worker */
  const { resolve, sep } = await import("path");
  const abs = resolve(process.cwd(), "node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs");
  /* Unix: /abs/path  → file:///abs/path  (file:// + leading /)         *
   * Win:  D:\path    → file:///D:/path   (file:// + / + drive)         */
  pdfjsLib.GlobalWorkerOptions.workerSrc = abs.startsWith("/")
    ? `file://${abs}`
    : `file:///${abs.split(sep).join("/")}`;

  console.log("[getPdfjs] workerSrc =", pdfjsLib.GlobalWorkerOptions.workerSrc.slice(0, 70));
  return pdfjsLib;
}

/* ── ANALYSIS_SYSTEM ─────────────────────────────────────────────────────── */
const ANALYSIS_SYSTEM = `You are AI Nexus — an expert document and image analyst.

**Guidelines:**
- Describe visual content precisely, then answer the user's question directly.
- For text content: identify key information and answer concisely.
- Use **bold headings** and bullet points.

**STRICT RULE — No code blocks** unless the user explicitly requests code.`;

/* ════════════════════════════════════════════════════════════════════════════
   renderPdfToImages
   Uses pdfjs-dist + canvas (CJS-required, not dynamically imported).
   Returns base64 PNG strings, one per page. Returns [] on any error.
   ════════════════════════════════════════════════════════════════════════════ */
async function renderPdfToImages(pdfBuffer: Buffer, maxPages = 3): Promise<string[]> {
  const images: string[] = [];
  let   pdfDoc: any      = null;

  try {
    const pdfjs = await getPdfjs();

    pdfDoc = await pdfjs.getDocument({
      data:            new Uint8Array(pdfBuffer),
      useSystemFonts:  true,
      disableFontFace: false,
      verbosity:       0,
    }).promise;

    const pages = Math.min(pdfDoc.numPages, maxPages);
    console.log("[renderPdfToImages] rendering %d / %d pages", pages, pdfDoc.numPages);

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
      console.log("[renderPdfToImages] page %d: %dx%d  %dKB", p, w, h, Math.round(b64.length * 0.75 / 1024));
    }
  } catch (err) {
    console.error("[renderPdfToImages] FAILED:", err instanceof Error ? err.stack : String(err));
  } finally {
    await pdfDoc?.destroy().catch(() => {});
  }

  return images;
}

/* ── extractPdfText ──────────────────────────────────────────────────────── */
async function extractPdfText(pdfBuffer: Buffer): Promise<string> {
  try {
    const pdfParse       = _require("pdf-parse") as any;
    const PDFParseClass  = pdfParse.PDFParse ?? pdfParse.default?.PDFParse;

    if (PDFParseClass) {
      const r = await new PDFParseClass({ data: pdfBuffer, verbosity: 0 }).getText();
      return (r.text ?? "").trim();
    }
    /* Older pdf-parse API */
    const r = await pdfParse(pdfBuffer);
    return (r.text ?? "").trim();
  } catch (err) {
    console.warn("[extractPdfText] failed:", err instanceof Error ? err.message : err);
    return "";
  }
}

/* ── callVision — primary → fallback → null (never throws) ──────────────── */
async function callVision(
  groq:      Groq,
  content:   any[],
  maxTokens  = 1500,
): Promise<any | null> {
  for (const model of [VISION_PRIMARY, VISION_FALLBACK]) {
    try {
      const stream = await groq.chat.completions.create({
        model,
        messages:   [{ role: "user", content }],
        stream:     true,
        max_tokens: maxTokens,
      });
      console.log("[callVision] succeeded with", model);
      return stream;
    } catch (err) {
      console.warn("[callVision] %s failed:", model, err instanceof Error ? err.message.slice(0, 80) : err);
    }
  }
  console.error("[callVision] both models unavailable");
  return null;
}

/* ── callText — always resolves, falls back to informative message ────────── */
async function callText(
  groq:    Groq,
  content: string,
  system:  string,
): Promise<any | null> {
  try {
    return await groq.chat.completions.create({
      model:       TEXT_MODEL,
      messages:    [
        { role: "system", content: system },
        { role: "user",   content },
      ],
      stream:      true,
      max_tokens:  1500,
      temperature: 0.4,
    });
  } catch (err) {
    console.error("[callText] failed:", err instanceof Error ? err.message : err);
    return null;
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
   POST /api/analyze-file — Forced Multimodal Pipeline

   IMAGE  →  callVision directly
   PDF    →  parallel(renderPages, extractText)
                B1: pages OK            → callVision(pages + textCtx)
                B2: pages fail, text OK → callText(extracted text)
                B3: both fail           → callVision(text-only prompt)
                B∅: all models down     → short apology, stream closed
   TEXT   →  callText
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
  if (!fileContent) return Response.json({ error: "fileContent is required" }, { status: 400 });

  const groqKey = process.env.GROQ_API_KEY;
  if (!groqKey)  return Response.json({ error: "GROQ_API_KEY not configured" }, { status: 503 });

  /* 3. DB + credit check */
  try { await connectDB(); }
  catch (e) { return Response.json({ error: "DB_CONNECTION_FAILED", message: String(e) }, { status: 503 }); }

  let profile: any;
  try { profile = await (UserProfile as any).findOrCreate(email, name); }
  catch (e) { return Response.json({ error: "PROFILE_FETCH_FAILED", message: String(e) }, { status: 500 }); }

  if (profile.subscription === "free" && profile.credits < CREDITS.IMAGE)
    return Response.json({
      error: "NO_CREDITS",
      message: `Document analysis costs ${CREDITS.IMAGE} credits. You have ${profile.credits} remaining.`,
      required: CREDITS.IMAGE,
      current:  profile.credits,
    }, { status: 403 });

  /* 4. Stream plumbing */
  const groq    = new Groq({ apiKey: groqKey });
  const userQ   = question?.trim() || "Analyse this document and summarise the key information.";
  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
  const writer  = writable.getWriter();
  const encoder = new TextEncoder();

  const write  = (t: string)  => writer.write(encoder.encode(t));
  const finish = async () => { await writer.close().catch(() => {}); };

  /* Drain a Groq stream to the client */
  const pipe = async (stream: any): Promise<boolean> => {
    if (!stream) return false;
    try {
      for await (const chunk of stream) {
        const t = chunk.choices[0]?.delta?.content ?? "";
        if (t) await write(t);
      }
      return true;
    } catch (e) {
      console.error("[pipe] stream error:", e);
      return false;
    }
  };

  /* 5. Async pipeline */
  (async () => {
    let succeeded = false;

    try {
      /* ── PATH A: Image ─────────────────────────────────────────── */
      if (fileType === "image") {
        console.log("[analyze-file] PATH A — image:", fileName);
        const dataUrl = `data:${mimeType ?? "image/jpeg"};base64,${fileContent}`;
        const stream  = await callVision(groq, [
          { type: "text",      text: userQ },
          { type: "image_url", image_url: { url: dataUrl } },
        ] as any[], 1024);
        succeeded = await pipe(stream);

      /* ── PATH B: PDF ────────────────────────────────────────────── */
      } else if (fileType === "pdf") {
        const pdfBuf = Buffer.from(fileContent, "base64");

        /* Status token — appears in the stable pre-created bubble */
        await write("🔍 **Analyzing document visual context…**\n\n");

        /* Run rendering + text extraction in parallel */
        const [pageImages, rawText] = await Promise.all([
          renderPdfToImages(pdfBuf, 3),
          extractPdfText(pdfBuf),
        ]);

        const cleanLen = rawText.replace(/\s+/g, "").length;
        console.log("[analyze-file] PATH B — file=%s pages=%d textChars=%d", fileName, pageImages.length, cleanLen);

        /* B1: Pages rendered → Vision (best quality) */
        if (pageImages.length > 0) {
          const textCtx = cleanLen >= MIN_TEXT_CHARS
            ? `\n\n**Extracted text (additional context):**\n${rawText.slice(0, 5_000)}`
            : "";

          const content: any[] = [
            {
              type: "text",
              text: (
                `Analyzing PDF: "${fileName}" — ${pageImages.length} page(s) rendered visually.` +
                textCtx +
                `\n\n---\n**User question:** ${userQ}`
              ),
            },
            ...pageImages.map((img) => ({
              type:      "image_url",
              image_url: { url: `data:image/png;base64,${img}` },
            })),
          ];

          const stream = await callVision(groq, content, 1500);

          if (stream) {
            succeeded = await pipe(stream);
          } else if (cleanLen >= MIN_TEXT_CHARS) {
            /* Vision unavailable but text exists → text model */
            console.warn("[analyze-file] Vision null, falling to text model (B1→B2)");
            const s = await callText(groq,
              `**File:** \`${fileName}\`\n\n**Content:**\n\n${rawText.slice(0, 14_000)}\n\n---\n**Question:** ${userQ}`,
              ANALYSIS_SYSTEM,
            );
            succeeded = await pipe(s);
          }
        }

        /* B2: No pages + text available → text model */
        if (!succeeded && cleanLen >= MIN_TEXT_CHARS) {
          console.log("[analyze-file] PATH B2 — text model  chars=%d", cleanLen);
          const stream = await callText(groq,
            `**File:** \`${fileName}\`\n\n**Content:**\n\n${rawText.slice(0, 14_000)}\n\n---\n**Question:** ${userQ}`,
            ANALYSIS_SYSTEM,
          );
          succeeded = await pipe(stream);
        }

        /* B3: Nothing extracted → ask vision model to respond gracefully */
        if (!succeeded) {
          console.warn("[analyze-file] PATH B3 — no pages, no text, last-resort vision call");
          const stream = await callVision(groq, [{
            type: "text",
            text: (
              `A PDF named "${fileName}" was uploaded. The pages could not be rendered as images ` +
              `and no selectable text was found. Please respond to the user's question: "${userQ}" ` +
              `based on any inference you can make from the filename, and offer helpful suggestions ` +
              `to proceed. Do not mention technical rendering errors.`
            ),
          }] as any[], 400);
          succeeded = await pipe(stream);
        }

        /* B∅: All providers down */
        if (!succeeded) {
          await write("The document analysis service is experiencing high load. Please try again in a moment.");
        }

      /* ── PATH C: Plain text file ────────────────────────────────── */
      } else {
        console.log("[analyze-file] PATH C — text file:", fileName);
        const rawText = Buffer.from(fileContent, "base64").toString("utf8");
        const stream  = await callText(groq,
          `**File:** \`${fileName}\`\n\n**Content:**\n\n${rawText.slice(0, 14_000)}\n\n---\n**Question:** ${userQ}`,
          ANALYSIS_SYSTEM,
        );
        succeeded = await pipe(stream);
      }

    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unexpected error";
      console.error("[analyze-file] Unhandled error:", err instanceof Error ? err.stack : err);
      try { await write(`\n\n⚠️ **Error:** ${msg}`); } catch { /* writer closed */ }
    } finally {
      await finish();

      /* Deduct 12 credits on success */
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
