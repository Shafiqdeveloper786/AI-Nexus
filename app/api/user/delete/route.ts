import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { UserProfile } from "@/lib/models/UserProfile";
import { requireSession } from "@/lib/session";

export const runtime = "nodejs";

const TAG = "[/api/user/delete]";

/* ── POST /api/user/delete ────────────────────────────────────────────────────
   Soft-deletes the account: sets isDeleting + deletionDate = now + 30 days.
   Does NOT remove any data. A background job (or manual admin process) purges
   accounts whose deletionDate has passed.
   ─────────────────────────────────────────────────────────────────────────── */
export async function POST() {
  const session = await requireSession();
  if (session instanceof NextResponse) return session;
  const { email } = session;

  try {
    await connectDB();

    const deletionDate = new Date();
    deletionDate.setDate(deletionDate.getDate() + 30);

    await UserProfile.updateOne(
      { email },
      { $set: { isDeleting: true, deletionDate } }
    );

    console.log(TAG, "Soft-delete initiated  email=%s  deletionDate=%s", email, deletionDate.toISOString());
    return NextResponse.json({
      success:      true,
      deletionDate: deletionDate.toISOString(),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(TAG, "Error:", msg);
    return NextResponse.json({ error: "Failed to initiate deletion.", detail: msg }, { status: 500 });
  }
}

/* ── DELETE /api/user/delete ──────────────────────────────────────────────────
   Cancels a pending soft-delete (user logs back in within 30 days).
   ─────────────────────────────────────────────────────────────────────────── */
export async function DELETE() {
  const session = await requireSession();
  if (session instanceof NextResponse) return session;
  const { email } = session;

  try {
    await connectDB();
    await UserProfile.updateOne(
      { email },
      { $unset: { isDeleting: "", deletionDate: "" } }
    );
    console.log(TAG, "Deletion cancelled  email=%s", email);
    return NextResponse.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: "Failed to cancel deletion.", detail: msg }, { status: 500 });
  }
}
