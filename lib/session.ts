import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  image?: string | null;
}

/**
 * Get the authenticated session user or return a 401 Response.
 * Usage:
 *   const result = await requireSession();
 *   if (result instanceof NextResponse) return result;
 *   const { email, name } = result;
 */
export async function requireSession(): Promise<SessionUser | NextResponse> {
  const session = await auth();

  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized — please sign in." }, { status: 401 });
  }

  return {
    id:    session.user.id   ?? "",
    email: session.user.email,
    name:  session.user.name ?? session.user.email.split("@")[0],
    image: session.user.image,
  };
}
