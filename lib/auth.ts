import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import { authConfig } from "@/auth.config";
import { connectDB } from "@/lib/db";
import { UserProfile } from "@/lib/models/UserProfile";

const isProd = process.env.NODE_ENV === "production";
const TAG    = "[auth.ts]";

/* Warn loudly at startup if NEXTAUTH_URL is missing in production */
if (isProd && !process.env.NEXTAUTH_URL) {
  console.error(
    "[auth.ts] NEXTAUTH_URL is not set! " +
    "Google OAuth will fail. Set it to https://your-domain.com"
  );
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,

  providers: [
    ...authConfig.providers,

    Credentials({
      id:   "otp",
      name: "OTP",
      credentials: {
        email: { label: "Email", type: "email" },
        otp:   { label: "Code",  type: "text"  },
      },

      async authorize(credentials) {
        /* ── Log which database we're hitting ── */
        const uri    = process.env.DATABASE_URL ?? "(NOT SET)";
        const masked = uri.replace(/:([^@]+)@/, ":****@");
        console.log(`${TAG} [authorize] DATABASE_URL →`, masked);

        if (!credentials?.email || !credentials?.otp) {
          console.warn(`${TAG} [authorize] Missing credentials`);
          return null;
        }

        const email = String(credentials.email).toLowerCase().trim();
        const otp   = String(credentials.otp).trim();
        console.log(`${TAG} [authorize] Verifying OTP for`, email);

        /* ── Step 1: Find a valid, unused, non-expired OTP ── */
        let token;
        try {
          token = await prisma.otpToken.findFirst({
            where: {
              email,
              otp,
              used:    false,
              expires: { gt: new Date() },
            },
            orderBy: { createdAt: "desc" },
          });
        } catch (err) {
          console.error(`${TAG} [authorize] Prisma findFirst OtpToken error:`, err);
          return null;
        }

        if (!token) {
          console.warn(`${TAG} [authorize] No valid OTP found for ${email}`);
          return null;
        }
        console.log(`${TAG} [authorize] Valid OTP found — tokenId=${token.id}`);

        /* ── Step 2: Consume the token ───────────────────── */
        try {
          await prisma.otpToken.update({
            where: { id: token.id },
            data:  { used: true },
          });
        } catch (err) {
          console.error(`${TAG} [authorize] Failed to consume OTP token:`, err);
          return null;
        }

        /* ── Step 3: Mark email as verified ──────────────── */
        let user;
        try {
          user = await prisma.user.update({
            where: { email },
            data:  { emailVerified: new Date() },
          });
          console.log(`${TAG} [authorize] emailVerified set for user id=${user.id}`);
        } catch (err) {
          console.error(`${TAG} [authorize] Failed to update user emailVerified:`, err);
          return null;
        }

        /* ── Step 4: Ensure Mongoose UserProfile exists ───── */
        /*   (non-critical — lazy creation is a fallback)       */
        try {
          await connectDB();
          await (UserProfile as any).findOrCreate(user.email!, user.name ?? undefined);
          console.log(`${TAG} [authorize] Mongoose UserProfile ready for`, user.email);
        } catch (profileErr) {
          // Don't block login if Mongoose fails
          console.error(`${TAG} [authorize] Mongoose UserProfile error (non-fatal):`, profileErr);
        }

        return {
          id:    user.id,
          name:  user.name,
          email: user.email,
          image: user.image,
        };
      },
    }),
  ],

  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },

  /* ── Cookie settings ─────────────────────────────────── */
  cookies: {
    sessionToken: {
      name: isProd ? "__Secure-authjs.session-token" : "authjs.session-token",
      options: { httpOnly: true, sameSite: "lax", path: "/", secure: isProd },
    },
    pkceCodeVerifier: {
      name: "next-auth.pkce.code_verifier",
      options: { httpOnly: true, sameSite: "lax", path: "/", secure: isProd },
    },
    callbackUrl: {
      name: isProd ? "__Secure-authjs.callback-url" : "authjs.callback-url",
      options: { httpOnly: true, sameSite: "lax", path: "/", secure: isProd },
    },
    csrfToken: {
      name: isProd ? "__Host-authjs.csrf-token" : "authjs.csrf-token",
      options: { httpOnly: true, sameSite: "lax", path: "/", secure: isProd },
    },
  },
});
