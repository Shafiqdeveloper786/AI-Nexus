import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { UserProfile } from "@/lib/models/UserProfile";
import { requireSession } from "@/lib/session";

export const runtime = "nodejs";

const TAG = "[/api/user/profile]";

/* ── GET /api/user/profile ─────────────────────────────── */
export async function GET() {
  /* 1. Auth */
  const session = await requireSession();
  if (session instanceof NextResponse) {
    console.warn(`${TAG} No session — 401`);
    return session;
  }
  const { email, name, image } = session;
  console.log(`${TAG} GET  email=${email}`);

  try {
    /* 2. DB */
    await connectDB();
    console.log(`[DB] Connected for profile GET`);

    /* 3. Fetch-or-create profile */
    const profile = await (UserProfile as any).findOrCreate(email, name);

    /* 4. Sync name / image from the auth token (keeps Mongoose in sync) */
    const needsSync =
      (name  && profile.name  !== name)  ||
      (image && profile.image !== image);

    if (needsSync) {
      await UserProfile.updateOne(
        { email },
        { $set: { name: name ?? profile.name, image: image ?? profile.image } }
      );
      profile.name  = name  ?? profile.name;
      profile.image = image ?? profile.image;
      console.log(`${TAG} Synced name/image for ${email}`);
    }

    /* Compute effective daily image count — reset if 24h window has elapsed */
    const DAILY_RESET_HOURS = 24;
    const elapsed = profile.dailyLimitResetAt
      ? (Date.now() - new Date(profile.dailyLimitResetAt).getTime()) / 3_600_000
      : DAILY_RESET_HOURS + 1;
    const dailyImageCount = elapsed >= DAILY_RESET_HOURS ? 0 : (profile.dailyImageCount ?? 0);

    return NextResponse.json({
      email:              profile.email,
      name:               profile.name,
      image:              profile.image              ?? null,
      credits:            profile.credits,
      subscription:       profile.subscription,
      subscriptionEndsAt: profile.subscriptionEndsAt?.toISOString() ?? null,
      totalChats:         profile.totalChats,
      totalTokens:        profile.totalTokens,
      dailyImageCount,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`${TAG} GET error:`, msg);
    return NextResponse.json(
      { error: "Failed to load profile.", detail: msg },
      { status: 500 }
    );
  }
}

/* ── PATCH /api/user/profile ───────────────────────────── */
export async function PATCH(req: NextRequest) {
  /* 1. Auth */
  const session = await requireSession();
  if (session instanceof NextResponse) return session;
  const { email } = session;
  console.log(`${TAG} PATCH  email=${email}`);

  let body: { name?: string; image?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  /* 2. Allowed fields — email is NEVER updatable */
  const updates: Record<string, string> = {};

  if (typeof body.name === "string") {
    const trimmed = body.name.trim();
    if (trimmed.length < 2)
      return NextResponse.json(
        { error: "Name must be at least 2 characters." },
        { status: 400 }
      );
    updates.name = trimmed;
  }
  if (typeof body.image === "string") {
    updates.image = body.image;
  }
  /* Silently ignore any 'email' field even if the client sends it */

  if (!Object.keys(updates).length)
    return NextResponse.json({ error: "No valid fields to update." }, { status: 400 });

  try {
    await connectDB();

    const profile = await UserProfile.findOneAndUpdate(
      { email },
      { $set: updates },
      { new: true, upsert: false }
    );

    if (!profile)
      return NextResponse.json({ error: "Profile not found." }, { status: 404 });

    console.log(`${TAG} Updated  email=${email}  fields=${Object.keys(updates).join(",")}`);
    return NextResponse.json({
      success: true,
      name:  profile.name,
      image: profile.image ?? null,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`${TAG} PATCH error:`, msg);
    return NextResponse.json({ error: "Failed to update profile.", detail: msg }, { status: 500 });
  }
}
