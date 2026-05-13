import { NextRequest } from "next/server";
import Groq from "groq-sdk";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { UserProfile } from "@/lib/models/UserProfile";
import { CREDITS } from "@/lib/credits";

export const runtime    = "nodejs";
export const maxDuration = 60;

/* ── Models ──────────────────────────────────────────────────────────────────
   VISION_PRIMARY   — Llama 4 Scout multimodal (preferred, highest accuracy)
   VISION_FALLBACK  — Llama 3.2 Vision (automatic fallback on 503 / unavailable)
   TEXT_MODEL       — Llama 3.3 70B (plain-text files only)
   ─────────────────────────────────────────────────────────────────────────── */
const VISION_PRIMARY  = "meta-llama/llama-4-scout-17b-16e-instruct";
const VISION_FALLBACK = "llama-3.2-11b-vision-preview";
const TEXT_MODEL      = "llama-3.3-70b-versatile";

/* Chars needed before we consider extracted text "usable context" */
const MIN_TEXT_CHARS = 80;

/* ── System prompt — strict no-code rule for document analysis ─────────────── */
const ANALYSIS_SYSTEM = `You are AI Nexus — an expert document and image analyst.

**Response guidelines:**
- For images / scanned documents: describe what you see precisely, then answer the question.
- For text documents: identify the key information and answer directly.
- Use **bold headings** and bullet points to structure your response clearly.
- Lead with the most important finding. Be thorough but concise.

**STRICT RULE — Code blocks:**
Do NOT generate any fenced code blocks unless the user explicitly asks for code. Document analysis responses must be pure text with Markdown formatting only.`;

/* ── callVision: primary model → automatic fallback ─────────────────────────
   Tries VISION_PRIMARY first. Any network / availability error transparently
   retries with VISION_FALLBACK so the user never sees a hard failure.
   ─────────────────────────────────────────────────────────────────────────── */
async function callVision(
  groq:      Groq,
  content:   any[],
  maxTokens  = 1500,
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
    console.warn("[analyze-file] Primary vision failed (%s) → retrying with fallback", msg.slice(0, 80));
    return groq.chat.completions.create({
      model:      VISION_FALLBACK,
      messages:   [{ role: "user", content }],
      stream:     true,
      max_tokens: maxTokens,
    });
  }
}

/* ── renderPdfToImages: pdfjs-dist v5 + canvas ───────────────────────────────
   Converts the first `maxPages` pages of a PDF to base64 PNG strings.
   Returns [] on any error so the caller can degrade gracefully.
   ─────────────────────────────────────────────────────────────────────────── */
async function renderPdfToImages(pdfBuffer: Buffer, maxPages = 2): Promise<string[]> {
  const images: string[] = [];
  let pdfDoc: any        = null;
  try {
    const [pdfjs, canvasMod, pathMod] = await Promise.all([
      import("pdfjs-dist/legacy/build/pdf.mjs" as string) as Promise<any>,
      import("canvas")                                    as Promise<any>,
      import("path")                                      as Promise<any>,
    ]);

    /* Absolute file:// URL required by pdfjs-dist v5 worker */
    const workerAbs = pathMod.resolve("node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs");
    pdfjs.GlobalWorkerOptions.workerSrc =
      new URL("file:///" + workerAbs.split(pathMod.sep).join("/")).href;

    pdfDoc = await pdfjs.getDocument({
      data:            new Uint8Array(pdfBuffer),
      useSystemFonts:  true,
      disableFontFace: false,
      verbosity:       0,
    }).promise;

    const pages = Math.min(pdfDoc.numPages, maxPages);
    console.log("[analyze-file] Rendering %d/%d page(s)", pages, pdfDoc.numPages);

    for (let p = 1; p <= pages; p++) {
      const page     = await pdfDoc.getPage(p);
      const viewport = page.getViewport({ scale: 1.5 });
      const canvas   = canvasMod.createCanvas(Math.floor(viewport.width), Math.floor(viewport.height));
      await page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;
      images.push(canvas.toBuffer("image/png").toString("base64"));
      page.cleanup();
    }
  } catch (err) {
    console.error("[renderPdfToImages]", err instanceof Error ? err.message : err);
  } finally {
    await pdfDoc?.destroy().catch(() => {});
  }
  return images;
}

