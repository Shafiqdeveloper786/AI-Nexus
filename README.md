<div align="center">

# ⚡ AI NEXUS
### Production-Ready AI SaaS Dashboard — v4.0.2

*Five AI superpowers. One glassmorphism interface. Zero compromises.*

[![Next.js](https://img.shields.io/badge/Next.js-15-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.x-38BDF8?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-47A248?style=for-the-badge&logo=mongodb&logoColor=white)](https://www.mongodb.com/atlas)
[![Groq](https://img.shields.io/badge/Groq_LPU-Llama_4-F55036?style=for-the-badge)](https://groq.com/)
[![NextAuth](https://img.shields.io/badge/Auth.js-v5-purple?style=for-the-badge&logo=auth0&logoColor=white)](https://authjs.dev/)
[![Framer Motion](https://img.shields.io/badge/Framer_Motion-12-FF0055?style=for-the-badge&logo=framer&logoColor=white)](https://www.framer.com/motion/)
[![Vercel](https://img.shields.io/badge/Deployed_on-Vercel-black?style=for-the-badge&logo=vercel)](https://vercel.com/)

[![Live Demo](https://img.shields.io/badge/🚀_Live_Demo-AI_Nexus-00d4ff?style=for-the-badge)](https://github.com/Shafiqdeveloper786/AI-Nexus)
[![License](https://img.shields.io/badge/License-MIT-00ff88?style=for-the-badge)](LICENSE)

---

> **Cyberpunk glassmorphism UI · Gemini-style streaming · 40,000 credit economy · MuPDF WASM vision engine · Production-hardened auth**

</div>

---

## 🌌 What is AI Nexus?

**AI Nexus** is a full-stack AI SaaS dashboard built by **M. Shafiq Chohan** using Next.js 15 App Router. It gives users access to five specialised AI modules — all behind a single, secure, credit-gated interface with a cyberpunk glassmorphism design.

No third-party AI wrappers. No external dashboards. Everything runs natively inside the Next.js application — streaming chat, image generation, code synthesis, SQL queries, deep PDF analysis, and AI-powered resume export.

---

## 🚀 Features

### 🧠 Nexus AI Chat — Real-Time Streaming
- Powered by **Nexus AI** — a professional assistant persona developed by M. Shafiq Chohan
- Token-by-token streaming via Groq's LPU inference (sub-100ms TTFT)
- **Zero-Vibration UI**: AI bubble pre-created before fetch — `InlineThinking` waveform renders *inside* the same stable DOM node, eliminating all layout shifts
- Gemini-style `▊` blinking cursor during streaming via CSS `::after`
- Smart sticky-scroll: auto-pauses when user scrolls up to read history
- **No-Unsolicited-Code filter**: regex gate + hard system-prompt injection prevents AI from adding Python examples to non-technical answers
- Persistent document context: attach a PDF/image once, ask follow-ups without re-uploading
- Four models selectable per message: Nexus Pro, Nexus Fast, Nexus Coder, Nexus Vision

### 🔍 Deep PDF & Image Analysis
- Upload any PDF (text-based or fully scanned) or image
- **Four-layer analysis pipeline** — no guessing, hard errors on failure:
  - **L1 — MuPDF WASM render**: pure WebAssembly renderer, zero native OS dependencies — works on Vercel Lambda
  - **L2 — JPEG byte-scan**: extracts embedded JPEG frames directly from the PDF binary (FF D8 FF marker scan)
  - **L3 — Text extraction**: `pdf-parse v2` for text-layer PDFs
  - **L∅ — Hard diagnostic**: if all layers fail, returns a precise error message — never guesses from filename
- Vision analysis via **Groq Llama 4 Scout** (`meta-llama/llama-4-scout-17b-16e-instruct`) with `llama-3.2-90b-vision-preview` fallback
- Document context persisted across the conversation session

### 🎨 Image Studio 2.0
- Glassmorphism prompt card with single-textarea input
- Reference image upload (Paperclip button) for img2img-style workflows
- Portal-based model dropdown (escapes `overflow:hidden` parents)
- Provider cascade: FLUX.1-schnell → FLUX.1-dev → SDXL → SD 2.1 → Pollinations AI
- Glowing shimmer generate button with Framer Motion animation
- **3 images / 24 hours** hard limit on free tier; instant upgrade redirect on limit hit

### 💻 Code & SQL Generator
- Dedicated system prompts for TypeScript, Python, Go, Rust, and SQL
- Syntax-highlighted output (CodeBlock component) with one-click copy
- Full conversation history in the sidebar
- PostgreSQL, MongoDB, and Prisma ORM query generation

### 📄 Professional Resume Builder
- **Split-screen layout**: left form panel + right live preview (updates as you type)
- Section tabs: Personal · Experience · Education · Skills — with animated underline indicator
- Contact info rendered with Lucide icons (Mail, Phone, LinkedIn link)
- AI-crafted, ATS-optimised resume via Groq streaming
- A4-scaled **PDF export** via jsPDF — accurate line-height calculation, indigo section headers, no overflow
- Mobile-responsive: Edit/Preview toggle on small screens

---

## 🏗️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Framework** | Next.js 15 (App Router, Server Components, Streaming) |
| **Language** | TypeScript 5.8 (strict mode) |
| **Styling** | Tailwind CSS 3 · Cyberpunk/Glassmorphism theme · Framer Motion 12 |
| **Auth** | Auth.js v5 Beta — Google OAuth + Email OTP, PrismaAdapter |
| **Primary DB** | MongoDB Atlas via Prisma ORM (User, Account, Session, OtpToken) |
| **AI Data DB** | MongoDB Atlas via Mongoose (UserProfile, Chat, Asset) |
| **Chat AI** | Groq SDK — Llama 3.3 70B · Llama 3.1 8B · Llama 4 Scout Vision |
| **PDF Renderer** | **MuPDF WASM** (`mupdf` npm) — zero native deps, runs on Vercel Lambda |
| **PDF Text** | `pdf-parse v2` — text-layer extraction |
| **Vision AI** | Groq `llama-4-scout-17b-16e-instruct` (primary) · `llama-3.2-90b-vision-preview` (fallback) |
| **Image AI** | HuggingFace Inference SDK + Pollinations AI (free fallback) |
| **PDF Export** | jsPDF 4.x — A4, paginated, indigo section headers |
| **Email** | Nodemailer (Gmail SMTP) — OTP delivery |
| **Deployment** | Vercel (recommended) — Serverless + Edge middleware |

---

## 🔐 Authentication System

### Dual-provider auth with zero friction

```
User visits /auth/login
    │
    ├─► Google OAuth 2.0 ──► NextAuth callback ──► /dashboard
    │
    └─► Email OTP
            │
            ├─ Enter email → 6-digit OTP sent via Gmail SMTP
            ├─ OTP: single-use, 10-min expiry, server-side verified
            └─ Verified → /dashboard
```

**Security hardening:**
- `__Secure-` prefixed cookies in production (`httpOnly`, `SameSite=lax`, `secure`)
- Edge middleware blocks all `/dashboard/*` routes without a valid session
- `PATCH /api/user/profile` silently ignores any `email` field — name & email are **permanently read-only** after registration
- OTP replay protection: each token marked `used: true` the moment it's consumed
- Signout confirmation dialog prevents accidental logouts; success notification fires before redirect
- `NEXTAUTH_SECRET` + `GOOGLE_CLIENT_SECRET` accessed only via `process.env` — zero hardcoded secrets

---

## 💰 Credit Economy

| Action | Cost |
|--------|------|
| Welcome bonus | **40,000 credits** |
| Chat message | 1 credit |
| Code / SQL generation | 6 credits |
| Image generation | 12 credits |
| Daily image limit (free) | 3 images / 24 hours |
| Resume Builder | Free (3 / day) |

- Optimistic client-side deduction via custom `window` event bus — no network round-trip for UI updates
- Server-side credit check runs independently; 403 triggers subscription redirect
- Credits = 0 → `ChatInput` replaced with a "Credits Exhausted — Upgrade to Pro" amber button

---

## 🤖 Active AI Models

| Nexus ID | Underlying Model | Speciality |
|----------|-----------------|------------|
| **Nexus Pro** | `llama-3.3-70b-versatile` | Balanced, general-purpose |
| **Nexus Fast** | `llama-3.1-8b-instant` | Lightning speed |
| **Nexus Coder** | `llama-3.3-70b-versatile` | Code-optimised system prompt |
| **Nexus Vision** | `llama-3.2-11b-vision-preview` | Document & image analysis |
| **Vision Primary** | `llama-4-scout-17b-16e-instruct` | PDF/scanned doc analysis |

> All models served via Groq's LPU infrastructure for sub-second first-token latency.

---

## 🔍 MuPDF WASM — PDF Pipeline Deep Dive

Traditional PDF rendering on serverless requires `canvas` (needs libcairo + libpango — unavailable on Vercel Lambda). AI Nexus solves this with **MuPDF WebAssembly**:

```
PDF Buffer received
    │
    ├─► L1: mupdf.Document.openDocument()
    │       mupdf.Matrix.scale(2, 2)  →  2× resolution
    │       pixmap.asPNG()            →  PNG bytes
    │       → base64 → Groq Vision ✅
    │
    ├─► L2: FF D8 FF byte-scan (embedded JPEG extraction)
    │       → base64 → Groq Vision ✅
    │
    ├─► L3: pdf-parse v2 text extraction
    │       → text → Groq text model ✅
    │
    └─► L∅: Hard diagnostic error (no filename guessing)
```

**Why MuPDF WASM over alternatives:**
- `canvas` npm — requires `libcairo`/`libpango`, fails on Amazon Linux 2 (Vercel Lambda)
- `pdfjs-dist v5` — uses `DOMMatrix` (not available in Node.js without polyfill)
- `pdf-img-convert` — ships old canvas binary, fails to install on Node 24
- **MuPDF WASM** — pure JavaScript/WASM, zero native OS dependencies ✅

---

## ✨ Zero-Vibration Streaming UI

```
t=0ms    → User sends message
           → AI bubble immediately created: { content: "", isStreaming: true }
           → InlineThinking waveform renders INSIDE the same DOM node
t=~50ms  → Groq returns first token
           → content truthy → InlineThinking hides instantly
           → motion.div fades in (opacity 0→1, 220ms) — zero layout shift
t=ongoing → Tokens stream into the same stable container
           → .nexus-streaming CSS class appends blinking ▊ cursor
t=done   → isStreaming: false → cursor removed → action bar fades in
```

---

## ⚙️ Local Development Setup

### Prerequisites
- Node.js 20+
- MongoDB Atlas account (free tier works)
- Groq API key ([console.groq.com](https://console.groq.com))
- Google Cloud project with OAuth 2.0 credentials

### 1. Clone & install
```bash
git clone https://github.com/Shafiqdeveloper786/AI-Nexus.git
cd AI-Nexus
npm install
```

### 2. Configure environment
```bash
cp .env.production.template .env.local
# Fill in all values
```

```env
# Auth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=any-random-32-char-string

# Google OAuth
GOOGLE_CLIENT_ID=xxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxx

# Databases
DATABASE_URL=mongodb+srv://user:pass@cluster.mongodb.net/ai_nexus_auth
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/ai_nexus

# AI
GROQ_API_KEY=gsk_xxxx
HF_TOKEN=hf_xxxx

# Email
NODEMAILER_EMAIL=you@gmail.com
NODEMAILER_PASSWORD=your-gmail-app-password
```

### 3. Generate Prisma client & run
```bash
npx prisma generate
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## 🗂️ Project Structure

```
AI-Nexus/
├── app/
│   ├── api/
│   │   ├── analyze-file/      # MuPDF WASM + Groq Vision PDF pipeline
│   │   ├── chat/              # Groq streaming · Nexus AI persona · no-code filter
│   │   ├── generate-image/    # HuggingFace + Pollinations cascade
│   │   ├── generate-code/     # Code & SQL generation
│   │   ├── generate-resume/   # AI resume builder (streaming)
│   │   ├── history/           # Unified chat + asset history
│   │   ├── send-otp/          # OTP email dispatch
│   │   ├── verify-otp/        # OTP server verification
│   │   └── user/              # Profile CRUD + export + delete
│   ├── auth/                  # Login, Register, Verify-OTP pages
│   ├── dashboard/             # Main dashboard page (SSR + credit hydration)
│   └── globals.css            # Cyber-glass theme + streaming cursor CSS
├── components/
│   └── dashboard/
│       ├── ChatArea.tsx        # Smart scroll + streaming orchestrator
│       ├── FluidMessage.tsx    # Zero-vibration message · mobile-responsive bubbles
│       ├── ImageStudio.tsx     # Image Studio 2.0 · glassmorphism · portal dropdown
│       ├── ResumeBuilder.tsx   # Split-screen · live preview · icon contact bar · PDF
│       ├── TopNav.tsx          # Tool tabs · notifications · signout confirmation modal
│       ├── Sidebar.tsx         # Unified history + image library
│       └── ...                 # 12 more components
├── hooks/
│   ├── useChatHistory.ts      # Unified history with kind-based routing
│   └── useUserProfile.ts      # Cross-instance credit sync via window events
├── lib/
│   ├── auth.ts                # NextAuth full config
│   ├── credits.ts             # Single source of truth for all costs
│   ├── db.ts                  # Mongoose connection with DNS fallback
│   ├── models/                # UserProfile, Chat, Asset Mongoose schemas
│   └── notifications.ts       # Global event-bus for live notifications
├── middleware.ts              # Edge route protection (no DB calls)
├── next.config.ts             # serverExternalPackages · security headers · image optimization
└── .env.production.template   # Full env reference (no real secrets)
```

---

## 🚀 Deployment (Vercel)

1. Push to GitHub
2. Import repo at [vercel.com/new](https://vercel.com/new)
3. Set all env variables from `.env.production.template` in the Vercel dashboard
4. Add production domain to Google OAuth:
   - Authorized origin: `https://your-project.vercel.app`
   - Redirect URI: `https://your-project.vercel.app/api/auth/callback/google`
5. Deploy — Vercel auto-detects Next.js, no build config needed

> **Note:** `mupdf` (WebAssembly) and `pdf-parse` are listed in `serverExternalPackages` in `next.config.ts` — this prevents webpack from bundling them and ensures they run correctly on Vercel's Node.js Lambda runtime.

---

## 🛡️ Security Checklist

- [x] `.env.local` and `.env.production` are gitignored — secrets never committed
- [x] `poweredByHeader: false` — Next.js version not exposed in response headers
- [x] Security headers on every route: `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `X-XSS-Protection`, `Referrer-Policy`, `Permissions-Policy`
- [x] OTP tokens: single-use, 10-minute expiry, marked `used: true` on consumption
- [x] Profile fields (name, email) permanently read-only via both UI and API
- [x] Signout requires explicit confirmation — accidental logout prevented
- [x] Google OAuth callback URL strictly validated by Auth.js

---

## 📄 License

MIT © 2025 [M. Shafiq Chohan](https://github.com/Shafiqdeveloper786)

---

<div align="center">

**Built with ⚡ by M. Shafiq Chohan · Powered by Groq LPU · Secured by Auth.js v5**

*If this project helped you, please give it a ⭐ on GitHub*

</div>
