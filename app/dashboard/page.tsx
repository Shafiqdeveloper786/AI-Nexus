import { Suspense } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { UserProfile } from "@/lib/models/UserProfile";
import DashboardContent from "@/components/dashboard/DashboardContent";
import type { UserProfileData } from "@/hooks/useUserProfile";

/* ─── Server Component — runs on every request ──────────────────────────────
   1. Validates the JWT session server-side — hard redirects to /auth/login
      if missing (no client-side flash).
   2. Fetches the MongoDB UserProfile so Sidebar/TopNav render instantly with
      real Name, Email, and Credits instead of "Loading…".
   3. Falls back to JWT session data if the DB is unavailable.
   ─────────────────────────────────────────────────────────────────────────── */
export default async function DashboardPage() {
  /* ── 1. Auth ─────────────────────────────────────────── */
  console.log("[DASHBOARD] Checking auth session...");
  const session = await auth();

  if (!session?.user?.email) {
    console.log("[DASHBOARD] No session — redirecting to /auth/login");
    redirect("/auth/login");
  }

  const email = session.user.email;
  const name  = session.user.name  ?? email.split("@")[0];
  const image = session.user.image ?? null;
  console.log("[AUTH] Session found  email=", email);

  /* ── 2. Profile fetch — JWT fallback if DB is down ───── */
  let serverProfile: UserProfileData = {
    email,
    name,
    image,
    credits:            10,
    subscription:       "free",
    subscriptionEndsAt: null,
    totalChats:         0,
    totalTokens:        0,
    dailyImageCount:    0,
  };

  try {
    await connectDB();
    const profile = await (UserProfile as any).findOrCreate(email, name);
    serverProfile = {
      email:              profile.email,
      name:               profile.name,
      image:              profile.image              ?? null,
      credits:            profile.credits,
      subscription:       profile.subscription,
      subscriptionEndsAt: profile.subscriptionEndsAt?.toISOString() ?? null,
      totalChats:         profile.totalChats,
      totalTokens:        profile.totalTokens,
      dailyImageCount:    profile.dailyImageCount    ?? 0,
    };
    console.log(
      "[DB] Profile loaded  email=%s  credits=%d  plan=%s",
      email, profile.credits, profile.subscription
    );
  } catch (err) {
    console.error(
      "[DB] Server-side profile fetch failed — using JWT fallback:",
      err instanceof Error ? err.message : err
    );
  }

  /* ── 3. Render ───────────────────────────────────────── */
  return (
    <Suspense fallback={null}>
      <DashboardContent serverProfile={serverProfile} />
    </Suspense>
  );
}
