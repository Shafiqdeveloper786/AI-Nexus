import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { UserProfile } from "@/lib/models/UserProfile";
import { Chat } from "@/lib/models/Chat";
import { Asset } from "@/lib/models/Asset";
import { requireSession } from "@/lib/session";

export const runtime = "nodejs";

/* ── GET /api/user/export ─────────────────────────────────────────────────────
   Returns a JSON blob containing:
   - Profile info (no passwords or secrets)
   - Last 50 chat sessions with messages
   - Last 30 generated images (metadata only, no raw base-64 payload)
   - Last 20 generated resumes (full markdown content)
   - Last 20 code generations (full markdown content)
   ─────────────────────────────────────────────────────────────────────────── */
export async function GET() {
  const session = await requireSession();
  if (session instanceof NextResponse) return session;
  const { email } = session;

  try {
    await connectDB();

    const [profile, chats, assets] = await Promise.all([
      UserProfile.findOne({ email }).lean(),
      Chat.find({ userEmail: email }, {}, { sort: { updatedAt: -1 }, limit: 50 }).lean(),
      Asset.find({ userEmail: email }, {}, { sort: { createdAt: -1 }, limit: 70 }).lean(),
    ]);

    if (!profile) {
      return NextResponse.json({ error: "Profile not found." }, { status: 404 });
    }

    const p = profile as any;
    const exportData = {
      exportedAt:   new Date().toISOString(),
      exportVersion: "1.0",

      profile: {
        email:          p.email,
        name:           p.name,
        subscription:   p.subscription,
        credits:        p.credits,
        totalChats:     p.totalChats,
        totalTokens:    p.totalTokens,
        createdAt:      p.createdAt,
      },

      chats: (chats as any[]).map((c) => ({
        id:        c._id.toString(),
        title:     c.title,
        tool:      c.tool,
        model:     c.llmModel,
        messages:  (c.messages ?? []).map((m: any) => ({
          role:      m.role,
          content:   m.content,
          createdAt: m.createdAt,
        })),
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
      })),

      /* Images: metadata only (raw base-64 can be 100 KB+, skip it) */
      images: (assets as any[])
        .filter((a) => a.type === "image")
        .slice(0, 30)
        .map((a) => ({
          id:        a._id.toString(),
          prompt:    a.prompt,
          model:     a.llmModel,
          metadata:  a.metadata,
          createdAt: a.createdAt,
        })),

      resumes: (assets as any[])
        .filter((a) => a.type === "resume")
        .slice(0, 20)
        .map((a) => ({
          id:        a._id.toString(),
          title:     a.prompt,
          content:   a.content,
          createdAt: a.createdAt,
        })),

      code: (assets as any[])
        .filter((a) => a.type === "code")
        .slice(0, 20)
        .map((a) => ({
          id:        a._id.toString(),
          prompt:    a.prompt,
          language:  a.llmModel,
          content:   a.content,
          createdAt: a.createdAt,
        })),
    };

    const fileName = `ai-nexus-export-${email.split("@")[0]}-${new Date().toISOString().slice(0, 10)}.json`;

    return new NextResponse(JSON.stringify(exportData, null, 2), {
      headers: {
        "Content-Type":        "application/json",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: "Export failed.", detail: msg }, { status: 500 });
  }
}
