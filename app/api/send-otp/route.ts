import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendOtpEmail } from "@/lib/mailer";

const TAG = "[send-otp]";

function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function POST(req: NextRequest) {
  /* ── Log which DB is being targeted ─────────────────── */
  const uri    = process.env.DATABASE_URL ?? "(NOT SET)";
  const masked = uri.replace(/:([^@]+)@/, ":****@");
  console.log(`${TAG} DATABASE_URL →`, masked);

  try {
    const { email, name, mode } = await req.json();

    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Valid email is required." }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();
    console.log(`${TAG} mode=${mode} email=${normalizedEmail}`);

    /* ── Login: user must already exist ─────────────────── */
    if (mode === "login") {
      const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
      console.log(`${TAG} Login check — user found:`, !!existing);
      if (!existing) {
        return NextResponse.json({ error: "No account found with this email." }, { status: 404 });
      }
    }

    /* ── Register: create user if not exists ─────────────── */
    if (mode === "register") {
      if (!name || typeof name !== "string" || name.trim().length < 2) {
        return NextResponse.json({ error: "Full name (min 2 chars) is required." }, { status: 400 });
      }
      const upsertResult = await prisma.user.upsert({
        where:  { email: normalizedEmail },
        create: { email: normalizedEmail, name: name.trim() },
        update: {},
      });
      console.log(`${TAG} User upserted — id=${upsertResult.id} name=${upsertResult.name}`);
    }

    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (!user) {
      console.error(`${TAG} User not found after upsert for`, normalizedEmail);
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }
    console.log(`${TAG} Working user — id=${user.id}`);

    /* ── Invalidate old OTPs ─────────────────────────────── */
    const { count: invalidated } = await prisma.otpToken.updateMany({
      where: { email: normalizedEmail, used: false },
      data:  { used: true },
    });
    if (invalidated > 0) {
      console.log(`${TAG} Invalidated ${invalidated} previous OTP(s)`);
    }

    /* ── Create new OTP ──────────────────────────────────── */
    const otp     = generateOtp();
    const expires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    const createdToken = await prisma.otpToken.create({
      data: { userId: user.id, email: normalizedEmail, otp, expires },
    });
    console.log(`${TAG} OTP created — tokenId=${createdToken.id} expires=${expires.toISOString()}`);

    /* ── Send email ──────────────────────────────────────── */
    await sendOtpEmail(normalizedEmail, otp, user.name ?? undefined);
    console.log(`${TAG} Email sent to ${normalizedEmail}`);

    return NextResponse.json({ success: true, message: "OTP sent to your email." });

  } catch (err) {
    console.error(`${TAG} UNHANDLED ERROR:`, err);
    return NextResponse.json(
      { error: "Failed to send OTP. Please try again." },
      { status: 500 }
    );
  }
}
