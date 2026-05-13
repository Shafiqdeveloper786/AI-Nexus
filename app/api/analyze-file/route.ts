/* ═══════════════════════════════════════════════════════════════════════════
   DOMMatrix polyfill — first statement in the file, before any imports.
   pdfjs-dist (used for text extraction) may reference DOMMatrix internally.
   Node.js does NOT expose it globally. The polyfill is lightweight and
   harmless when DOMMatrix already exists.
   ═══════════════════════════════════════════════════════════════════════════ */
if (typeof (globalThis as any).DOMMatrix === "undefined") {
  class _DOMMatrix {
    m11=1;m12=0;m13=0;m14=0; m21=0;m22=1;m23=0;m24=0;
    m31=0;m32=0;m33=1;m34=0; m41=0;m42=0;m43=0;m44=1;
    is2D=true; isIdentity=true;
    constructor(init?: number[]) {
      if (Array.isArray(init) && init.length === 6) {
        [this.m11,this.m12,this.m21,this.m22,this.m41,this.m42]=init;
        this.isIdentity=false;
      } else if (Array.isArray(init) && init.length === 16) {
        [this.m11,this.m12,this.m13,this.m14,this.m21,this.m22,this.m23,this.m24,
         this.m31,this.m32,this.m33,this.m34,this.m41,this.m42,this.m43,this.m44]=init;
        this.is2D=false; this.isIdentity=false;
      }
    }
    get a(){return this.m11;}set a(v:number){this.m11=v;}
    get b(){return this.m12;}set b(v:number){this.m12=v;}
    get c(){return this.m21;}set c(v:number){this.m21=v;}
    get d(){return this.m22;}set d(v:number){this.m22=v;}
    get e(){return this.m41;}set e(v:number){this.m41=v;}
    get f(){return this.m42;}set f(v:number){this.m42=v;}
    multiply(o:_DOMMatrix):_DOMMatrix{
      const[a,b]=[this,o];
      return new _DOMMatrix([
        a.m11*b.m11+a.m12*b.m21+a.m13*b.m31+a.m14*b.m41,a.m11*b.m12+a.m12*b.m22+a.m13*b.m32+a.m14*b.m42,
        a.m11*b.m13+a.m12*b.m23+a.m13*b.m33+a.m14*b.m43,a.m11*b.m14+a.m12*b.m24+a.m13*b.m34+a.m14*b.m44,
        a.m21*b.m11+a.m22*b.m21+a.m23*b.m31+a.m24*b.m41,a.m21*b.m12+a.m22*b.m22+a.m23*b.m32+a.m24*b.m42,
        a.m21*b.m13+a.m22*b.m23+a.m23*b.m33+a.m24*b.m43,a.m21*b.m14+a.m22*b.m24+a.m23*b.m34+a.m24*b.m44,
        a.m31*b.m11+a.m32*b.m21+a.m33*b.m31+a.m34*b.m41,a.m31*b.m12+a.m32*b.m22+a.m33*b.m32+a.m34*b.m42,
        a.m31*b.m13+a.m32*b.m23+a.m33*b.m33+a.m34*b.m43,a.m31*b.m14+a.m32*b.m24+a.m33*b.m34+a.m34*b.m44,
        a.m41*b.m11+a.m42*b.m21+a.m43*b.m31+a.m44*b.m41,a.m41*b.m12+a.m42*b.m22+a.m43*b.m32+a.m44*b.m42,
        a.m41*b.m13+a.m42*b.m23+a.m43*b.m33+a.m44*b.m43,a.m41*b.m14+a.m42*b.m24+a.m43*b.m34+a.m44*b.m44,
      ]);
    }
    translate(tx:number,ty:number):_DOMMatrix{return this.multiply(new _DOMMatrix([1,0,0,1,tx,ty]));}
    scale(sx:number,sy=sx):_DOMMatrix{return this.multiply(new _DOMMatrix([sx,0,0,sy,0,0]));}
    rotate(_rx:number,_ry=0,rz=0):_DOMMatrix{const r=rz*Math.PI/180,c=Math.cos(r),s=Math.sin(r);return this.multiply(new _DOMMatrix([c,s,-s,c,0,0]));}
    inverse():_DOMMatrix{
      const{m11:a,m12:b,m21:c,m22:d,m41:e,m42:f}=this,det=a*d-b*c;
      if(Math.abs(det)<1e-10)return new _DOMMatrix();
      const id=1/det;
      return new _DOMMatrix([d*id,-b*id,-c*id,a*id,(c*f-d*e)*id,(b*e-a*f)*id]);
    }
    transformPoint(p:{x?:number;y?:number}){
      const x=p.x??0,y=p.y??0;
      return{x:this.m11*x+this.m21*y+this.m41,y:this.m12*x+this.m22*y+this.m42,z:0,w:1};
    }
    toFloat64Array(){return new Float64Array([this.m11,this.m12,this.m13,this.m14,this.m21,this.m22,this.m23,this.m24,this.m31,this.m32,this.m33,this.m34,this.m41,this.m42,this.m43,this.m44]);}
    toFloat32Array(){return new Float32Array(this.toFloat64Array());}
    toString(){return`matrix(${this.m11},${this.m12},${this.m21},${this.m22},${this.m41},${this.m42})`;}
    static fromMatrix(m:any):_DOMMatrix{return new _DOMMatrix([m.a??m.m11??1,m.b??m.m12??0,m.c??m.m21??0,m.d??m.m22??1,m.e??m.m41??0,m.f??m.m42??0]);}
    static fromFloat32Array(a:Float32Array):_DOMMatrix{return new _DOMMatrix(Array.from(a));}
    static fromFloat64Array(a:Float64Array):_DOMMatrix{return new _DOMMatrix(Array.from(a));}
  }
  (globalThis as any).DOMMatrix = _DOMMatrix;
}

