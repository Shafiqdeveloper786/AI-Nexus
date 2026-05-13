import { NextRequest, NextResponse } from "next/server";
import Groq from "groq-sdk";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { UserProfile } from "@/lib/models/UserProfile";
import { Asset } from "@/lib/models/Asset";
import { CREDITS, DAILY_RESET_HOURS } from "@/lib/credits";

export const runtime    = "nodejs";
export const maxDuration = 60;

function checkAndResetDaily(
  count: number,
  limit: number,
  resetAt: Date | undefined
): { blocked: boolean; resetInHours: number; shouldReset: boolean } {
  const now     = Date.now();
  const elapsed = resetAt ? (now - resetAt.getTime()) / 3_600_000 : DAILY_RESET_HOURS + 1;
  if (elapsed >= DAILY_RESET_HOURS)
    return { blocked: false, resetInHours: 0, shouldReset: true };
  if (count >= limit)
    return { blocked: true, resetInHours: Math.ceil(DAILY_RESET_HOURS - elapsed), shouldReset: false };
  return { blocked: false, resetInHours: 0, shouldReset: false };
}

export async function POST(req: NextRequest) {
  /* ── 1. Auth ─────────────────────────────────────────────────────────── */
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const email = session.user.email;
  const name  = session.user.name ?? email.split("@")[0];

  /* ── 2. Parse body ───────────────────────────────────────────────────── */
  let body: {
    fullName?: string; jobTitle?: string; email?: string; phone?: string;
    linkedin?: string; summary?: string; experience?: string;
    skills?: string;   education?: string;
  };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON." }, { status: 400 }); }

  if (!body.fullName?.trim() || !body.experience?.trim()) {
    return NextResponse.json(
      { error: "fullName and experience are required." },
      { status: 400 }
    );
  }

  /* ── 3. DB ───────────────────────────────────────────────────────────── */
  try { await connectDB(); }
  catch (err) {
    return NextResponse.json(
      { error: "DB_CONNECTION_FAILED", message: String(err) },
      { status: 503 }
    );
  }

  let profile: any;
  try { profile = await (UserProfile as any).findOrCreate(email, name); }
  catch (err) {
    return NextResponse.json(
      { error: "PROFILE_FETCH_FAILED", message: String(err) },
      { status: 500 }
    );
  }

  /* ── 4. Daily limit check (free tier) ───────────────────────────────── */
  if (profile.subscription === "free") {
    const { blocked, resetInHours, shouldReset } = checkAndResetDaily(
      profile.dailyResumeCount,
      CREDITS.DAILY_RESUME_LIMIT,
      profile.dailyLimitResetAt
    );

    if (shouldReset) {
      await UserProfile.updateOne(
        { email },
        { $set: { dailyResumeCount: 0, dailyLimitResetAt: new Date() } }
      );
      profile.dailyResumeCount = 0;
    }

    if (blocked) {
      console.warn("[RESUME] %s hit daily resume limit", email);
      return NextResponse.json(
        {
          error:        "DAILY_LIMIT_REACHED",
          message:      `Daily limit reached! Your ${CREDITS.DAILY_RESUME_LIMIT} free resumes will reset in ${resetInHours} hour${resetInHours !== 1 ? "s" : ""}.`,
          resetInHours,
          limit:        CREDITS.DAILY_RESUME_LIMIT,
          used:         profile.dailyResumeCount,
        },
        { status: 429 }
      );
    }
  }

  /* ── 5. Groq key ─────────────────────────────────────────────────────── */
  const groqKey = process.env.GROQ_API_KEY;
  if (!groqKey) {
    return NextResponse.json({ error: "AI_NOT_CONFIGURED", message: "GROQ_API_KEY missing." }, { status: 503 });
  }

  /* ── 6. Increment daily count immediately (before generation) ────────── */
  if (profile.subscription === "free") {
    await UserProfile.updateOne({ email }, {
      $inc: { dailyResumeCount: 1 },
      ...(!profile.dailyLimitResetAt && { $set: { dailyLimitResetAt: new Date() } }),
    });
    console.log("[RESUME] Daily count incremented for %s  count=%d", email, profile.dailyResumeCount + 1);
  }

  /* ── 7. Build enhanced prompt ────────────────────────────────────────── */
  const userPrompt = `Generate a highly professional, structured, and ATS-optimised resume in Markdown format for the following person:

**Personal Details**
- Name: ${body.fullName}
- Target Role: ${body.jobTitle || "Not specified"}
- Email: ${body.email || ""}
- Phone: ${body.phone || ""}
- LinkedIn/Portfolio: ${body.linkedin || ""}

**Summary Input:** ${body.summary || "Please write a compelling professional summary based on the experience below."}

**Work Experience:**
${body.experience}

**Skills:** ${body.skills || "Extract relevant skills from the experience above."}

**Education:** ${body.education || "Not provided"}

---

**FORMATTING REQUIREMENTS:**
- Use # for the full name (H1) followed by contact info on one line
- Use ## for each section (Summary, Experience, Skills, Education)
- Use ### for job titles within Experience
- Use **bold** for company names, dates, and key metrics
- Add a horizontal rule (---) between major sections
- For skills: group them into categories (e.g. **Languages:**, **Frameworks:**, **Tools:**)
- Quantify all achievements where possible (e.g. "Increased performance by 40%")
- Write 3-5 bullet points per role using strong action verbs
- Keep the tone professional, confident, and results-driven

Output ONLY the Markdown resume with no preamble or explanation.`.trim();

  /* ── 8. Stream response ──────────────────────────────────────────────── */
  const groq = new Groq({ apiKey: groqKey });
  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
  const writer  = writable.getWriter();
  const encoder = new TextEncoder();

  (async () => {
    let full = "";
    try {
      console.log("[RESUME] Calling Groq  email=%s", email);
      const stream = await groq.chat.completions.create({
        model:   "llama-3.3-70b-versatile",
        messages: [
          {
            role: "system",
            content:
              "You are an elite resume writer and career coach with 20 years of experience helping " +
              "professionals land their dream jobs at top companies. You write concise, impactful, " +
              "ATS-friendly resumes in clean Markdown. Every bullet point showcases measurable impact. " +
              "You NEVER use generic phrases like 'responsible for' — always use powerful action verbs.",
          },
          { role: "user", content: userPrompt },
        ],
        stream:      true,
        max_tokens:  2500,
        temperature: 0.35,
      });

      for await (const chunk of stream) {
        const text = chunk.choices[0]?.delta?.content ?? "";
        if (text) { full += text; await writer.write(encoder.encode(text)); }
      }
      console.log("[RESUME] Complete  chars=%d", full.length);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Groq error";
      console.error("[RESUME] Error:", msg);
      await writer.write(encoder.encode(`\n\n⚠️ Error: ${msg}`));
      /* Roll back the daily count increment on failure */
      if (profile.subscription === "free") {
        await UserProfile.updateOne({ email }, { $inc: { dailyResumeCount: -1 } }).catch(() => {});
      }
    } finally {
      await writer.close().catch(() => {});

      /* Save to Asset collection for history */
      if (full && !full.includes("⚠️ Error")) {
        try {
          await Asset.create({
            userEmail:   email,
            type:        "resume",
            prompt:      `${body.fullName} — ${body.jobTitle ?? "Resume"}`,
            tool:        "resume",
            llmModel:    "llama-3.3-70b-versatile",
            content:     full,
            contentType: "text/markdown",
            metadata:    { fullName: body.fullName, jobTitle: body.jobTitle },
          });
          const tokens = Math.ceil(full.length / 4);
          await UserProfile.updateOne({ email }, { $inc: { totalTokens: tokens } });
          console.log("[DB] Resume asset saved for %s", email);
        } catch (saveErr) {
          console.error("[DB] Failed to save resume asset:", saveErr);
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
