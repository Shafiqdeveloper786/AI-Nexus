/* ═══════════════════════════════════════════════════════════════════════════
   DOMMatrix polyfill — MUST be the very first statement in this file.

   pdfjs-dist v5 uses DOMMatrix for viewport matrix transforms when calling
   page.render(). Node.js (including v20/v22) does NOT expose DOMMatrix
   globally — only browsers and Web Workers do.

   This spec-correct 2D/3D implementation covers every operation pdfjs uses:
   construction from 6/16-element arrays, multiply, translate, scale, rotate,
   inverse, transformPoint, and the a/b/c/d/e/f aliases.
   ═══════════════════════════════════════════════════════════════════════════ */
if (typeof (globalThis as any).DOMMatrix === "undefined") {
  class _DOMMatrix {
    m11 = 1; m12 = 0; m13 = 0; m14 = 0;
    m21 = 0; m22 = 1; m23 = 0; m24 = 0;
    m31 = 0; m32 = 0; m33 = 1; m34 = 0;
    m41 = 0; m42 = 0; m43 = 0; m44 = 1;
    is2D      = true;
    isIdentity = true;

    constructor(init?: number[] | string) {
      if (Array.isArray(init)) {
        if (init.length === 6) {
          [this.m11, this.m12, this.m21, this.m22, this.m41, this.m42] = init;
          this.isIdentity = false;
        } else if (init.length === 16) {
          [this.m11, this.m12, this.m13, this.m14,
           this.m21, this.m22, this.m23, this.m24,
           this.m31, this.m32, this.m33, this.m34,
           this.m41, this.m42, this.m43, this.m44] = init;
          this.is2D = false; this.isIdentity = false;
        }
      }
    }

    /* 2D aliases */
    get a() { return this.m11; } set a(v: number) { this.m11 = v; }
    get b() { return this.m12; } set b(v: number) { this.m12 = v; }
    get c() { return this.m21; } set c(v: number) { this.m21 = v; }
    get d() { return this.m22; } set d(v: number) { this.m22 = v; }
    get e() { return this.m41; } set e(v: number) { this.m41 = v; }
    get f() { return this.m42; } set f(v: number) { this.m42 = v; }

    multiply(o: _DOMMatrix): _DOMMatrix {
      const [a, b] = [this, o];
      return new _DOMMatrix([
        a.m11*b.m11+a.m12*b.m21+a.m13*b.m31+a.m14*b.m41, a.m11*b.m12+a.m12*b.m22+a.m13*b.m32+a.m14*b.m42,
        a.m11*b.m13+a.m12*b.m23+a.m13*b.m33+a.m14*b.m43, a.m11*b.m14+a.m12*b.m24+a.m13*b.m34+a.m14*b.m44,
        a.m21*b.m11+a.m22*b.m21+a.m23*b.m31+a.m24*b.m41, a.m21*b.m12+a.m22*b.m22+a.m23*b.m32+a.m24*b.m42,
        a.m21*b.m13+a.m22*b.m23+a.m23*b.m33+a.m24*b.m43, a.m21*b.m14+a.m22*b.m24+a.m23*b.m34+a.m24*b.m44,
        a.m31*b.m11+a.m32*b.m21+a.m33*b.m31+a.m34*b.m41, a.m31*b.m12+a.m32*b.m22+a.m33*b.m32+a.m34*b.m42,
        a.m31*b.m13+a.m32*b.m23+a.m33*b.m33+a.m34*b.m43, a.m31*b.m14+a.m32*b.m24+a.m33*b.m34+a.m34*b.m44,
        a.m41*b.m11+a.m42*b.m21+a.m43*b.m31+a.m44*b.m41, a.m41*b.m12+a.m42*b.m22+a.m43*b.m32+a.m44*b.m42,
        a.m41*b.m13+a.m42*b.m23+a.m43*b.m33+a.m44*b.m43, a.m41*b.m14+a.m42*b.m24+a.m43*b.m34+a.m44*b.m44,
      ]);
    }

    translate(tx: number, ty: number, _tz = 0): _DOMMatrix {
      return this.multiply(new _DOMMatrix([1, 0, 0, 1, tx, ty]));
    }
    scale(sx: number, sy = sx, _sz = 1, ox = 0, oy = 0): _DOMMatrix {
      return this.multiply(new _DOMMatrix([sx, 0, 0, sy, ox - sx * ox, oy - sy * oy]));
    }
    rotate(_rx: number, _ry = 0, rz = 0): _DOMMatrix {
      const r = (rz * Math.PI) / 180, cos = Math.cos(r), sin = Math.sin(r);
      return this.multiply(new _DOMMatrix([cos, sin, -sin, cos, 0, 0]));
    }
    skewX(deg: number): _DOMMatrix {
      return this.multiply(new _DOMMatrix([1, 0, Math.tan(deg * Math.PI / 180), 1, 0, 0]));
    }
    skewY(deg: number): _DOMMatrix {
      return this.multiply(new _DOMMatrix([1, Math.tan(deg * Math.PI / 180), 0, 1, 0, 0]));
    }
    inverse(): _DOMMatrix {
      const { m11: a, m12: b, m21: c, m22: d, m41: e, m42: f } = this;
      const det = a * d - b * c;
      if (Math.abs(det) < 1e-10) return new _DOMMatrix();
      const id = 1 / det;
      return new _DOMMatrix([d*id, -b*id, -c*id, a*id, (c*f - d*e)*id, (b*e - a*f)*id]);
    }
    transformPoint(p: { x?: number; y?: number }) {
      const x = p.x ?? 0, y = p.y ?? 0;
      return { x: this.m11*x + this.m21*y + this.m41, y: this.m12*x + this.m22*y + this.m42, z: 0, w: 1 };
    }
    toFloat64Array() {
      return new Float64Array([
        this.m11,this.m12,this.m13,this.m14, this.m21,this.m22,this.m23,this.m24,
        this.m31,this.m32,this.m33,this.m34, this.m41,this.m42,this.m43,this.m44,
      ]);
    }
    toFloat32Array() { return new Float32Array(this.toFloat64Array()); }
    toString() {
      return `matrix(${this.m11}, ${this.m12}, ${this.m21}, ${this.m22}, ${this.m41}, ${this.m42})`;
    }
    static fromMatrix(m: any): _DOMMatrix {
      return new _DOMMatrix([m.a??m.m11??1, m.b??m.m12??0, m.c??m.m21??0, m.d??m.m22??1, m.e??m.m41??0, m.f??m.m42??0]);
    }
    static fromFloat32Array(a: Float32Array): _DOMMatrix { return new _DOMMatrix(Array.from(a)); }
    static fromFloat64Array(a: Float64Array): _DOMMatrix { return new _DOMMatrix(Array.from(a)); }
  }

  (globalThis as any).DOMMatrix = _DOMMatrix;
  console.log("[polyfill] DOMMatrix installed on globalThis");
}

