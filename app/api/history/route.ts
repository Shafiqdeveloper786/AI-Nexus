import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Chat } from "@/lib/models/Chat";
import { Asset } from "@/lib/models/Asset";
import { requireSession } from "@/lib/session";

export const runtime = "nodejs";

function relativeTime(date: Date): string {
  const diff  = Date.now() - date.getTime();
  const mins  = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days  = Math.floor(diff / 86_400_000);
  if (mins  <  1) return "just now";
  if (mins  < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days  <  7) return `${days}d ago`;
  return date.toLocaleDateString();
}

/* ── GET /api/history ────────────────────────────────────────────────────────
   Returns flat list for sidebar (default, ?view=sidebar)
   Returns categorised object for HistoryView (?view=full)
   ─────────────────────────────────────────────────────────────────────────── */
export async function GET(req: NextRequest) {
  const session = await requireSession();
  if (session instanceof NextResponse) return session;
  const { email } = session;

  const view = req.nextUrl.searchParams.get("view") ?? "sidebar";

  await connectDB();

  /* Always fetch both chats and assets */
  const [chats, assets] = await Promise.all([
    Chat.find(
      { userEmail: email },
      { title: 1, tool: 1, llmModel: 1, messages: { $slice: -1 }, updatedAt: 1 },
      { sort: { updatedAt: -1 }, limit: 50 }
    ).lean(),
    Asset.find(
      { userEmail: email },
      { type: 1, prompt: 1, tool: 1, llmModel: 1, content: 1, contentType: 1, metadata: 1, createdAt: 1 },
      { sort: { createdAt: -1 }, limit: 60 }
    ).lean(),
  ]);

  /* ── Sidebar mode — unified list: chats + code sessions + image assets ── */
  if (view === "sidebar") {
    const chatItems = (chats as any[]).map((c: any) => ({
      id:      c._id.toString(),
      kind:    c.tool === "code" ? "code" : "chat",
      title:   c.title,
      tool:    c.tool,
      model:   c.llmModel,
      preview: c.messages[0]?.content?.slice(0, 60) ?? "New conversation",
      time:    relativeTime(c.updatedAt as Date),
      ts:      (c.updatedAt as Date).getTime(),
    }));

    const imageItems = (assets as any[])
      .filter((a) => a.type === "image")
      .map((a: any) => ({
        id:      a._id.toString(),
        kind:    "image",
        title:   (a.prompt ?? "Generated image").slice(0, 55),
        tool:    "image",
        model:   a.llmModel,
        preview: a.prompt?.slice(0, 60) ?? "Image generation",
        time:    relativeTime(a.createdAt as Date),
        ts:      (a.createdAt as Date).getTime(),
      }));

    const unified = [...chatItems, ...imageItems]
      .sort((a, b) => b.ts - a.ts)
      .slice(0, 50)
      .map(({ ts: _ts, ...rest }) => rest); // strip internal sort key

    return NextResponse.json(unified);
  }

  /* ── Full mode — categorised for HistoryView ──────────────────────────── */
  const mapChat  = (c: any) => ({
    id:      c._id.toString(),
    kind:    "chat" as const,
    title:   c.title,
    tool:    c.tool,
    model:   c.llmModel,
    preview: (c.messages[0]?.content ?? "").slice(0, 80),
    time:    relativeTime(c.updatedAt as Date),
    ts:      (c.updatedAt as Date).getTime(),
  });

  const mapAsset = (a: any) => ({
    id:          a._id.toString(),
    kind:        a.type as "image" | "resume" | "code",
    title:       a.prompt ?? `${a.type} — ${relativeTime(a.createdAt as Date)}`,
    tool:        a.tool,
    model:       a.llmModel,
    preview:     a.type === "image"
                   ? a.content   // data URL — frontend shows thumbnail
                   : (a.content ?? "").slice(0, 80),
    content:     a.content,
    contentType: a.contentType,
    metadata:    a.metadata,
    time:        relativeTime(a.createdAt as Date),
    ts:          (a.createdAt as Date).getTime(),
  });

  const chatItems   = (chats as any[]).filter((c) => c.tool === "chat" || c.tool === "sql").map(mapChat);
  const codeChats   = (chats as any[]).filter((c) => c.tool === "code").map(mapChat);
  const imageAssets = (assets as any[]).filter((a) => a.type === "image").map(mapAsset);
  const resumeAssets= (assets as any[]).filter((a) => a.type === "resume").map(mapAsset);
  const codeAssets  = (assets as any[]).filter((a) => a.type === "code").map(mapAsset);

  /* Merge code chats + code assets, sorted by timestamp */
  const codeItems = [...codeChats, ...codeAssets]
    .sort((a, b) => b.ts - a.ts)
    .slice(0, 30);

  return NextResponse.json({
    chats:   chatItems,
    code:    codeItems,
    images:  imageAssets,
    resumes: resumeAssets,
  });
}

/* ── DELETE /api/history?id=chatId ───────────────────────────────────────── */
export async function DELETE(req: NextRequest) {
  const session = await requireSession();
  if (session instanceof NextResponse) return session;
  const { email } = session;

  const id   = req.nextUrl.searchParams.get("id");
  const type = req.nextUrl.searchParams.get("type") ?? "chat";

  if (!id) return NextResponse.json({ error: "ID required." }, { status: 400 });

  await connectDB();

  if (type === "chat") {
    const res = await Chat.deleteOne({ _id: id, userEmail: email });
    if (res.deletedCount === 0)
      return NextResponse.json({ error: "Chat not found." }, { status: 404 });
  } else {
    const res = await Asset.deleteOne({ _id: id, userEmail: email });
    if (res.deletedCount === 0)
      return NextResponse.json({ error: "Asset not found." }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
