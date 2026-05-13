import { NextRequest, NextResponse } from "next/server";
import { HfInference } from "@huggingface/inference";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { Asset } from "@/lib/models/Asset";
import { UserProfile } from "@/lib/models/UserProfile";
import { CREDITS, DAILY_RESET_HOURS } from "@/lib/credits";

export const runtime    = "nodejs";
export const maxDuration = 60;

const HF_MODELS: Record<string, { id: string; steps: number; guidance: number }> = {
  flux: {
    id:       "black-forest-labs/FLUX.1-schnell",
    steps:    4,
    guidance: 0.0,
  },
  flux_dev: {
    id:       "black-forest-labs/FLUX.1-dev",
    steps:    20,
    guidance: 3.5,
  },
  sdxl: {
    id:       "stabilityai/stable-diffusion-xl-base-1.0",
    steps:    20,
    guidance: 7.5,
  },
  sd15: {
    id:       "runwayml/stable-diffusion-v1-5",
    steps:    20,
    guidance: 7.5,
  },
  sd2: {
    id:       "stabilityai/stable-diffusion-2-1",
    steps:    20,
    guidance: 7.5,
  },
};

const DEFAULT_MODEL = HF_MODELS.flux;

/* ── Fallback rotation when primary model is unavailable ─────────────────── */
const FALLBACK_ROTATION = [
  HF_MODELS.sdxl,
  HF_MODELS.sd15,
  HF_MODELS.sd2,
];

/* ── Shared daily-limit check / reset helper ─────────────────────────────── */
function checkAndResetDaily(
  count: number,
  limit: number,
  resetAt: Date | undefined
): { blocked: boolean; resetInHours: number; shouldReset: boolean } {
  const now      = Date.now();
  const elapsed  = resetAt ? (now - resetAt.getTime()) / 3_600_000 : DAILY_RESET_HOURS + 1;
  const expired  = elapsed >= DAILY_RESET_HOURS;

  if (expired) return { blocked: false, resetInHours: 0, shouldReset: true };
  if (count >= limit) {
    const resetInHours = Math.ceil(DAILY_RESET_HOURS - elapsed);
    return { blocked: true, resetInHours, shouldReset: false };
  }
  return { blocked: false, resetInHours: 0, shouldReset: false };
}