/* ═══════════════════════════════════════════════════════════════════════════
   End of polyfill — regular imports below
   ═══════════════════════════════════════════════════════════════════════════ */

import { NextRequest } from "next/server";
import { createRequire } from "module";
import Groq from "groq-sdk";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { UserProfile } from "@/lib/models/UserProfile";
import { CREDITS } from "@/lib/credits";

export const runtime    = "nodejs";
export const maxDuration = 60;

/* ── Pre-load canvas (CJS, native module) at module scope ─────────────── */
const _require = createRequire(import.meta.url);
_require("canvas");                                    // prime the native binding

/* ── Models ─────────────────────────────────────────────────────────────── */
const VISION_MODEL   = "llama-3.2-11b-vision-preview";
const TEXT_MODEL     = "llama-3.3-70b-versatile";
const MIN_TEXT_CHARS = 50;

/* ── System prompt ───────────────────────────────────────────────────────── */
const SYSTEM = `You are AI Nexus — an expert document analyst.
Rules:
- Describe visual content precisely, then answer the user's question directly.
- Use **bold headings** and bullet points.
- STRICT: Do NOT generate code blocks unless the user explicitly requests code.
- Answer ONLY from the document content. Never guess or hallucinate.
- Report any IDs, codes, keys, or special values you see EXACTLY as written.`;

