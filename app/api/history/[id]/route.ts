import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Chat } from "@/lib/models/Chat";
import { Asset } from "@/lib/models/Asset";
import { requireSession } from "@/lib/session";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireSession();
  if (session instanceof NextResponse) return session;
  const { email } = session;

  const { id } = await params;
  if (!id) return NextResponse.json({ error: "ID required." }, { status: 400 });

  await connectDB();

  /* Try chat first */
  const chat = await Chat.findOne({ _id: id, userEmail: email }).lean();
  if (chat) {
    const c = chat as any;
    return NextResponse.json({
      kind:     "chat",
      id:       c._id.toString(),
      title:    c.title,
      tool:     c.tool,
      messages: (c.messages ?? []).map((m: any) => ({
        id:      m._id?.toString() ?? Date.now().toString(),
        role:    m.role,
        content: m.content,
        time:    new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      })),
    });
  }

  /* Try asset */
  const asset = await Asset.findOne({ _id: id, userEmail: email }).lean();
  if (asset) {
    const a = asset as any;
    return NextResponse.json({
      kind:        a.type,
      id:          a._id.toString(),
      title:       a.prompt ?? a.type,
      content:     a.content,
      contentType: a.contentType,
      metadata:    a.metadata,
    });
  }

  return NextResponse.json({ error: "Not found." }, { status: 404 });
}
