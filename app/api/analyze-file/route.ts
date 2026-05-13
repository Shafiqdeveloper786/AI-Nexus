import { NextRequest } from "next/server";
import { createRequire } from "module";
import Groq from "groq-sdk";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { UserProfile } from "@/lib/models/UserProfile";
import { CREDITS } from "@/lib/credits";

export const runtime    = "nodejs";
export const maxDuration = 60;

/* ── CJS require — native modules & pdf-parse MUST be loaded this way ──── */
const _require = createRequire(import.meta.url);

/* Pre-load canvas so it is ready before pdf-parse v2 calls getScreenshot() */
_require("canvas");

/* ── Models ─────────────────────────────────────────────────────────────── */
const VISION_MODEL = "llama-3.2-11b-vision-preview";
const TEXT_MODEL   = "llama-3.3-70b-versatile";
const MIN_TEXT_CHARS = 50;

/* ── System prompt ───────────────────────────────────────────────────────── */
const SYSTEM = `You are AI Nexus — an expert document analyst.
Rules:
- Describe visual content precisely, then answer the user's question directly.
- Use **bold headings** and bullet points.
- STRICT: Do NOT generate code blocks unless the user explicitly requests code.
- Answer ONLY from the document content. Never guess or hallucinate.
- If you see a special ID, key, or code in the document, report it exactly.`;

/* ════════════════════════════════════════════════════════════════════════════
   extractTextAndScreenshots
   Uses pdf-parse v2 (PDFParse class) — correct API:
     new PDFParse(buffer)          ← Buffer, NOT an options object
     .getText()                    ← returns { text: string, ... }
     .getScreenshot({ width })     ← returns array of { data: Buffer, ... }
   ════════════════════════════════════════════════════════════════════════════ */
async function extractTextAndScreenshots(
  pdfBuffer: Buffer,
  maxPages   = 3,
): Promise<{ text: string; images: string[] }> {
  const { PDFParse } = _require("pdf-parse") as {
    PDFParse: new (buf: Buffer) => any;
  };

  const parser = new PDFParse(pdfBuffer);   // ← correct: Buffer, not {data:buf}
  let   text   = "";
  const images: string[] = [];

  /* Text extraction */
  try {
    const textResult = await parser.getText();
    text = (
      typeof textResult === "string"
        ? textResult
        : textResult?.text ?? textResult?.content ?? ""
    ).trim();
    console.log("[pdf-parse] getText OK — chars=%d", text.length);
  } catch (err) {
    console.warn("[pdf-parse] getText failed:", err instanceof Error ? err.message : err);
  }

  /* Screenshot / page-image extraction via pdf-parse v2 built-in renderer */
  try {
    const shots: any[] = await parser.getScreenshot({
      width:  1200,
      pages:  Array.from({ length: maxPages }, (_, i) => i + 1), // [1, 2, 3]
    });

    for (const shot of shots) {
      /* shot.data may be a Buffer, Uint8Array, or base64 string */
      if (!shot) continue;
      if (typeof shot === "string") {
        /* Already base64 */
        images.push(shot.replace(/^data:image\/\w+;base64,/, ""));
      } else if (shot.data) {
        images.push(Buffer.from(shot.data).toString("base64"));
      } else if (shot.buffer ?? shot instanceof Buffer) {
        images.push(Buffer.from(shot).toString("base64"));
      }
    }

    console.log("[pdf-parse] getScreenshot OK — pages=%d", images.length);
  } catch (err) {
    console.error(
      "[pdf-parse] getScreenshot FAILED:",
      err instanceof Error ? err.stack ?? err.message : String(err)
    );
  }

  return { text, images };
}

