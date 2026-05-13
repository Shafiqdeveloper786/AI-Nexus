import { NextRequest, NextResponse } from "next/server";
import Groq from "groq-sdk";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { Chat, type IMessage } from "@/lib/models/Chat";
import { UserProfile } from "@/lib/models/UserProfile";
import { toolCost } from "@/lib/credits";

export const runtime    = "nodejs";
export const maxDuration = 60;

/* ── Active Groq model IDs ──────────────────────────────────────────────────
   Nexus model IDs map to real Groq model names.
   DeepSeek-Coder / Mistral-7b not on Groq free tier → best available fallback.
   ─────────────────────────────────────────────────────────────────────────── */
const DEFAULT_MODEL = "llama-3.3-70b-versatile";

const GROQ_MODELS: Record<string, string> = {
  /* ── Active Nexus model IDs (4 models, Nexus Creative removed) ── */
  "nexus-pro":    "llama-3.3-70b-versatile",         // Balanced & Smart
  "nexus-fast":   "llama-3.1-8b-instant",             // Lightning fast
  "nexus-code":   "llama-3.3-70b-versatile",          // Code-specialised prompt applied
  "nexus-vision": "llama-3.2-11b-vision-preview",     // Vision / document analysis
  /* ── Legacy IDs (backwards compat) ── */
  llama3:      "llama-3.3-70b-versatile",
  mixtral:     "llama-3.3-70b-versatile",
  groq:        "llama-3.3-70b-versatile",
  "groq fast": "llama-3.1-8b-instant",
  sql:         "llama-3.1-8b-instant",
};

/* Per-model temperatures */
const MODEL_TEMPS: Record<string, number> = {
  "nexus-code":   0.20,
  "nexus-fast":   0.65,
  "nexus-vision": 0.40,
};

/* ── Detect explicit code requests ──────────────────────────────────────────
   Returns true only when the user clearly asks to see code / a script.
   Used to decide whether to inject the no-code constraint below.
   ─────────────────────────────────────────────────────────────────────────── */
