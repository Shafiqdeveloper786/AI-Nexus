import { PrismaClient } from "@prisma/client";

/* ─────────────────────────────────────────────────────────────────────────────
   SINGLETON Prisma client
   Prisma reads DATABASE_URL at runtime from process.env — it is NOT baked
   into the generated client binary.  Any .env.local change takes effect on
   the next cold start (i.e. after stopping and restarting `npm run dev`).

   To verify which cluster Prisma is connecting to, check the log line printed
   below in your terminal.
   ───────────────────────────────────────────────────────────────────────────── */

const RAW_URI   = process.env.DATABASE_URL ?? "";
const maskedURI = RAW_URI.replace(/:([^@]+)@/, ":****@");
console.log("[prisma.ts] DATABASE_URL →", maskedURI || "(NOT SET)");

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development"
      ? ["error", "warn"]   // change to ["query","error","warn"] for full query logs
      : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