/* ── pdfjs text-content fallback (no canvas needed) ─────────────────────── */
async function extractTextViaPdfjs(pdfBuffer: Buffer): Promise<string> {
  try {
    const pdfjs   = await import("pdfjs-dist/legacy/build/pdf.mjs" as string) as any;
    const { resolve, sep } = await import("path");
    const abs = resolve(process.cwd(), "node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs");
    pdfjs.GlobalWorkerOptions.workerSrc = abs.startsWith("/")
      ? `file://${abs}`
      : `file:///${abs.split(sep).join("/")}`;

    const pdfDoc = await pdfjs.getDocument({
      data:       new Uint8Array(pdfBuffer),
      verbosity:  0,
    }).promise;

    const pages = Math.min(pdfDoc.numPages, 10);
    let   text  = "";

    for (let p = 1; p <= pages; p++) {
      const page    = await pdfDoc.getPage(p);
      const content = await page.getTextContent();
      text += content.items.map((i: any) => i.str).join(" ") + "\n\n";
    }

    await pdfDoc.destroy();
    const cleaned = text.trim();
    console.log("[pdfjs] extractText OK — chars=%d", cleaned.length);
    return cleaned;
  } catch (err) {
    console.warn("[pdfjs] extractText failed:", err instanceof Error ? err.message : err);
    return "";
  }
}

/* ── Direct JPEG extraction from raw PDF bytes (pure JS, no canvas) ───────
   Scanned PDFs embed full-page JPEG images as raw byte streams.
   This method finds them by scanning for JPEG SOI (FF D8 FF) markers.
   Returns [] for digital PDFs that have no embedded JPEG streams.
   ─────────────────────────────────────────────────────────────────────────── */
function extractEmbeddedJpegs(pdfBuffer: Buffer, max = 3): string[] {
  const found: string[] = [];
  let   i = 0;

  while (i < pdfBuffer.length - 3 && found.length < max) {
    /* Look for JPEG Start-of-Image: FF D8 FF (+ any marker byte) */
    if (pdfBuffer[i] === 0xFF && pdfBuffer[i + 1] === 0xD8 && pdfBuffer[i + 2] === 0xFF) {
      const start = i;
      /* Scan for JPEG End-of-Image: FF D9 */
      let   end   = -1;
      for (let j = start + 2; j < pdfBuffer.length - 1; j++) {
        if (pdfBuffer[j] === 0xFF && pdfBuffer[j + 1] === 0xD9) {
          end = j + 2;
          break;
        }
      }
      if (end !== -1) {
        const jpeg = pdfBuffer.subarray(start, end);
        if (jpeg.length > 50_000) {             // skip thumbnails / icons
          found.push(jpeg.toString("base64"));
          console.log("[extractEmbeddedJpegs] found %dKB JPEG at offset %d", Math.round(jpeg.length / 1024), start);
        }
        i = end;
        continue;
      }
    }
    i++;
  }

  return found;
}

/* ── Groq stream helpers ─────────────────────────────────────────────────── */
async function visionGroqStream(
  groq:    Groq,
  images:  string[],    // base64 PNG or JPEG
  textCtx: string,
  userQ:   string,
  mime     = "image/png",
  maxTok   = 1500,
): Promise<any> {
  const prompt: any[] = [
    {
      type: "text",
      text: (
        `You are analysing a document. ${images.length} page image(s) are attached.\n` +
        (textCtx ? `\nExtracted text context:\n${textCtx}\n` : "") +
        `\n---\nUser question: ${userQ}\n\n` +
        `CRITICAL: Answer ONLY from the visual content of the attached images. ` +
        `Report any IDs, codes, or keys you see exactly as written.`
      ),
    },
    ...images.map((b64) => ({
      type:      "image_url",
      image_url: { url: `data:${mime};base64,${b64}` },
    })),
  ];

  return groq.chat.completions.create({
    model:      VISION_MODEL,
    messages:   [{ role: "user", content: prompt }],
    stream:     true,
    max_tokens: maxTok,
  });
}