const CODE_REQUEST_PATTERNS = [
  /\b(write|create|generate|make|build|implement|show|give me|provide)\b.{0,40}\b(code|script|function|class|snippet|program|example code|boilerplate)\b/i,
  /\b(how to code|how do i code|code this|code for|in python|in javascript|in typescript|in go|in rust|in java|in c\+\+|in c#|in php|in swift)\b/i,
  /\b(how to (implement|program|write a (script|function|class|program|component|hook|api|endpoint|query)))\b/i,
  /\b(show (me )?(the )?(code|implementation|example|snippet))\b/i,
  /```|def |class |function\s+\w+\s*\(|import |const |let |var |<script/i,
];

function isExplicitCodeRequest(msg: string): boolean {
  return CODE_REQUEST_PATTERNS.some((re) => re.test(msg));
}

/* Appended to the system prompt for chat messages that don't ask for code */
const NO_CODE_CONSTRAINT = `

⚠️ HARD RULE FOR THIS RESPONSE: The user has NOT asked for code. You are STRICTLY FORBIDDEN from generating any fenced code blocks (\`\`\`...\`\`\`) or inline code snippets in your reply. Respond with rich, professional Markdown text only — use headings, bullet points, and **bold** for emphasis. Do not include even a "simple example in Python" or any other language. Pure text advice only.`;

/* ── System prompts ─────────────────────────────────────────────────────────── */
const SYSTEM_PROMPTS: Record<string, string> = {
  chat: `You are AI Nexus — a brilliant, witty, and deeply knowledgeable AI companion. Think of yourself as that one friend who happens to know everything: direct, warm, and never condescending.

**How you respond:**
- Lead with the most useful insight — skip "As an AI…" preamble entirely.
- Use **bold** for key terms and important takeaways.
- Structure answers with Markdown headings (##) and bullet points for clarity.
- End with a practical next step or follow-up question when it adds value.
- Match the user's tone: casual question → conversational reply; detailed question → precise, structured answer.

**Code blocks — strict policy:**
- ONLY include a code block when the user explicitly asks for code, a script, a function, or an implementation example.
- For non-technical topics (English, motivation, health, food, relationships, history, finance, etc.) — provide TEXT ONLY. Never add a "simple example in Python" or similar to a non-technical answer.`,

  code: `You are a senior full-stack engineer with deep expertise across TypeScript, Python, Go, Rust, and modern web frameworks. You write clean, idiomatic, production-ready code.

**Your response format:**
1. **Approach** — one or two sentences on your strategy.
2. **Code block** — always include the language tag (\`\`\`tsx, \`\`\`python, etc.).
3. **Key decisions** — a short bullet list explaining why you made specific choices.
4. Mention edge cases or gotchas the user should watch for.`,

  "nexus-vision": `You are Nexus Vision — an expert AI for document analysis, image understanding, and visual content. You specialise in extracting information from scanned documents, images, and PDFs.

**Your response format:**
- Describe what you observe with precision.
- Extract structured data (tables, dates, names, figures) when present.
- Answer the user's question directly after describing the content.
- Use **bold** for key findings and bullet points for lists.`,

  resume: `You are a professional resume strategist and ATS optimisation expert. You help users land senior-level roles at top-tier companies.

**Your format:**
- ATS-friendly **section headers** (Experience, Skills, Education, Projects).
- **Quantify every achievement** — e.g., "Reduced API latency by 40% serving 2M req/day".
- Strong action verbs to open every bullet point.
- Return clean, copy-pasteable Markdown.`,

  sql: `You are a database performance expert fluent in PostgreSQL, MongoDB, and Prisma ORM.

**Your format:**
- Show the query in a \`\`\`sql\`\`\` or \`\`\`typescript\`\`\` code block.
- Follow with a **Performance Notes** section covering indexes, query cost, and simpler alternatives where applicable.`,
};

/* Per-model system prompt overrides (take precedence over tool-based prompts) */
const MODEL_PROMPT_OVERRIDES: Record<string, string> = {
  "nexus-vision": SYSTEM_PROMPTS["nexus-vision"],
  "nexus-code":   SYSTEM_PROMPTS.code,
};

function chatTitle(msg: string): string {
  return msg.length > 55 ? msg.slice(0, 55).trimEnd() + "…" : msg;
}

export async function POST(req: NextRequest) {
  /* ── 1. Auth ───────────────────────────────────────────── */
  const rawSession = await auth();
  console.log("[AUTH] Session check —", rawSession?.user?.email ?? "NO SESSION");

  if (!rawSession?.user?.email) {
    console.warn("[AUTH] No session — 401");
    return NextResponse.json({ error: "Unauthorized — please sign in." }, { status: 401 });
  }

  const email = rawSession.user.email;
  const name  = rawSession.user.name ?? email.split("@")[0];
  console.log("[AUTH] Session found  email=%s", email);

  /* ── 2. Parse body ─────────────────────────────────────── */
  let body: { message?: string; model?: string; tool?: string; chatId?: string; docContext?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { message = "", model = "llama3", tool = "chat", chatId, docContext } = body;

  if (!message.trim())
    return NextResponse.json({ error: "Message is required." }, { status: 400 });
  if (tool === "image")
    return NextResponse.json(
      { error: "Use /api/generate-image for image generation." },
      { status: 400 }
    );

  console.log("[AUTH] Params  tool=%s  model=%s  chatId=%s", tool, model, chatId ?? "new");

  /* ── 3. DB connection ──────────────────────────────────── */
  try {
    console.log("[DB] Connecting...");
    await connectDB();
    console.log("[DB] Connected to ai_nexus");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const code = (err as NodeJS.ErrnoException).code ?? "";
    console.error("[DB] Connection failed  code=%s  msg=%s", code, msg);
    return NextResponse.json(
      {
        error:   "DB_CONNECTION_FAILED",
        message: msg,
        code,
        hint:    code === "ECONNREFUSED"
          ? "MongoDB Atlas → Network Access → Add your IP (or 0.0.0.0/0 for dev)"
          : "Check DATABASE_URL in .env.local and restart the dev server",
      },
      { status: 503 }
    );
  }

  /* ── 4. Profile + credit check ─────────────────────────── */
  let profile: any;
  try {
    profile = await (UserProfile as any).findOrCreate(email, name);
    console.log("[DB] Profile  credits=%d  plan=%s", profile.credits, profile.subscription);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[DB] Profile fetch failed:", msg);
    return NextResponse.json({ error: "PROFILE_FETCH_FAILED", message: msg }, { status: 500 });
  }

  const cost = toolCost(tool);
  if (profile.credits < cost && profile.subscription === "free") {
    console.warn("[DB] %s needs %d credits for tool=%s but has %d", email, cost, tool, profile.credits);
    return NextResponse.json(
      {
        error:    "NO_CREDITS",
        message:  "You have no credits remaining. Upgrade your plan to continue.",
        required: cost,
        current:  profile.credits,
      },
      { status: 403 }
    );
  }

  /* ── 5. Load / create chat session ─────────────────────── */
  let chat: InstanceType<typeof Chat> | null = null;
  try {
    chat = chatId
      ? await Chat.findOne({ _id: chatId, userEmail: email })
      : null;

    if (!chat) {
      chat = await Chat.create({
        userEmail: email,
        title:     chatTitle(message),
        tool:      (tool as "chat" | "code" | "resume" | "sql"),
        llmModel:  model,
        messages:  [],
      });
      console.log("[DB] New chat created  id=%s", (chat._id as any).toString());
      await UserProfile.updateOne({ email }, { $inc: { totalChats: 1 } });
    } else {
      console.log(
        "[DB] Resuming chat  id=%s  msgs=%d",
        (chat._id as any).toString(),
        chat.messages.length
      );
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[DB] Chat create/find error:", msg);
    return NextResponse.json({ error: "CHAT_SESSION_FAILED", message: msg }, { status: 500 });
  }

  const currentChatId = (chat._id as any).toString();

  /* ── 6. Build conversation history ─────────────────────── */
  const history = chat.messages.slice(-20).map((m: IMessage) => ({
    role:    m.role as "user" | "assistant" | "system",
    content: m.content,
  }));

  /* ── 7. Validate GROQ_API_KEY ──────────────────────────── */
  const groqKey = process.env.GROQ_API_KEY;
  if (!groqKey) {
    console.error("[AI] GROQ_API_KEY not set");
    return NextResponse.json(
      {
        error:   "AI_NOT_CONFIGURED",
        message: "GROQ_API_KEY is missing — add it to .env.local and restart.",
      },
      { status: 503 }
    );
  }

  /* ── 8. Deduct credits pre-flight (cost varies by tool) ───────────────── */
  if (profile.subscription === "free") {
    await UserProfile.updateOne({ email }, { $inc: { credits: -cost } });
    console.log("[DB] Deducted %d credits from %s  remaining=%d", cost, email, profile.credits - cost);
  }

  /* ── 9. Stream response via TransformStream ─────────────── */
  const groq        = new Groq({ apiKey: groqKey });
  const groqModel   = GROQ_MODELS[model] ?? DEFAULT_MODEL;
  const basePrompt  = MODEL_PROMPT_OVERRIDES[model] ?? SYSTEM_PROMPTS[tool] ?? SYSTEM_PROMPTS.chat;

  /* For general chat: enforce no-code constraint unless user explicitly asked for code */
  const needsNoCodeGuard = tool === "chat" && !isExplicitCodeRequest(message);
  const promptWithGuard  = needsNoCodeGuard ? basePrompt + NO_CODE_CONSTRAINT : basePrompt;

  /* Append active document context for follow-up questions */
  const systemPrompt = docContext
    ? `${promptWithGuard}\n\n---\n**Active Document Context:**\n${docContext.slice(0, 2000)}`
    : promptWithGuard;

  const temperature = MODEL_TEMPS[model] ?? (tool === "code" ? 0.25 : 0.72);

  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
  const writer  = writable.getWriter();
  const encoder = new TextEncoder();

  (async () => {
    let fullContent = "";
    try {
      console.log(
        "[AI] Calling Groq  model=%s  historyMsgs=%d  temp=%s",
        groqModel, history.length, temperature
      );

      const stream = await groq.chat.completions.create({
        model:    groqModel,
        messages: [
          ...(systemPrompt ? [{ role: "system" as const, content: systemPrompt }] : []),
          ...history,
          { role: "user" as const, content: message },
        ],
        stream:     true,
        max_tokens: 2048,
        temperature,
      });

      for await (const chunk of stream) {
        const text = chunk.choices[0]?.delta?.content ?? "";
        if (text) {
          fullContent += text;
          await writer.write(encoder.encode(text));
        }
      }

      console.log(
        "[AI] Stream complete  chars=%d  ~tokens=%d",
        fullContent.length,
        Math.ceil(fullContent.length / 4)
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown Groq error";
      console.error("[AI] Groq stream error:", msg);
      await writer.write(
        encoder.encode(`\n\n⚠️ **AI Error:** ${msg}\n\n_Check GROQ_API_KEY and try again._`)
      );
      /* Refund on AI failure */
      if (profile.subscription === "free") {
        await UserProfile.updateOne({ email }, { $inc: { credits: cost } });
        console.log("[DB] Refunded %d credits to %s after AI error", cost, email);
      }
    } finally {
      await writer.close().catch(() => {});

      /* Persist both messages + token count after stream completes */
      if (fullContent) {
        try {
          await Chat.updateOne(
            { _id: currentChatId },
            {
              $push: {
                messages: {
                  $each: [
                    { role: "user",      content: message,     createdAt: new Date() },
                    { role: "assistant", content: fullContent, createdAt: new Date() },
                  ],
                },
              },
              $set: { updatedAt: new Date() },
            }
          );
          const approxTokens = Math.ceil((message.length + fullContent.length) / 4);
          await UserProfile.updateOne({ email }, { $inc: { totalTokens: approxTokens } });
          console.log("[DB] Messages saved  chatId=%s  tokens=%d", currentChatId, approxTokens);
        } catch (saveErr) {
          console.error("[DB] Failed to persist messages:", saveErr);
        }
      }
    }
  })();

  return new Response(readable, {
    headers: {
      "Content-Type":      "text/plain; charset=utf-8",
      "Cache-Control":     "no-cache, no-transform",
      "X-Chat-Id":         currentChatId,
      "X-Accel-Buffering": "no",
    },
  });
}
