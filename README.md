<div align="center">

# ⚡ AI NEXUS
### The Ultimate Quantum AI Dashboard — v4.0.2

*One platform. Five AI superpowers. Zero compromises.*

[![Next.js](https://img.shields.io/badge/Next.js-15-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.x-38BDF8?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-47A248?style=for-the-badge&logo=mongodb&logoColor=white)](https://www.mongodb.com/atlas)
[![Prisma](https://img.shields.io/badge/Prisma-6.x-2D3748?style=for-the-badge&logo=prisma)](https://www.prisma.io/)
[![NextAuth](https://img.shields.io/badge/Auth.js-v5-purple?style=for-the-badge&logo=auth0&logoColor=white)](https://authjs.dev/)
[![Groq](https://img.shields.io/badge/Groq-LPU-F55036?style=for-the-badge)](https://groq.com/)
[![Framer Motion](https://img.shields.io/badge/Framer_Motion-12-FF0055?style=for-the-badge&logo=framer&logoColor=white)](https://www.framer.com/motion/)

[![Live Demo](https://img.shields.io/badge/🚀_Live_Demo-AI_Nexus-00d4ff?style=for-the-badge)](https://github.com/Shafiqdeveloper786/AI-Nexus)
[![License](https://img.shields.io/badge/License-MIT-00ff88?style=for-the-badge)](LICENSE)

---

<img src="https://raw.githubusercontent.com/Shafiqdeveloper786/AI-Nexus/main/public/preview.png" alt="AI Nexus Dashboard Preview" width="100%" style="border-radius: 12px"/>

> **Cyberpunk glassmorphism UI · Gemini-style streaming · 40,000 credit economy · Production-hardened auth**

</div>

---

## 🌌 What is AI Nexus?

AI Nexus is a **full-stack AI SaaS dashboard** built entirely with Next.js 15 App Router. It gives users access to five specialized AI modules — all behind a single, secure, credit-gated interface with a cyberpunk glassmorphism design.

No third-party AI wrappers. No external dashboards. Everything runs natively inside the Next.js application — streaming chat, image generation, code synthesis, SQL queries, and PDF resume exports.

---

## 🚀 Core Modules

### 🧠 Nexus Chat — Real-Time Streaming AI
- Token-by-token streaming via Groq's LPU inference (sub-100ms TTFT)
- **Zero-Vibration UI**: AI bubble is pre-created before the fetch begins — the `InlineThinking` waveform renders *inside* the same stable container, eliminating all layout shifts
- Gemini-style `▊` blinking cursor during streaming via CSS `::after`
- Smart sticky-scroll: auto-scroll pauses when user scrolls up to read history
- **No-Unsolicited-Code filter**: regex gate + hard system-prompt injection prevents the AI from adding Python examples to non-technical answers
- Persistent document context: attach a PDF/image once, ask follow-up questions without re-uploading
- Four models selectable per message (see [Active Models](#-active-ai-models))

### 🎨 Image Studio — Multi-Model AI Generation
- **Provider cascade**: FLUX.1-schnell → FLUX.1-dev → SDXL → SD 2.1 → **Pollinations AI** (tertiary fallback, no API key required)
- "High Traffic" alert shown **only** if the user has remaining turns but all providers fail
- **3 images / 24 hours** hard limit — checked client-side before any API call; hitting the limit redirects instantly to the Subscription tab
- One-click HD download + feedback (thumbs up/down)
- Negative prompt support

### 💻 Code & SQL Generator
- Dedicated system prompts for TypeScript, Python, Go, Rust, and SQL
- Syntax-highlighted output with one-click copy
- Full conversation history in the sidebar
- PostgreSQL, MongoDB, and Prisma ORM query generation

### 📄 AI Resume Builder
- AI-crafted, ATS-optimised resume from a plain-text brief
- A4-scaled PDF export via jsPDF (accurate line-height calculation, no overflow)
- Sections: Experience, Skills, Education, Projects
- Quantified achievements auto-generated ("Reduced latency by 40%…")

### 🔍 Nexus Vision — Document & Image Analysis
- Upload PDF (text or scanned) or image; ask any question about it
- **Three-path analysis engine**:
  - Text PDFs → `pdf-parse` text extraction → Groq text model
  - Images → base64 → Groq vision model
  - Scanned PDFs → `pdfjs-dist v5 + canvas` renders pages to PNG → Groq vision model
- Document context persisted across the conversation session

---

## 🏗️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Framework** | Next.js 15 (App Router, Server Components, Server Actions) |
| **Language** | TypeScript 5.8 (strict mode) |
| **Styling** | Tailwind CSS 3 + custom cyber-glass utilities + Framer Motion 12 |
| **Auth** | NextAuth / Auth.js v5 Beta — JWT strategy, PrismaAdapter |
| **Primary DB** | MongoDB Atlas via Prisma (User, Account, Session, OtpToken) |
| **AI Data DB** | MongoDB Atlas via Mongoose (UserProfile, Chat, Asset) |
| **Chat AI** | Groq SDK — Llama 3.3 70B / 3.1 8B / 3.2 Vision |
| **Image AI** | HuggingFace Inference SDK + Pollinations AI (free fallback) |
| **Email** | Nodemailer (Gmail SMTP) — OTP delivery |
| **PDF Export** | jsPDF 4.x |
| **PDF Analysis** | pdf-parse 2 + pdfjs-dist 5 + canvas npm |
| **Deployment** | Vercel (recommended) / any Node.js host |

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
- `NEXTAUTH_SECRET` + `GOOGLE_CLIENT_SECRET` accessed only via `process.env` — zero hardcoded secrets

### Google OAuth production URIs
```
Authorized JavaScript origins:   https://your-domain.com
Authorized redirect URI:          https://your-domain.com/api/auth/callback/google
```

---

## 💰 Credit Economy

| Action | Cost |
|--------|------|
| Welcome bonus | **40,000 credits** |
| Chat message (any model) | 1 credit |
| Code / SQL generation | 6 credits |
| Image generation | 12 credits |
| Daily image limit (free tier) | 3 images / 24 hours |

- Optimistic client-side deduction updates all mounted components instantly via a custom `window` event bus — no network round-trip needed for UI updates
- Server-side credit check runs independently; 403 response triggers a subscription redirect
- Credits = 0 → `ChatInput` replaced with a "Credits Exhausted — Upgrade to Pro" button that routes to the Subscription tab

---

## 🤖 Active AI Models

| Nexus ID | Underlying Model | Speciality |
|----------|-----------------|------------|
| **Nexus Pro** | `llama-3.3-70b-versatile` | Balanced, general-purpose |
| **Nexus Fast** | `llama-3.1-8b-instant` | Lightning speed, quick answers |
| **Nexus Coder** | `llama-3.3-70b-versatile` | Code-optimised system prompt |
| **Nexus Vision** | `llama-3.2-11b-vision-preview` | Document & image analysis |

> All models served via Groq's LPU infrastructure for sub-second first-token latency.

---

## ✨ Zero-Vibration UI — Technical Deep Dive

Traditional streaming UIs suffer from layout shifts: a "Thinking" indicator unmounts while the response bubble mounts, causing a visible jump. AI Nexus eliminates this with a **unified container architecture**:

```
Timeline:
  t=0ms   → User sends message
            → AI bubble immediately created: { content: "", isStreaming: true }
            → InlineThinking waveform renders INSIDE the bubble (same DOM node)
  t=~50ms → Groq returns first token
            → content becomes truthy → InlineThinking hides instantly
            → motion.div fades in (opacity 0→1, 220ms) — same container, zero shift
  t=ongoing → Tokens stream into the same stable div
            → .nexus-streaming CSS class appends blinking ▊ cursor via ::after
  t=done  → isStreaming: false → cursor removed → action bar fades in
```

Key CSS rules:
```css
/* Stable container */
.ai-bubble { min-height: 3.5rem; contain: layout; will-change: contents; }

/* Blinking cursor during streaming */
.nexus-streaming > :last-child::after {
  content: ' ▊';
  animation: nexus-cursor-blink 1s infinite;
  color: #00f2ff;
}

/* Stop browser scroll-anchor fighting React */
.overflow-y-auto { overflow-anchor: none !important; }
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
# Fill in all values in .env.local
```

Required variables:
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
│   │   ├── analyze-file/      # PDF & image vision analysis
│   │   ├── chat/              # Groq streaming with no-code filter
│   │   ├── generate-image/    # HF + Pollinations cascade
│   │   ├── generate-code/     # Code & SQL generation
│   │   ├── generate-resume/   # AI resume builder
│   │   ├── history/           # Unified chat + asset history
│   │   ├── library/           # Image asset library
│   │   ├── send-otp/          # OTP email dispatch
│   │   ├── verify-otp/        # OTP server verification
│   │   └── user/              # Profile CRUD + export + delete
│   ├── auth/                  # Login, Register, Verify-OTP pages
│   ├── dashboard/             # Main dashboard page (SSR)
│   └── globals.css            # Cyber-glass theme + streaming CSS
├── components/
│   └── dashboard/
│       ├── ChatArea.tsx        # Smart scroll + streaming orchestrator
│       ├── FluidMessage.tsx    # Zero-vibration message component
│       ├── ImageStudio.tsx     # Image generation UI
│       ├── Sidebar.tsx         # Unified history + image library
│       ├── ProfileModal.tsx    # Read-only name/email + data export
│       ├── ResumeBuilder.tsx   # AI resume + PDF export
│       └── ...                 # 12 more components
├── hooks/
│   ├── useChatHistory.ts      # Unified history with kind-based routing
│   └── useUserProfile.ts      # Cross-instance credit sync via events
├── lib/
│   ├── auth.ts                # NextAuth full config
│   ├── auth.config.ts         # Edge-safe config (middleware)
│   ├── credits.ts             # Single source of truth for costs
│   ├── db.ts                  # Mongoose connection with DNS fallback
│   ├── models/                # UserProfile, Chat, Asset schemas
│   └── session.ts             # Server-side session helper
├── auth.config.ts             # Edge middleware auth
├── middleware.ts              # Route protection
├── next.config.ts             # Security headers + image optimization
└── .env.production.template   # Full env reference (no real secrets)
```

---

## 🚀 Deployment (Vercel — Recommended)

1. Push to GitHub (already done)
2. Import repo at [vercel.com/new](https://vercel.com/new)
3. Set all env variables from `.env.production.template` in Vercel dashboard
4. Add production domain to Google OAuth:
   - Authorized origins: `https://your-project.vercel.app`
   - Redirect URI: `https://your-project.vercel.app/api/auth/callback/google`
5. Deploy — Vercel auto-detects Next.js

---

## 🛡️ Security Checklist

- [x] `.env.local` and `.env.production` are gitignored — secrets never committed
- [x] `poweredByHeader: false` — Next.js version not exposed
- [x] Security headers on every route (X-Frame-Options: DENY, X-Content-Type-Options: nosniff, XSS-Protection)
- [x] OTP tokens: single-use, 10-minute expiry
- [x] Profile fields (name, email) permanently read-only via both UI and API
- [x] Credentials provider only accepts valid, unexpired, unused OTP tokens
- [x] Google OAuth callback URL strictly validated by NextAuth

---

## 📄 License

MIT © 2025 [Shafiq Developer](https://github.com/Shafiqdeveloper786)

---

<div align="center">

**Built with ⚡ by Shafiq · Powered by Groq LPU · Secured by Auth.js v5**

*If this project helped you, consider giving it a ⭐ on GitHub*

</div>