async function textGroqStream(groq: Groq, content: string): Promise<any> {
  return groq.chat.completions.create({
    model:       TEXT_MODEL,
    messages:    [{ role: "system", content: SYSTEM }, { role: "user", content }],
    stream:      true,
    max_tokens:  1500,
    temperature: 0.35,
  });
}

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
   POST /api/analyze-file  —  Strict Vision-OCR Pipeline

   ┌─ IMAGE ───────────────────────────────────────────────────────────────────┐
   │  → visionGroqStream(image)                                                │
   └───────────────────────────────────────────────────────────────────────────┘
   ┌─ PDF — Three-layer image extraction (no guessing) ────────────────────────┐
   │                                                                            │
   │  LAYER 1: pdf-parse v2 getScreenshot() + getText()                        │
   │    → if screenshots > 0: visionGroqStream(screenshots + textCtx)          │
   │                                                                            │
   │  LAYER 2: Direct JPEG byte-scan (scanned PDFs embed raw JPEGs)            │
   │    → if jpegs found: visionGroqStream(jpegs, mime=image/jpeg)             │
   │                                                                            │
   │  LAYER 3: Text-only (text-extractable PDF)                                │
   │    text = pdf-parse getText() OR pdfjs getTextContent()                   │
   │    → if text ≥ 50 chars: textGroqStream(text)                             │
   │                                                                            │
   │  FAILURE: All layers failed                                                │
   │    → stream: "Error: Buffer-to-Image Conversion Failed"                   │
   │      with diagnostics for each layer — NO GUESSING                        │
   └───────────────────────────────────────────────────────────────────────────┘
   ┌─ TEXT FILE ───────────────────────────────────────────────────────────────┐
   │  → textGroqStream(file content)                                            │
   └───────────────────────────────────────────────────────────────────────────┘

   Credits: 12 (CREDITS.IMAGE) deducted only after successful stream.
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
  const write   = (s: string) => writer.write(encoder.encode(s));

  /* 5. Pipeline */
  (async () => {
    let succeeded = false;

    try {
      /* ── IMAGE ─────────────────────────────────────────────────── */
      if (fileType === "image") {
        console.log("[analyze-file] IMAGE →", fileName);
        const dataUrl = `data:${mimeType ?? "image/jpeg"};base64,${fileContent}`;
        try {
          const stream = await groq.chat.completions.create({
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
          await pipe(stream, writer, encoder);
          succeeded = true;
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          await write(`⚠️ **Vision Analysis Failed** — Groq API error: ${msg}`);
        }

      /* ── PDF ────────────────────────────────────────────────────── */
      } else if (fileType === "pdf") {
        const pdfBuffer = Buffer.from(fileContent, "base64");
        console.log("[analyze-file] PDF: %s  size=%dKB", fileName, Math.round(pdfBuffer.length / 1024));

        await write("🔍 **Analyzing document…**\n\n");

        /* Track what each layer produced for the failure diagnostic */
        const diagnostics: string[] = [];

        /* ── LAYER 1: pdf-parse v2 getScreenshot() ── */
        console.log("[analyze-file] LAYER 1: pdf-parse v2 getScreenshot()");
        const { text: parsedText, images: screenshots } = await extractTextAndScreenshots(pdfBuffer, 3);
        const textClean = parsedText.replace(/\s+/g, "").length;
        diagnostics.push(`Layer 1 (pdf-parse v2): screenshots=${screenshots.length}  textChars=${textClean}`);

        if (screenshots.length > 0) {
          console.log("[analyze-file] LAYER 1 SUCCESS — %d screenshot(s)", screenshots.length);
          try {
            const stream = await visionGroqStream(
              groq, screenshots,
              textClean >= MIN_TEXT_CHARS ? parsedText.slice(0, 5_000) : "",
              userQ,
              "image/png",
            );
            await pipe(stream, writer, encoder);
            succeeded = true;
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            console.error("[analyze-file] LAYER 1 Groq error:", msg);
            diagnostics.push(`Layer 1 Groq error: ${msg}`);
          }
        }

        /* ── LAYER 2: Direct JPEG byte-scan ── */
        if (!succeeded) {
          console.log("[analyze-file] LAYER 2: direct JPEG byte-scan");
          const jpegs = extractEmbeddedJpegs(pdfBuffer, 3);
          diagnostics.push(`Layer 2 (JPEG byte-scan): found=${jpegs.length}`);

          if (jpegs.length > 0) {
            console.log("[analyze-file] LAYER 2 SUCCESS — %d JPEG(s)", jpegs.length);
            try {
              const stream = await visionGroqStream(
                groq, jpegs,
                textClean >= MIN_TEXT_CHARS ? parsedText.slice(0, 5_000) : "",
                userQ,
                "image/jpeg",
              );
              await pipe(stream, writer, encoder);
              succeeded = true;
            } catch (err) {
              const msg = err instanceof Error ? err.message : String(err);
              console.error("[analyze-file] LAYER 2 Groq error:", msg);
              diagnostics.push(`Layer 2 Groq error: ${msg}`);
            }
          }
        }

        /* ── LAYER 3: Text-only (digital PDF) ── */
        if (!succeeded) {
          console.log("[analyze-file] LAYER 3: text-only path");

          /* Try pdf-parse text first, then pdfjs as backup */
          let finalText = parsedText;
          if (textClean < MIN_TEXT_CHARS) {
            finalText = await extractTextViaPdfjs(pdfBuffer);
          }
          const finalClean = finalText.replace(/\s+/g, "").length;
          diagnostics.push(`Layer 3 (text): chars=${finalClean}`);

          if (finalClean >= MIN_TEXT_CHARS) {
            console.log("[analyze-file] LAYER 3 SUCCESS — text model  chars=%d", finalClean);
            try {
              const content =
                `**File:** \`${fileName}\`\n\n` +
                `**Extracted Content:**\n\n${finalText.slice(0, 14_000)}\n\n` +
                `---\n**Question:** ${userQ}`;
              const stream = await textGroqStream(groq, content);
              await pipe(stream, writer, encoder);
              succeeded = true;
            } catch (err) {
              const msg = err instanceof Error ? err.message : String(err);
              diagnostics.push(`Layer 3 Groq error: ${msg}`);
            }
          }
        }

        /* ── ALL LAYERS FAILED ── */
        if (!succeeded) {
          console.error("[analyze-file] ALL LAYERS FAILED:\n", diagnostics.join("\n"));
          await write(
            `❌ **Error: Buffer-to-Image Conversion Failed**\n\n` +
            `All three extraction layers failed for \`${fileName}\`.\n\n` +
            `**Diagnostic report:**\n` +
            diagnostics.map((d) => `- ${d}`).join("\n") +
            `\n\n**To fix:** Check the Next.js server terminal for ` +
            `\`[pdf-parse] getScreenshot FAILED\` and ` +
            `\`[renderPdfToImages] RENDER FAILED\` stack traces.\n\n` +
            `**Immediate workaround:** Upload a screenshot of the page as a **.jpg** file.`
          );
        }

      /* ── TEXT FILE ──────────────────────────────────────────────── */
      } else {
        console.log("[analyze-file] TEXT →", fileName);
        const rawText = Buffer.from(fileContent, "base64").toString("utf8");
        const content =
          `**File:** \`${fileName}\`\n\n` +
          `**Content:**\n\n${rawText.slice(0, 14_000)}\n\n` +
          `---\n**Question:** ${userQ}`;
        try {
          const stream = await textGroqStream(groq, content);
          await pipe(stream, writer, encoder);
          succeeded = true;
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          await write(`⚠️ **Analysis Failed** — Groq API error: ${msg}`);
        }
      }

    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[analyze-file] Top-level error:", err instanceof Error ? err.stack : err);
      try { await write(`\n\n⚠️ **Unexpected Error:** ${msg}`); } catch { /* writer closed */ }
    } finally {
      await writer.close().catch(() => {});

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
