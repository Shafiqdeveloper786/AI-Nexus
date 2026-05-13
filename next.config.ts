import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* ── ESM/CJS compatibility ─────────────────────────────────────────────── */
  transpilePackages: ["next-auth", "@auth/core"],

  /* ── Native Node.js modules — must NOT be bundled by webpack ──────────── */
  serverExternalPackages: ["nodemailer", "canvas", "pdf-parse", "pdfjs-dist"],

  /* ── Production hardening ─────────────────────────────────────────────── */
  poweredByHeader: false,   // don't expose "X-Powered-By: Next.js"
  compress:        true,    // gzip/brotli all responses

  /* ── Image optimisation ────────────────────────────────────────────────── */
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "lh3.googleusercontent.com" }, // Google profile photos
    ],
    formats: ["image/avif", "image/webp"],
  },

  /* ── Security headers (applied to every route) ─────────────────────────── */
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options",    value: "nosniff"          },
          { key: "X-Frame-Options",            value: "DENY"             },
          { key: "X-XSS-Protection",           value: "1; mode=block"    },
          { key: "Referrer-Policy",            value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy",         value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