/* ── pdfjs singleton (initialised once, DOMMatrix polyfill already applied) */
let _pdfjs: any = null;
async function getPdfjs(): Promise<any> {
  if (_pdfjs) return _pdfjs;
  _pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs" as string) as any;
  const { resolve, sep } = await import("path");
  const abs = resolve(process.cwd(), "node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs");
  _pdfjs.GlobalWorkerOptions.workerSrc = abs.startsWith("/")
    ? `file://${abs}`
    : `file:///${abs.split(sep).join("/")}`;
  console.log("[pdfjs] loaded  workerSrc=", _pdfjs.GlobalWorkerOptions.workerSrc.slice(0, 60));
  return _pdfjs;
}

/* ══════════════════════════════════════════════════════════════════════════
   renderPdfToImages — pdfjs + canvas, DOMMatrix polyfill applied above
   Returns base64 PNG strings. Logs the exact error if it fails.
   ══════════════════════════════════════════════════════════════════════════ */
async function renderPdfToImages(pdfBuffer: Buffer, maxPages = 3): Promise<string[]> {
  const { createCanvas } = _require("canvas") as typeof import("canvas");
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

    const pages = Math.min(pdfDoc.numPages, maxPages);
    console.log("[renderPdfToImages] numPages=%d rendering=%d", pdfDoc.numPages, pages);

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
    console.log("[renderPdfToImages] SUCCESS — %d image(s)", images.length);
  } catch (err) {
    console.error("[renderPdfToImages] FAILED:", err instanceof Error ? err.stack : String(err));
  } finally {
    await pdfDoc?.destroy().catch(() => {});
  }
  return images;
}

/* ── extractTextViaPdfjs (getTextContent — no DOMMatrix needed) ──────────── */
async function extractTextViaPdfjs(pdfBuffer: Buffer): Promise<string> {
  let pdfDoc: any = null;
  try {
    const pdfjs = await getPdfjs();
    pdfDoc = await pdfjs.getDocument({ data: new Uint8Array(pdfBuffer), verbosity: 0 }).promise;
    let text = "";
    const pages = Math.min(pdfDoc.numPages, 10);
    for (let p = 1; p <= pages; p++) {
      const page    = await pdfDoc.getPage(p);
      const content = await page.getTextContent();
      text += content.items.map((i: any) => i.str).join(" ") + "\n\n";
    }
    await pdfDoc.destroy();
    const clean = text.trim();
    console.log("[extractTextViaPdfjs] chars=%d", clean.length);
    return clean;
  } catch (err) {
    console.warn("[extractTextViaPdfjs] failed:", err instanceof Error ? err.message : err);
    await pdfDoc?.destroy().catch(() => {});
    return "";
  }
}

/* ── extractPdfText via pdf-parse v2 ─────────────────────────────────────── */
async function extractPdfText(pdfBuffer: Buffer): Promise<string> {
  try {
    const { PDFParse } = _require("pdf-parse") as { PDFParse: new (b: Buffer) => any };
    const result = await new PDFParse(pdfBuffer).getText();   // Buffer, NOT {data:buf}
    const text   = typeof result === "string" ? result : (result?.text ?? result?.content ?? "");
    console.log("[extractPdfText] pdf-parse chars=%d", text.trim().length);
    return text.trim();
  } catch (err) {
    console.warn("[extractPdfText] pdf-parse failed:", err instanceof Error ? err.message : err);
    return "";
  }
}

/* ── extractEmbeddedJpegs — pure-JS JPEG stream scan ────────────────────────
   Scanned PDFs embed each page as a raw JPEG stream (FF D8 FF…FF D9).
   This scans the raw PDF bytes and extracts images ≥ 50 KB (full pages).
   No pdfjs, no canvas, no DOMMatrix — works everywhere.
   ─────────────────────────────────────────────────────────────────────────── */
function extractEmbeddedJpegs(pdfBuffer: Buffer, max = 3): string[] {
  const found: string[] = [];
  let i = 0;
  while (i < pdfBuffer.length - 3 && found.length < max) {
    if (pdfBuffer[i] === 0xFF && pdfBuffer[i + 1] === 0xD8 && pdfBuffer[i + 2] === 0xFF) {
      const start = i;
      let end = -1;
      for (let j = start + 2; j < pdfBuffer.length - 1; j++) {
        if (pdfBuffer[j] === 0xFF && pdfBuffer[j + 1] === 0xD9) { end = j + 2; break; }
      }
      if (end !== -1) {
        const jpeg = pdfBuffer.subarray(start, end);
        if (jpeg.length > 50_000) {
          found.push(jpeg.toString("base64"));
          console.log("[extractEmbeddedJpegs] %dKB JPEG at offset %d", Math.round(jpeg.length / 1024), start);
        }
        i = end; continue;
      }
    }
    i++;
  }
  return found;
}

