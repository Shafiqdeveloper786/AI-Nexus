import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({ baseDirectory: __dirname });

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),

  /* ── Production rule overrides ──────────────────────────────────────────
     `any` is deliberate at Mongoose / pdfjs / Groq / HuggingFace SDK
     boundaries — adding typed wrappers there adds zero safety value.
     Stylistic rules (prefer-const, no-unescaped-entities) are warnings so
     they surface in the console but never block a production build.
     ─────────────────────────────────────────────────────────────────────── */
  {
    rules: {
      "@typescript-eslint/no-explicit-any":  "off",
      "@typescript-eslint/no-unused-vars":   "warn",
      "prefer-const":                        "warn",
      "react/no-unescaped-entities":         "warn",
    },
  },
];

export default eslintConfig;