/* ── extractPdfText: pdf-parse v2 ────────────────────────────────────────── */
async function extractPdfText(pdfBuffer: Buffer): Promise<string> {
  try {
    const { PDFParse } = await import("pdf-parse") as any;
    const result       = await new PDFParse({ data: pdfBuffer, verbosity: 0 }).getText();
    return (result.text ?? "").trim();
  } catch (err) {
    console.warn("[extractPdfText]", err instanceof Error ? err.message : err);
    return "";
  }
}

/* ── Request body ─────────────────────────────────────────────────────────── */
interface AnalyzeBody {
  question:    string;
  fileContent: string;            // always base64
  fileType:    "image" | "text" | "pdf";
  fileName:    string;
  mimeType?:   string;
}

/* ════════════════════════════════════════════════════════════════════════════
   POST /api/analyze-file

   Unified Omni-Document Pipeline:

   ┌─ Image (.jpg/.png/.webp) ──────────────────────────────────────────────┐
   │  → callVision() [primary → fallback]                                   │
   └────────────────────────────────────────────────────────────────────────┘
   ┌─ PDF (any type) ────────────────────────────────────────────────────────┐
   │  Run IN PARALLEL:                                                       │
   │    • extractPdfText()    → extract searchable text (if any)            │
   │    • renderPdfToImages() → render first 2 pages to PNG                 │
   │                                                                         │
   │  If page images available:                                              │
   │    → callVision(pages + optional text context) [primary → fallback]    │
   │  Else if text available (render failed):                                │
   │    → TEXT_MODEL with extracted text                                     │
   │  Else (both failed):                                                    │
   │    → Helpful guidance response via TEXT_MODEL                           │
   └────────────────────────────────────────────────────────────────────────┘
   ┌─ Plain text (.txt/.md/.csv/.json) ─────────────────────────────────────┐
   │  → TEXT_MODEL                                                           │
   └────────────────────────────────────────────────────────────────────────┘

   Credits: CREDITS.IMAGE (12) deducted AFTER successful stream completion.
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
    console.warn("[analyze-file] %s has %d credits — needs %d", email, profile.credits, CREDITS.IMAGE);
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

  /* ── 5. Async analysis ───────────────────────────────────────────────── */
  (async () => {
    let analysisSucceeded = false;

    try {
      let stream: any;

      /* ──────────────────────────────────────────────────────────────────
         PATH A: Image → Vision model (primary → fallback)
         ────────────────────────────────────────────────────────────────── */
      if (fileType === "image") {
        console.log("[analyze-file] PATH A — image:", fileName);
        stream = await callVision(groq, [
          { type: "text",      text: userQ },
          { type: "image_url", image_url: { url: `data:${mimeType ?? "image/jpeg"};base64,${fileContent}` } },
        ] as any[], 1024);

      /* ──────────────────────────────────────────────────────────────────
         PATH B: PDF — Unified Omni pipeline
                 Always attempt BOTH text extraction AND page rendering
                 IN PARALLEL, then combine into the best available input
                 for the vision model.
         ────────────────────────────────────────────────────────────────── */
      } else if (fileType === "pdf") {
        const pdfBuffer = Buffer.from(fileContent, "base64");

        /* Emit status immediately — shows inside the stable pre-created bubble */
        await writer.write(encoder.encode("🔍 **Analyzing document visual context…**\n\n"));

        /* Run text extraction + page rendering concurrently */
        const [rawText, pageImages] = await Promise.all([
          extractPdfText(pdfBuffer),
          renderPdfToImages(pdfBuffer, 2),
        ]);

        const cleanLen = rawText.replace(/\s+/g, "").length;
        console.log(
          "[analyze-file] PATH B — PDF: pages=%d textChars=%d file=%s",
          pageImages.length, cleanLen, fileName
        );

        if (pageImages.length > 0) {
          /* ── Best path: visual pages + optional text context → Vision ── */
          const textCtx = cleanLen >= MIN_TEXT_CHARS
            ? `\n\n**Extracted searchable text (use as additional context):**\n${rawText.slice(0, 6_000)}`
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

          stream = await callVision(groq, content, 1500);

        } else if (cleanLen >= MIN_TEXT_CHARS) {
          /* ── Fallback: page rendering failed but text is usable → text model ── */
          console.warn("[analyze-file] Page render failed — falling back to text model");
          stream = await groq.chat.completions.create({
            model:       TEXT_MODEL,
            messages:    [
              { role: "system", content: ANALYSIS_SYSTEM },
              {
                role:    "user",
                content: `**File:** \`${fileName}\`\n\n**Extracted Text:**\n\n${rawText.slice(0, 14_000)}\n\n---\n**Question:** ${userQ}`,
              },
            ],
            stream:      true,
            max_tokens:  1500,
            temperature: 0.4,
          });

        } else {
          /* ── Last resort: both failed — guide the user ── */
          console.warn("[analyze-file] Both render and text failed for %s", fileName);
          stream = await groq.chat.completions.create({
            model:       TEXT_MODEL,
            messages:    [
              { role: "system", content: ANALYSIS_SYSTEM },
              {
                role:    "user",
                content: (
                  `The uploaded file "${fileName}" appears to be a fully scanned/protected PDF. ` +
                  `Text extraction yielded only ${cleanLen} characters and page rendering failed. ` +
                  `Please respond to: "${userQ}" by advising the user: ` +
                  `(1) Screenshot individual pages and upload as .jpg/.png for full visual analysis. ` +
                  `(2) If the PDF allows text selection, paste the text directly into the chat. ` +
                  `(3) Try a PDF unlocker tool if the file is password-protected.`
                ),
              },
            ],
            stream:      true,
            max_tokens:  400,
            temperature: 0.5,
          });
        }

      /* ──────────────────────────────────────────────────────────────────
         PATH C: Plain text file (.txt / .md / .csv / .json) → text model
         ────────────────────────────────────────────────────────────────── */
      } else {
        console.log("[analyze-file] PATH C — text file:", fileName);
        const rawText = Buffer.from(fileContent, "base64").toString("utf8");
        stream = await groq.chat.completions.create({
          model:       TEXT_MODEL,
          messages:    [
            { role: "system", content: ANALYSIS_SYSTEM },
            {
              role:    "user",
              content: `**File:** \`${fileName}\`\n\n**Content:**\n\n${rawText.slice(0, 14_000)}\n\n---\n**Question:** ${userQ}`,
            },
          ],
          stream:      true,
          max_tokens:  1500,
          temperature: 0.4,
        });
      }

      /* ── Stream tokens to client ──────────────────────────────────────── */
      for await (const chunk of stream) {
        const text = chunk.choices[0]?.delta?.content ?? "";
        if (text) await writer.write(encoder.encode(text));
      }

      analysisSucceeded = true;

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Analysis failed";
      console.error("[analyze-file] Unhandled error:", msg);
      await writer.write(encoder.encode(`\n\n⚠️ **Analysis Error:** ${msg}`));
    } finally {
      await writer.close().catch(() => {});

      /* ── Credit deduction — only on success, free tier ─────────────── */
      if (analysisSucceeded && profile.subscription === "free") {
        try {
          await UserProfile.updateOne({ email }, { $inc: { credits: -CREDITS.IMAGE } });
          console.log(
            "[analyze-file] Deducted %d credits from %s (remaining ≈ %d)",
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
