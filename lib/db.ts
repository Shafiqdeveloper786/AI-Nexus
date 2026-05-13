import mongoose from "mongoose";
import dns from "node:dns";

/* ═══════════════════════════════════════════════════════════════════════════
   DNS FIX — querySrv / ECONNREFUSED
   ───────────────────────────────────────────────────────────────────────────
   dns.setServers() overrides the resolver for ALL dns module calls including
   resolveSrv(), which is what the MongoDB +srv:// driver uses.
   Pointing to Google Public DNS (8.8.8.8) bypasses broken local resolvers.
   ═══════════════════════════════════════════════════════════════════════════ */
dns.setServers(["8.8.8.8", "8.8.4.4", "1.1.1.1"]);
dns.setDefaultResultOrder("ipv4first");

console.log("[DB] DNS → 8.8.8.8 / 8.8.4.4 / 1.1.1.1");

/* ── Environment ─────────────────────────────────────────────────────────── */
const RAW_URI = process.env.DATABASE_URL ?? process.env.MONGODB_URI;

if (!RAW_URI) {
  throw new Error(
    "[DB] MongoDB URI not found.\n" +
    "  Add DATABASE_URL=mongodb+srv://... to .env.local and restart the server."
  );
}

const maskedURI = RAW_URI.replace(/:([^@]+)@/, ":****@");
console.log("[DB] URI →", maskedURI);

/* ── Singleton cache (survives Next.js HMR in dev) ───────────────────────── */
interface MongooseCache {
  conn:    typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}
declare global {
  // eslint-disable-next-line no-var
  var _mongooseCache: MongooseCache;
}
if (!global._mongooseCache) {
  global._mongooseCache = { conn: null, promise: null };
}
const cache = global._mongooseCache;

/* ── connectDB ───────────────────────────────────────────────────────────── */
export async function connectDB(): Promise<typeof mongoose> {
  /* Reuse live connection */
  if (cache.conn && mongoose.connection.readyState === 1) {
    return cache.conn;
  }

  /* Discard stale/errored connection */
  if (cache.conn && mongoose.connection.readyState !== 1) {
    console.warn("[DB] Stale connection (state=%d) — reconnecting", mongoose.connection.readyState);
    cache.conn    = null;
    cache.promise = null;
    try { await mongoose.disconnect(); } catch { /* ignore */ }
  }

  /* Re-apply DNS override on every new attempt */
  dns.setServers(["8.8.8.8", "8.8.4.4", "1.1.1.1"]);

  if (!cache.promise) {
    mongoose.set("strictQuery", false);
    console.log("[DB] Opening new connection…");

    cache.promise = mongoose
      .connect(RAW_URI as string, {
        dbName: "ai_nexus",

        /* ── Timeout tuning ────────────────────────────────────────────────
           serverSelectionTimeoutMS — how long the driver waits to find a
             healthy server before throwing.  5 s was too short when Atlas
             monitor connections time out momentarily; 30 s gives the driver
             time to retry via a different replica-set member.
           connectTimeoutMS — TCP handshake timeout for each socket.
           socketTimeoutMS  — idle socket timeout after connection is open.
           heartbeatFrequencyMS — how often the background monitor pings
             each Atlas node.  Increasing from the default 10 s to 30 s
             means fewer "connection <monitor> … timed out" log lines.
           ─────────────────────────────────────────────────────────────── */
        serverSelectionTimeoutMS: 30_000,  // was 5_000 — too short
        connectTimeoutMS:         30_000,  // was 10_000
        socketTimeoutMS:          60_000,
        heartbeatFrequencyMS:     30_000,  // reduce monitor noise
        minHeartbeatFrequencyMS:  5_000,

        bufferCommands: false,
        maxPoolSize:    10,
        minPoolSize:    1,
        maxConnecting:  2,
        retryWrites:    true,
        retryReads:     true,
        family:         4,   // force IPv4 sockets
      })
      .then((m) => {
        console.log("[DB] ✓ Connected  host=%s  db=%s", m.connection.host, m.connection.name);

        /* Suppress routine monitor-timeout log noise in production */
        m.connection.on("timeout",       () => console.warn("[DB] Socket timeout — will retry"));
        m.connection.on("disconnected",  () => {
          console.warn("[DB] Disconnected — clearing cache for next request");
          cache.conn    = null;
          cache.promise = null;
        });
        m.connection.on("reconnected",   () => console.log("[DB] Reconnected ✓"));

        return m;
      })
      .catch((err: Error) => {
        const msg  = err.message ?? "";
        const code = (err as NodeJS.ErrnoException).code ?? "";

        console.error("[DB] ✗ Connection FAILED");
        console.error("[DB]   message :", msg);
        console.error("[DB]   code    :", code || "(none)");
        console.error("[DB]   uri     :", maskedURI);

        if (msg.includes("timed out") || msg.includes("ETIMEDOUT")) {
          console.error("[DB] ────────────────────────────────────────────────────");
          console.error("[DB]  TCP connection to Atlas timed out (port 27017).");
          console.error("[DB]  Most likely cause: your IP is not whitelisted.");
          console.error("[DB]  Fix:");
          console.error("[DB]   1. Open https://cloud.mongodb.com");
          console.error("[DB]   2. Network Access → + Add IP Address");
          console.error("[DB]   3. Enter  0.0.0.0/0  → Confirm");
          console.error("[DB]   4. Wait ~30 s, then restart the dev server.");
          console.error("[DB] ────────────────────────────────────────────────────");
        }

        if (msg.includes("querySrv") || code === "ECONNREFUSED") {
          console.error("[DB] ────────────────────────────────────────────────────");
          console.error("[DB]  SRV DNS lookup failed — port 53 may be blocked.");
          console.error("[DB]  Try switching to the Standard (non-SRV) connection");
          console.error("[DB]  string in Atlas → Connect → toggle off SRV.");
          console.error("[DB] ────────────────────────────────────────────────────");
        }

        cache.promise = null;
        throw err;
      });
  }

  try {
    cache.conn = await cache.promise;
  } catch (err) {
    cache.promise = null;
    throw err;
  }

  return cache.conn;
}
