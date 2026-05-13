import { NextRequest, NextResponse } from "next/server";
import Groq from "groq-sdk";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { UserProfile } from "@/lib/models/UserProfile";
import { Asset } from "@/lib/models/Asset";
import { CREDITS } from "@/lib/credits";

export const runtime    = "nodejs";
export const maxDuration = 60;

const SUPPORTED_LANGUAGES = [
  "typescript", "javascript", "python", "rust", "go", "java",
  "c", "cpp", "csharp", "sql", "html", "css", "bash", "other",
];

export async function POST(req: NextRequest) {
  /* ── 1. Auth ─────────────────────────────────────────────────────────── */
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const email = session.user.email;
  const name  = session.user.name ?? email.split("@")[0];
  console.log("[CODE] Request from", email);

  /* ── 2. Parse body ───────────────────────────────────────────────────── */
  let body: { prompt?: string; language?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const { prompt = "", language = "typescript" } = body;
  const lang = SUPPORTED_LANGUAGES.includes(language.toLowerCase())
    ? language.toLowerCase()
    : "typescript";

  if (!prompt.trim()) {
    return NextResponse.json({ error: "Prompt is required." }, { status: 400 });
  }

  /* ── 3. DB + credit check (costs 1) ──────────────────────────────────── */
  try {
    await connectDB();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: "DB_CONNECTION_FAILED", message: msg }, { status: 503 });
  }

  let profile: any;
  try {
    profile = await (UserProfile as any).findOrCreate(email, name);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: "PROFILE_FETCH_FAILED", message: msg }, { status: 500 });
  }

  if (profile.credits < CREDITS.CODE && profile.subscription === "free") {
    return NextResponse.json(
      {
        error:    "NO_CREDITS",
        message:  `Code generation costs ${CREDITS.CODE} credits. Upgrade to continue.`,
        required: CREDITS.CODE,
        current:  profile.credits,
      },
      { status: 403 }
    );
  }

  /* ── 4. Groq key ─────────────────────────────────────────────────────── */
  const groqKey = process.env.GROQ_API_KEY;
  if (!groqKey) {
    return NextResponse.json({ error: "AI_NOT_CONFIGURED" }, { status: 503 });
  }

  /* ── 5. Deduct credits pre-flight ────────────────────────────────────── */
  if (profile.subscription === "free") {
    await UserProfile.updateOne({ email }, { $inc: { credits: -CREDITS.CODE } });
    console.log("[CODE] Deducted %d credits from %s", CREDITS.CODE, email);
  }

  /* ── 6. Stream ───────────────────────────────────────────────────────── */
  const groq = new Groq({ apiKey: groqKey });

  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
  const writer  = writable.getWriter();
  const encoder = new TextEncoder();

  (async () => {
    let full = "";
    try {
      console.log("[CODE] Generating %s code for: %s", lang, prompt.slice(0, 60));
      const stream = await groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        messages: [
          {
            role: "system",
            content:
              `You are a senior software engineer specialising in ${lang}. ` +
              "Write clean, idiomatic, production-ready code. " +
              "Always respond with:\n" +
              "1. A brief explanation of what the code does and key design decisions.\n" +
              "2. The complete code in a fenced Markdown code block with the correct language tag.\n" +
              "3. Example usage or test cases where relevant.\n" +
              "Format everything in Markdown.",
          },
          { role: "user", content: prompt },
        ],
        stream:      true,
        max_tokens:  2048,
        temperature: 0.2,   // low temperature = precise, deterministic code
      });

      for await (const chunk of stream) {
        const text = chunk.choices[0]?.delta?.content ?? "";
        if (text) {
          full += text;
          await writer.write(encoder.encode(text));
        }
      }
      console.log("[CODE] Complete, chars=%d", full.length);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown Groq error";
      console.error("[CODE] Groq error:", msg);
      await writer.write(encoder.encode(`\n\n⚠️ **Error:** ${msg}`));
      if (profile.subscription === "free") {
        await UserProfile.updateOne({ email }, { $inc: { credits: CREDITS.CODE } });
      }
    } finally {
      await writer.close().catch(() => {});
      if (full && !full.includes("⚠️ **Error:**")) {
        const tokens = Math.ceil(full.length / 4);
        await UserProfile.updateOne({ email }, { $inc: { totalTokens: tokens } }).catch(() => {});
        /* Save to Asset collection for history */
        try {
          await Asset.create({
            userEmail:   email,
            type:        "code",
            prompt:      prompt.slice(0, 200),
            tool:        "code",
            llmModel:    lang,
            content:     full,
            contentType: "text/markdown",
            metadata:    { language: lang },
          });
          console.log("[DB] Code asset saved for %s", email);
        } catch { /* non-fatal */ }
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