/* ═══════════════════════════════════════════════════════════════════════════
   Imports — after the polyfill so any dynamic pdfjs usage picks it up
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

const _require = createRequire(import.meta.url);

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
- Report any IDs, codes, clearance keys, or special values EXACTLY as written,
  character-by-character. Accuracy is critical.`;

/* ── mupdf singleton (ESM, top-level await — must use import()) ─────────── */
let _mupdf: any = null;
async function getMupdf(): Promise<any> {
  if (_mupdf) return _mupdf;
  /* mupdf is a pure-WASM ESM module — no native binaries, works on Vercel */
  _mupdf = await import("mupdf");
  console.log("[mupdf] WASM module loaded OK");
  return _mupdf;
}

/* ════════════════════════════════════════════════════════════════════════════
   renderPdfWithMupdf — PRIMARY renderer

   Uses MuPDF WebAssembly:  NO canvas, NO libcairo, NO DOMMatrix, NO pdfjs.
   Works identically on localhost, Docker, Vercel Lambda, AWS Lambda.

   Confirmed API (tested in Node 24):
     mupdf.Document.openDocument(buffer, "application/pdf")
     doc.countPages()
     doc.loadPage(i)                        ← 0-based
     page.toPixmap(matrix, colorspace, alpha, annots)
     pixmap.asPNG()                         ← Uint8Array
     mupdf.Matrix.scale(sx, sy)
     mupdf.ColorSpace.DeviceRGB
   ════════════════════════════════════════════════════════════════════════════ */
async function renderPdfWithMupdf(pdfBuffer: Buffer, maxPages = 3): Promise<string[]> {
  const images: string[] = [];
  let doc: any = null;

  try {
    const mupdf = await getMupdf();

    /* openDocument accepts Buffer / Uint8Array directly */
    doc = mupdf.Document.openDocument(pdfBuffer, "application/pdf");
    const total  = doc.countPages();
    const pages  = Math.min(total, maxPages);
    console.log("[mupdf] PDF: %d pages total — rendering %d", total, pages);

    for (let i = 0; i < pages; i++) {
      let page:   any = null;
      let pixmap: any = null;
      try {
        page   = doc.loadPage(i);
        /* Scale 2× for ~150 DPI (base is 72 DPI) */
        pixmap = page.toPixmap(
          mupdf.Matrix.scale(2, 2),
          mupdf.ColorSpace.DeviceRGB,
          false,   // no alpha channel
          true,    // include annotations
        );
        const png = pixmap.asPNG();                 // Uint8Array
        const b64 = Buffer.from(png).toString("base64");
        images.push(b64);
        console.log("[mupdf] page %d → %dKB PNG", i + 1, Math.round(b64.length * 0.75 / 1024));
      } finally {
        pixmap?.destroy();
        page?.destroy();
      }
    }
    console.log("[mupdf] SUCCESS — %d image(s) produced", images.length);
  } catch (err) {
    /* Full stack so Vercel logs show the real cause */
    console.error("[mupdf] RENDER FAILED:\n", err instanceof Error ? err.stack : String(err));
  } finally {
    doc?.destroy();
  }

  return images;
}