export async function POST(req: NextRequest) {
  /* ── 1. Auth ─────────────────────────────────────────────────────────── */
  const rawSession = await auth();
  if (!rawSession?.user?.email) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const email = rawSession.user.email;
  const name  = rawSession.user.name ?? email.split("@")[0];
  console.log("[AUTH] Image request  email=%s", email);

  /* ── 2. Parse body ───────────────────────────────────────────────────── */
  let body: { prompt?: string; model?: string; chatId?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON." }, { status: 400 }); }

  const { prompt = "", model = "flux", chatId } = body;
  if (!prompt.trim())
    return NextResponse.json({ error: "Prompt is required." }, { status: 400 });

  const modelConfig = HF_MODELS[model] ?? DEFAULT_MODEL;
  console.log("[AI] Model: %s  prompt: \"%s\"", modelConfig.id, prompt.slice(0, 60));

  /* ── 3. DB connection ────────────────────────────────────────────────── */
  try {
    await connectDB();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: "DB_CONNECTION_FAILED", message: msg }, { status: 503 });
  }

  /* ── 4. Load profile ─────────────────────────────────────────────────── */
  let profile: any;
  try {
    profile = await (UserProfile as any).findOrCreate(email, name);
    console.log("[DB] Profile  dailyImages=%d  plan=%s", profile.dailyImageCount, profile.subscription);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: "PROFILE_FETCH_FAILED", message: msg }, { status: 500 });
  }

  /* ── 5. Daily count limit (free tier) — checked FIRST ──────────────── */
  if (profile.subscription === "free") {
    const { blocked, resetInHours, shouldReset } = checkAndResetDaily(
      profile.dailyImageCount,
      CREDITS.DAILY_IMAGE_LIMIT,
      profile.dailyLimitResetAt
    );

    if (shouldReset) {
      await UserProfile.updateOne(
        { email },
        { $set: { dailyImageCount: 0, dailyLimitResetAt: new Date() } }
      );
      profile.dailyImageCount = 0;
    }

    if (blocked) {
      console.warn("[DB] %s hit daily image limit", email);
      return NextResponse.json(
        {
          error:        "DAILY_LIMIT_REACHED",
          message:      `Daily limit reached — ${CREDITS.DAILY_IMAGE_LIMIT} free images/day. Resets in ${resetInHours}h.`,
          resetInHours,
          limit:        CREDITS.DAILY_IMAGE_LIMIT,
          used:         profile.dailyImageCount,
        },
        { status: 429 }
      );
    }
  }

  /* ── 6. Credit check (free tier) ────────────────────────────────────── */
  if (profile.subscription === "free") {
    if (profile.credits < CREDITS.IMAGE) {
      console.warn("[DB] %s has %d credits — needs %d for image", email, profile.credits, CREDITS.IMAGE);
      return NextResponse.json(
        {
          error:    "NO_CREDITS",
          message:  `Image generation costs ${CREDITS.IMAGE} credits. You have ${profile.credits} remaining.`,
          required: CREDITS.IMAGE,
          current:  profile.credits,
        },
        { status: 403 }
      );
    }
  }

  /* ── 6. HF_TOKEN ─────────────────────────────────────────────────────── */
  const HF_TOKEN = process.env.HF_TOKEN;
  if (!HF_TOKEN) {
    return NextResponse.json(
      { error: "AI_NOT_CONFIGURED", message: "HF_TOKEN missing — add to .env.local and restart." },
      { status: 503 }
    );
  }

  /* ── 7. Generate image — try primary model, rotate on failure ───────── */
  const hf = new HfInference(HF_TOKEN);
  let imageResult: any;
  let usedModel = modelConfig;

  const tryGenerate = async (cfg: { id: string; steps: number; guidance: number }) => {
    console.log("[AI] Trying model=%s  steps=%d", cfg.id, cfg.steps);
    return hf.textToImage({
      model:  cfg.id,
      inputs: prompt,
      parameters: {
        num_inference_steps: cfg.steps,
        guidance_scale:      cfg.guidance,
      },
    });
  };

  /* Attempt primary model */
  try {
    imageResult = await tryGenerate(modelConfig);
    console.log("[AI] Primary model succeeded  type=%s", typeof imageResult);
  } catch (primaryErr: unknown) {
    const raw = (primaryErr instanceof Error ? primaryErr.message : String(primaryErr)).toLowerCase();
    console.warn("[AI] Primary model failed:", raw.slice(0, 120));

    /* Hard auth/token error — no point rotating */
    if (raw.includes("401") || raw.includes("403")) {
      return NextResponse.json({
        error:   "IMAGE_GENERATION_FAILED",
        message: "HF_TOKEN is invalid. Generate a new token at huggingface.co/settings/tokens.",
      }, { status: 502 });
    }

    /* Try fallback models in order */
    for (const fallback of FALLBACK_ROTATION) {
      if (fallback.id === modelConfig.id) continue; // already tried
      try {
        imageResult = await tryGenerate(fallback);
        usedModel   = fallback;
        console.log("[AI] Fallback succeeded  model=%s", fallback.id);
        break;
      } catch (fbErr) {
        console.warn("[AI] Fallback failed  model=%s  err=%s",
          fallback.id, (fbErr instanceof Error ? fbErr.message : String(fbErr)).slice(0, 80));
      }
    }

    /* ── Pollinations AI — tertiary fallback ─────────────────────────────── */
    if (!imageResult) {
      try {
        const encoded = encodeURIComponent(prompt.slice(0, 400));
        const pollinationsUrl =
          `https://image.pollinations.ai/prompt/${encoded}?width=768&height=768&nologo=true&model=flux`;
        console.log("[AI] Trying Pollinations fallback  url=%s", pollinationsUrl.slice(0, 80));
        const res = await fetch(pollinationsUrl, { signal: AbortSignal.timeout(45_000) });
        if (res.ok) {
          const ab = await res.arrayBuffer();
          imageResult = {
            _pollinations: true,
            buffer:        Buffer.from(ab),
            contentType:   res.headers.get("content-type") || "image/jpeg",
          };
          usedModel = { id: "pollinations/flux", steps: 0, guidance: 0 };
          console.log("[AI] Pollinations succeeded  size=%dKB",
            Math.round((imageResult as any).buffer.byteLength / 1024));
        } else {
          console.warn("[AI] Pollinations HTTP %d", res.status);
        }
      } catch (err) {
        console.warn("[AI] Pollinations failed:", err instanceof Error ? err.message : err);
      }
    }

    if (!imageResult) {
      /* Refund credits — nothing was generated */
      if (profile.subscription === "free") {
        await UserProfile.updateOne({ email }, { $inc: { credits: CREDITS.IMAGE } });
      }
      return NextResponse.json({
        error:   "HIGH_TRAFFIC",
        message: "High Traffic Alert: We are experiencing heavy load. Currently, no models are available to process your request. Please try again in a few minutes.",
      }, { status: 503 });
    }
  }

  if (!imageResult) {
    return NextResponse.json({ error: "IMAGE_GENERATION_FAILED", message: "Empty response." }, { status: 502 });
  }

  /* ── 8. Normalise → base-64 data URL ─────────────────────────────────── */
  let buffer: Buffer;
  let contentType: string;
  let dataUrl: string;

  if ((imageResult as any)._pollinations) {
    /* Pollinations already returned raw bytes */
    buffer      = (imageResult as any).buffer as Buffer;
    contentType = (imageResult as any).contentType as string;
    dataUrl     = `data:${contentType};base64,${buffer.toString("base64")}`;
  } else if (typeof imageResult === "string") {
    dataUrl     = imageResult.startsWith("data:") ? imageResult : `data:image/png;base64,${imageResult}`;
    buffer      = Buffer.from(dataUrl.split(",")[1] ?? imageResult, "base64");
    contentType = "image/png";
  } else {
    const arrayBuffer = await imageResult.arrayBuffer();
    buffer      = Buffer.from(arrayBuffer);
    contentType = imageResult.type || "image/png";
    dataUrl     = `data:${contentType};base64,${buffer.toString("base64")}`;
  }
  console.log("[AI] Image ready  size=%dKB  type=%s", Math.round(buffer.byteLength / 1024), contentType);

  /* ── 9. Save asset + increment daily count ───────────────────────────── */
  try {
    await Asset.create({
      userEmail:   email,
      type:        "image",
      prompt,
      tool:        "image",
      llmModel:    model,
      content:     dataUrl,
      contentType,
      metadata:    { hfModel: usedModel.id, sizeBytes: buffer.byteLength },
      chatId:      chatId ?? undefined,
    });

    /* Deduct IMAGE credits (free tier) + increment daily count */
    const update: Record<string, any> = { $inc: { dailyImageCount: 1 } };
    if (profile.subscription === "free") {
      update.$inc.credits = -CREDITS.IMAGE;
    }
    if (!profile.dailyLimitResetAt) {
      update.$set = { dailyLimitResetAt: new Date() };
    }
    await UserProfile.updateOne({ email }, update);
    console.log(
      "[DB] Asset saved — dailyImages+1, credits-%d for %s (remaining≈%d)",
      CREDITS.IMAGE, email, profile.credits - CREDITS.IMAGE
    );
  } catch (err) {
    console.error("[DB] Failed to save asset:", err);
  }

  return NextResponse.json({
    imageUrl: dataUrl,
    type:     "image",
    daily: {
      used:  profile.dailyImageCount + 1,
      limit: CREDITS.DAILY_IMAGE_LIMIT,
    },
  });
}
