import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { Asset } from "@/lib/models/Asset";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url    = new URL(req.url);
  const limit  = Math.min(parseInt(url.searchParams.get("limit") ?? "18"), 50);
  const skip   = parseInt(url.searchParams.get("skip") ?? "0");

  try {
    await connectDB();

    const images = await Asset.find(
      { userEmail: session.user.email, type: "image" },
      { content: 1, prompt: 1, createdAt: 1, llmModel: 1 }
    )
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await Asset.countDocuments({ userEmail: session.user.email, type: "image" });

    return NextResponse.json({
      images: images.map((img: any) => ({
        id:        img._id.toString(),
        imageUrl:  img.content as string,
        prompt:    (img.prompt as string) ?? "",
        model:     (img.llmModel as string) ?? "flux",
        createdAt: img.createdAt,
      })),
      total,
      hasMore: skip + limit < total,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: "DB_ERROR", message: msg }, { status: 500 });
  }
}