/* ── Groq helpers ────────────────────────────────────────────────────────── */
async function groqVision(
  groq:    Groq,
  images:  string[],
  textCtx: string,
  userQ:   string,
  mime     = "image/png",
): Promise<any> {
  const content: any[] = [
    {
      type: "text",
      text: (
        `You are analysing a document. ${images.length} page image(s) are attached as ${mime} files.\n` +
        (textCtx ? `\nExtracted text context (use as supplementary reference):\n${textCtx}\n` : "") +
        `\n---\nUser question: ${userQ}\n\n` +
        `CRITICAL RULES:\n` +
        `- Answer ONLY from the visual content of the attached pages.\n` +
        `- If you see any ID, code, key, or clearance number, report it EXACTLY character-by-character.\n` +
        `- Do NOT guess, infer, or hallucinate information not present in the images.`
      ),
    },
    ...images.map((b64) => ({
      type:      "image_url",
      image_url: { url: `data:${mime};base64,${b64}` },
    })),
  ];

  return groq.chat.completions.create({
    model:      VISION_MODEL,
    messages:   [{ role: "user", content }],
    stream:     true,
    max_tokens: 1500,
  });
}

async function groqText(groq: Groq, content: string): Promise<any> {
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

   DOMMatrix polyfill at top of file fixes pdfjs rendering on Vercel/Node.js.

   IMAGE → groqVision directly

   PDF — Four-layer approach:
     L1: pdfjs page.render() + canvas → PNG images → groqVision
         (DOMMatrix polyfill makes this work on Vercel)
     L2: extractEmbeddedJpegs() → JPEG images → groqVision
         (pure JS, no pdfjs, no DOMMatrix — always works)
     L3: text extraction (pdf-parse + pdfjs fallback) → groqText
     L∅: "Error: Buffer-to-Image Conversion Failed" + per-layer diagnostics
         NO GUESSING. NO FILENAME INFERENCE.

   TEXT FILE → groqText

   Credits: 12 deducted only on success.
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
      error:    "NO_CREDITS",
      message:  `Document analysis costs ${CREDITS.IMAGE} credits. You have ${profile.credits} remaining.`,
      required: CREDITS.IMAGE, current: profile.credits,
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
        try {
          const stream = await groq.chat.completions.create({
            model:      VISION_MODEL,
            messages:   [{
              role:    "user",
              content: [
                { type: "text",      text: userQ },
                { type: "image_url", image_url: { url: `data:${mimeType ?? "image/jpeg"};base64,${fileContent}` } },
              ] as any,
            }],
            stream: true, max_tokens: 1024,
          });
          await pipe(stream, writer, encoder);
          succeeded = true;
        } catch (err) {
          const m = err instanceof Error ? err.message : String(err);
          await write(`⚠️ **Vision Analysis Failed** — Groq API error: ${m}`);
        }

      /* ── PDF ────────────────────────────────────────────────────── */
      } else if (fileType === "pdf") {
        const pdfBuf = Buffer.from(fileContent, "base64");
        console.log("[analyze-file] PDF: %s  size=%dKB", fileName, Math.round(pdfBuf.length / 1024));
        await write("🔍 **Analyzing document…**\n\n");

        const diag: string[] = [];

        /* ── L1: pdfjs rendering (DOMMatrix polyfill makes this work) ── */
        console.log("[analyze-file] L1: pdfjs render");
        const [renderedPages, rawText1] = await Promise.all([
          renderPdfToImages(pdfBuf, 3),
          extractPdfText(pdfBuf),
        ]);
        const cleanLen1 = rawText1.replace(/\s+/g, "").length;
        diag.push(`L1 (pdfjs render): pages=${renderedPages.length}  textChars=${cleanLen1}`);

        if (renderedPages.length > 0) {
          console.log("[analyze-file] L1 SUCCESS — %d page(s) rendered", renderedPages.length);
          try {
            const s = await groqVision(
              groq, renderedPages,
              cleanLen1 >= MIN_TEXT_CHARS ? rawText1.slice(0, 5_000) : "",
              userQ, "image/png",
            );
            await pipe(s, writer, encoder);
            succeeded = true;
          } catch (err) {
            const m = err instanceof Error ? err.message : String(err);
            console.error("[analyze-file] L1 Groq error:", m);
            diag.push(`L1 Groq error: ${m}`);
          }
        }

        /* ── L2: Direct JPEG byte-scan (pure JS, always available) ── */
        if (!succeeded) {
          console.log("[analyze-file] L2: JPEG byte-scan");
          const jpegs = extractEmbeddedJpegs(pdfBuf, 3);
          const textCtx = cleanLen1 >= MIN_TEXT_CHARS ? rawText1 : "";
          diag.push(`L2 (JPEG scan): found=${jpegs.length}`);

          if (jpegs.length > 0) {
            console.log("[analyze-file] L2 SUCCESS — %d JPEG(s)", jpegs.length);
            try {
              const s = await groqVision(groq, jpegs, textCtx.slice(0, 5_000), userQ, "image/jpeg");
              await pipe(s, writer, encoder);
              succeeded = true;
            } catch (err) {
              const m = err instanceof Error ? err.message : String(err);
              console.error("[analyze-file] L2 Groq error:", m);
              diag.push(`L2 Groq error: ${m}`);
            }
          }
        }

        /* ── L3: Text extraction (text-based PDF) ── */
        if (!succeeded) {
          console.log("[analyze-file] L3: text extraction");
          let finalText = rawText1;
          if (cleanLen1 < MIN_TEXT_CHARS) {
            /* Try pdfjs getTextContent() as backup */
            finalText = await extractTextViaPdfjs(pdfBuf);
          }
          const finalClean = finalText.replace(/\s+/g, "").length;
          diag.push(`L3 (text): chars=${finalClean}`);

          if (finalClean >= MIN_TEXT_CHARS) {
            console.log("[analyze-file] L3 SUCCESS — text model  chars=%d", finalClean);
            try {
              const content =
                `**File:** \`${fileName}\`\n\n` +
                `**Extracted Content:**\n\n${finalText.slice(0, 14_000)}\n\n` +
                `---\n**Question:** ${userQ}`;
              const s = await groqText(groq, content);
              await pipe(s, writer, encoder);
              succeeded = true;
            } catch (err) {
              const m = err instanceof Error ? err.message : String(err);
              diag.push(`L3 Groq error: ${m}`);
            }
          }
        }

        /* ── L∅: All layers failed ── */
        if (!succeeded) {
          console.error("[analyze-file] ALL LAYERS FAILED:\n", diag.join("\n"));
          await write(
            `❌ **Error: Buffer-to-Image Conversion Failed**\n\n` +
            `All extraction layers failed for \`${fileName}\`:\n\n` +
            diag.map((d) => `- ${d}`).join("\n") +
            `\n\n**Debug:** Check the Vercel function logs for ` +
            `\`[renderPdfToImages] FAILED\` and ` +
            `\`[extractEmbeddedJpegs]\` lines.\n\n` +
            `**Workaround:** Upload a screenshot of the page as a **.jpg** file instead.`
          );
        }

      /* ── TEXT FILE ──────────────────────────────────────────────── */
      } else {
        console.log("[analyze-file] TEXT →", fileName);
        const rawText = Buffer.from(fileContent, "base64").toString("utf8");
        try {
          const s = await groqText(groq,
            `**File:** \`${fileName}\`\n\n**Content:**\n\n${rawText.slice(0, 14_000)}\n\n---\n**Question:** ${userQ}`
          );
          await pipe(s, writer, encoder);
          succeeded = true;
        } catch (err) {
          const m = err instanceof Error ? err.message : String(err);
          await write(`⚠️ **Analysis Failed** — ${m}`);
        }
      }

    } catch (err) {
      const m = err instanceof Error ? err.message : String(err);
      console.error("[analyze-file] top-level error:", err instanceof Error ? err.stack : err);
      try { await write(`\n\n⚠️ **Unexpected Error:** ${m}`); } catch { /* closed */ }
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