/* ── extractPdfText — pdf-parse v2 (correct constructor: Buffer, not {data}) */
async function extractPdfText(pdfBuffer: Buffer): Promise<string> {
  try {
    const { PDFParse } = _require("pdf-parse") as { PDFParse: new (b: Buffer) => any };
    const result = await new PDFParse(pdfBuffer).getText();
    const text   = typeof result === "string" ? result : (result?.text ?? result?.content ?? "");
    console.log("[pdf-parse] getText → %d chars", text.trim().length);
    return text.trim();
  } catch (err) {
    console.warn("[pdf-parse] failed:", err instanceof Error ? err.message : err);
    return "";
  }
}

/* ── extractTextViaPdfjs — fallback text extraction (no canvas, no render) ─ */
async function extractTextViaPdfjs(pdfBuffer: Buffer): Promise<string> {
  let pdfDoc: any = null;
  try {
    const pdfjs   = await import("pdfjs-dist/legacy/build/pdf.mjs" as string) as any;
    const { resolve, sep } = await import("path");
    const abs = resolve(process.cwd(), "node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs");
    pdfjs.GlobalWorkerOptions.workerSrc = abs.startsWith("/")
      ? `file://${abs}` : `file:///${abs.split(sep).join("/")}`;
    pdfDoc = await pdfjs.getDocument({ data: new Uint8Array(pdfBuffer), verbosity: 0 }).promise;
    let text = "";
    for (let p = 1; p <= Math.min(pdfDoc.numPages, 10); p++) {
      const page    = await pdfDoc.getPage(p);
      const content = await page.getTextContent();
      text += content.items.map((i: any) => i.str).join(" ") + "\n\n";
    }
    await pdfDoc.destroy();
    console.log("[pdfjs] getTextContent → %d chars", text.trim().length);
    return text.trim();
  } catch (err) {
    console.warn("[pdfjs] text extraction failed:", err instanceof Error ? err.message : err);
    await pdfDoc?.destroy().catch(() => {});
    return "";
  }
}

/* ── extractEmbeddedJpegs — pure-JS JPEG stream scan ────────────────────────
   Many scanned PDFs store pages as raw JPEG byte streams (SOI=FF D8 FF…EOI=FF D9).
   This extracts them without pdfjs, mupdf, or canvas.
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
          console.log("[jpegScan] found %dKB JPEG at offset %d", Math.round(jpeg.length / 1024), start);
        }
        i = end; continue;
      }
    }
    i++;
  }
  return found;
}

/* ── Groq helpers ─────────────────────────────────────────────────────────── */
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
        `You are analysing a document. ${images.length} page(s) are attached as ${mime} images.\n` +
        (textCtx ? `\nExtracted text (supplementary context):\n${textCtx}\n` : "") +
        `\n---\nUser question: ${userQ}\n\n` +
        `CRITICAL: Answer ONLY from the visual content of the attached images.\n` +
        `If you see any Security Clearance ID, code, key, or special value — ` +
        `report it EXACTLY, character-by-character, without modification.`
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
   POST /api/analyze-file

   PRIMARY rendering: mupdf WebAssembly
   ─ Pure WASM, zero native OS dependencies
   ─ Works on Vercel, AWS Lambda, Docker — anywhere Node.js runs
   ─ No canvas, no libcairo, no DOMMatrix required

   PDF four-layer pipeline:
     L1 mupdf    → renders pages to PNG → groqVision  ← PRIMARY
     L2 jpegScan → finds embedded JPEGs → groqVision  ← scanned PDF backup
     L3 text     → pdf-parse / pdfjs    → groqText    ← digital PDF
     L∅           → "Deep Analysis in progress..." + per-layer diagnostics

   Credits: 12 deducted ONLY after successful stream completion.
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

  /* 5. Analysis pipeline */
  (async () => {
    let succeeded = false;

    try {
      /* ── IMAGE ──────────────────────────────────────────── */
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
          console.error("[analyze-file] Vision API error:", m);
          await write(`⚠️ **Vision Analysis Failed** — Groq API error: ${m}`);
        }

      /* ── PDF ────────────────────────────────────────────── */
      } else if (fileType === "pdf") {
        /* const buffer = Buffer.from(await file.arrayBuffer()) equivalent */
        const pdfBuf = Buffer.from(fileContent, "base64");
        console.log("[analyze-file] PDF → %s  size=%dKB", fileName, Math.round(pdfBuf.length / 1024));

        await write("🔍 **Deep Analysis in progress…**\n\n");

        const diag: string[] = [];

        /* ── L1: mupdf WASM rendering (primary, no native deps) ── */
        console.log("[analyze-file] L1: mupdf WASM render");
        const [mupdfPages, rawText] = await Promise.all([
          renderPdfWithMupdf(pdfBuf, 3),
          extractPdfText(pdfBuf),
        ]);
        const cleanLen = rawText.replace(/\s+/g, "").length;
        diag.push(`L1 (mupdf): pages=${mupdfPages.length}  textChars=${cleanLen}`);

        if (mupdfPages.length > 0) {
          console.log("[analyze-file] L1 SUCCESS — sending %d page(s) to Vision", mupdfPages.length);
          try {
            const s = await groqVision(
              groq, mupdfPages,
              cleanLen >= MIN_TEXT_CHARS ? rawText.slice(0, 5_000) : "",
              userQ, "image/png",
            );
            await pipe(s, writer, encoder);
            succeeded = true;
          } catch (err) {
            const m = err instanceof Error ? err.message : String(err);
            console.error("[analyze-file] L1 Groq Vision error:", m);
            diag.push(`L1 Groq error: ${m}`);
          }
        }

        /* ── L2: Embedded JPEG byte-scan (scanned PDF fallback) ── */
        if (!succeeded) {
          console.log("[analyze-file] L2: JPEG byte-scan");
          const jpegs = extractEmbeddedJpegs(pdfBuf, 3);
          diag.push(`L2 (jpegScan): found=${jpegs.length}`);

          if (jpegs.length > 0) {
            console.log("[analyze-file] L2 SUCCESS — %d JPEG(s)", jpegs.length);
            try {
              const textCtx = cleanLen >= MIN_TEXT_CHARS ? rawText.slice(0, 5_000) : "";
              const s = await groqVision(groq, jpegs, textCtx, userQ, "image/jpeg");
              await pipe(s, writer, encoder);
              succeeded = true;
            } catch (err) {
              const m = err instanceof Error ? err.message : String(err);
              console.error("[analyze-file] L2 Groq Vision error:", m);
              diag.push(`L2 Groq error: ${m}`);
            }
          }
        }

        /* ── L3: Text-only (text-based / digital PDF) ── */
        if (!succeeded) {
          console.log("[analyze-file] L3: text extraction");
          let finalText = rawText;
          if (cleanLen < MIN_TEXT_CHARS) {
            finalText = await extractTextViaPdfjs(pdfBuf);
          }
          const finalClean = finalText.replace(/\s+/g, "").length;
          diag.push(`L3 (text): chars=${finalClean}`);

          if (finalClean >= MIN_TEXT_CHARS) {
            console.log("[analyze-file] L3 SUCCESS — text model  chars=%d", finalClean);
            try {
              const s = await groqText(groq,
                `**File:** \`${fileName}\`\n\n` +
                `**Extracted Content:**\n\n${finalText.slice(0, 14_000)}\n\n` +
                `---\n**Question:** ${userQ}`
              );
              await pipe(s, writer, encoder);
              succeeded = true;
            } catch (err) {
              const m = err instanceof Error ? err.message : String(err);
              diag.push(`L3 Groq error: ${m}`);
            }
          }
        }

        /* ── L∅: All layers failed — diagnostic output ── */
        if (!succeeded) {
          console.error("[analyze-file] ALL LAYERS FAILED:\n" + diag.join("\n"));
          await write(
            `⚠️ **Deep Analysis Incomplete**\n\n` +
            `All extraction layers were attempted for \`${fileName}\` but none succeeded:\n\n` +
            diag.map((d) => `- ${d}`).join("\n") +
            `\n\n**Check Vercel logs** for \`[mupdf] RENDER FAILED\` and ` +
            `\`[analyze-file]\` stack traces.\n\n` +
            `**Workaround:** Upload a screenshot of the page as a **.jpg** file.`
          );
        }

      /* ── TEXT FILE ──────────────────────────────────────── */
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
