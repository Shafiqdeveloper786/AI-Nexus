"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, ImageIcon, AlertTriangle, RefreshCw, FileText, FileImage, X } from "lucide-react";
import { pushNotif } from "@/lib/notifications";
import FluidMessage from "./FluidMessage";
import ChatInput, { type AttachedFile } from "./ChatInput";
import { useUserProfile } from "@/hooks/useUserProfile";
import NoCreditsModal from "./NoCreditsModal";
import { toolCost, CREDITS } from "@/lib/credits";
import type { ChatMessage as ChatMessageType } from "./mockData";

export type { ChatMessageType };

/* ── Persistent document context ─────────────────────────────────────────── */
interface DocContext {
  name:     string;
  fileType: "image" | "pdf" | "text";
  size:     string;
  summary:  string; // first ~800 chars of AI's analysis — injected into follow-ups
}

const TOOL_LABELS: Record<string, { title: string; subtitle: string }> = {
  chat:   { title: "AI Chat",        subtitle: "Nexus Pro · Fast · Coder · Vision" },
  code:   { title: "Code Generator", subtitle: "TypeScript · Python · Rust · Go" },
  image:  { title: "Image Studio",   subtitle: "FLUX Schnell · SDXL" },
  resume: { title: "Resume Builder", subtitle: "ATS-optimised · PDF export" },
  sql:    { title: "SQL Query",      subtitle: "PostgreSQL · MongoDB · Prisma ORM" },
};

const TOOL_HINTS: Record<string, string> = {
  chat:   "Ask anything — or attach a PDF / image to analyse it with AI Vision",
  code:   "Describe the component or function you need",
  image:  "Describe the image you want to generate",
  resume: "Fill in your details and let AI craft the perfect resume",
  sql:    "Describe your schema or the query you want to optimise",
};

interface Props {
  activeTool:          string;
  currentChatId:       string | null;
  onChatCreated:       (chatId: string, firstMessage: string) => void;
  onOpenSubscription?: () => void;
}

export default function ChatArea({ activeTool, currentChatId, onChatCreated, onOpenSubscription }: Props) {
  const [messages,      setMessages]      = useState<ChatMessageType[]>([]);
  const [isTyping,      setIsTyping]      = useState(false);
  const [noCreditsOpen, setNoCreditsOpen] = useState(false);
  const [loadError,     setLoadError]     = useState<string | null>(null);
  const [loadingChat,   setLoadingChat]   = useState(false);
  const [docCtx,        setDocCtx]        = useState<DocContext | null>(null);

  /* Scroll refs — smart sticky-bottom behaviour */
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef      = useRef(true);
  const abortRef           = useRef<AbortController | null>(null);
  const justCreatedIds     = useRef<Set<string>>(new Set());
  const notifiedLow        = useRef(false);

  const handleScroll = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    isAtBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
  }, []);

  const { profile, refetch: refetchProfile, decrementCredits } = useUserProfile();

  /* Load existing chat — skip re-fetch for chats created this session */
  useEffect(() => {
    if (!currentChatId) { setMessages([]); return; }
    if (justCreatedIds.current.has(currentChatId)) return;
    setLoadingChat(true);
    setLoadError(null);
    fetch(`/api/history/${currentChatId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) { setLoadError(data.error); return; }
        setMessages(data.messages.map((m: ChatMessageType) => ({ ...m, id: m.id ?? Date.now().toString() })));
      })
      .catch(() => setLoadError("Failed to load chat history."))
      .finally(() => setLoadingChat(false));
  }, [currentChatId]);

  useEffect(() => { setMessages([]); setDocCtx(null); }, [activeTool]);

  /* Sticky-bottom auto-scroll: only fires when user hasn't scrolled up */
  useEffect(() => {
    if (!isAtBottomRef.current) return;
    const el = scrollContainerRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "instant" } as ScrollToOptions);
  }, [messages]);

  useEffect(() => () => { abortRef.current?.abort(); }, []);

  const handleStop = useCallback(() => {
    abortRef.current?.abort();
    setIsTyping(false);
  }, []);

  const LOW_CREDIT_THRESHOLD = 2000;

  const handleSend = useCallback(
    async (text: string, modelId: string, file?: AttachedFile | null) => {
      /* File analysis uses the same credit cost as image generation (vision model) */
      const cost = file ? CREDITS.IMAGE : toolCost(activeTool);

      /* Credit gate — zero credits → redirect straight to subscription tab */
      if (profile && profile.subscription === "free" && profile.credits <= 0) {
        pushNotif({ title: "No Credits Left", sub: "Upgrade to Pro for unlimited AI access.", type: "error" });
        onOpenSubscription?.();
        return;
      }
      /* Not enough credits for this specific action → modal */
      if (profile && profile.credits < cost && profile.subscription === "free") {
        setNoCreditsOpen(true);
        pushNotif({ title: "Credits Exhausted", sub: `This action needs ${cost} credits.`, type: "error" });
        return;
      }
      if (
        profile &&
        profile.subscription === "free" &&
        profile.credits - cost <= LOW_CREDIT_THRESHOLD &&
        !notifiedLow.current
      ) {
        notifiedLow.current = true;
        pushNotif({
          title: "Low Credits Warning",
          sub:   `Only ${profile.credits - cost} credits remaining.`,
          type:  "warning",
        });
      }

      decrementCredits(cost);

      const userMsg: ChatMessageType = {
        id:      Date.now().toString(),
        role:    "user",
        content: text || (file ? `Analyse this file: ${file.name}` : ""),
        fileAttachment: file
          ? { name: file.name, fileType: file.fileType, size: file.size }
          : undefined,
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, userMsg]);
      setIsTyping(true);

      abortRef.current?.abort();
      abortRef.current = new AbortController();

      /* ── A: File analysis ──────────────────────────────────────────────── */
      if (file) {
        const aiMsgId = (Date.now() + 1).toString();
        /* Pre-create bubble with isStreaming so thinking waveform shows inside it */
        setMessages((prev) => [
          ...prev,
          { id: aiMsgId, role: "assistant", content: "", isStreaming: true, time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) },
        ]);

        try {
          const res = await fetch("/api/analyze-file", {
            method:  "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              question:    text,
              fileContent: file.content,
              fileType:    file.fileType,
              fileName:    file.name,
              mimeType:    file.mimeType,
            }),
            signal: abortRef.current.signal,
          });

          if (res.status === 403) {
            /* Not enough credits for vision analysis */
            setMessages((prev) => prev.filter((m) => m.id !== aiMsgId && m.id !== userMsg.id));
            setNoCreditsOpen(true);
            pushNotif({ title: "Credits Exhausted", sub: `Document analysis costs ${CREDITS.IMAGE} credits.`, type: "error" });
            return;
          }
          if (!res.ok || !res.body) {
            const d = await res.json().catch(() => ({}));
            setMessages((prev) =>
              prev.map((m) => m.id === aiMsgId ? { ...m, content: `⚠️ **${d.error ?? `Error ${res.status}`}**`, isStreaming: false } : m)
            );
            return;
          }

          const reader  = res.body.getReader();
          const decoder = new TextDecoder();
          let   content = "";

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            content += decoder.decode(value, { stream: true });
            setMessages((prev) => prev.map((m) => m.id === aiMsgId ? { ...m, content, isStreaming: true } : m));
          }

          /* Mark streaming complete */
          setMessages((prev) => prev.map((m) => m.id === aiMsgId ? { ...m, isStreaming: false } : m));

          /* Persist doc context for seamless follow-up questions */
          if (content.trim()) {
            setDocCtx({
              name:     file.name,
              fileType: file.fileType,
              size:     file.size,
              summary:  content.slice(0, 800),
            });
          }
        } catch (err) {
          if ((err as Error).name === "AbortError") {
            setMessages((prev) => prev.map((m) => m.id === aiMsgId ? { ...m, isStreaming: false } : m)
              .filter((m) => !(m.id === aiMsgId && !m.content.trim())));
            return;
          }
          setMessages((prev) =>
            prev.map((m) =>
              m.id === aiMsgId ? { ...m, content: `⚠️ **Analysis failed:** ${(err as Error).message}`, isStreaming: false } : m
            )
          );
        } finally {
          setIsTyping(false);
          await refetchProfile();
        }
        return;
      }

      /* ── B: Image generation ───────────────────────────────────────────── */
      if (activeTool === "image") {
        try {
          const res = await fetch("/api/generate-image", {
            method:  "POST",
            headers: { "Content-Type": "application/json" },
            body:    JSON.stringify({ prompt: text, model: modelId, chatId: currentChatId ?? undefined }),
            signal:  abortRef.current.signal,
          });

          if (res.status === 403) {
            setNoCreditsOpen(true);
            setMessages((p) => p.filter((m) => m.id !== userMsg.id));
            return;
          }
          if (res.status === 429) {
            /* Daily image limit hit — redirect to subscription */
            setMessages((p) => p.filter((m) => m.id !== userMsg.id));
            onOpenSubscription?.();
            pushNotif({ title: "Daily Image Limit Reached", sub: `${CREDITS.DAILY_IMAGE_LIMIT ?? 3} free images/day. Upgrade for unlimited.`, type: "warning" });
            return;
          }

          const data      = await res.json();
          await refetchProfile();
          const aiContent = !res.ok
            ? `⚠️ **${data.message ?? data.error ?? `Error ${res.status}`}**`
            : data.imageUrl ? "Here's your generated image:" : `⚠️ **${data.error ?? "No image returned"}**`;

          setMessages((prev) => [
            ...prev,
            {
              id:       (Date.now() + 1).toString(),
              role:     "assistant",
              content:  aiContent,
              imageUrl: data.imageUrl,
              time:     new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            },
          ]);
        } catch (err) {
          if ((err as Error).name === "AbortError") return;
          setMessages((prev) => [
            ...prev,
            { id: (Date.now() + 1).toString(), role: "assistant", content: "⚠️ Image generation failed.", time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) },
          ]);
        } finally { setIsTyping(false); }
        return;
      }

      /* ── C: Streaming text chat ────────────────────────────────────────── */
      const aiMsgId  = (Date.now() + 1).toString();
      const msgTime  = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

      /* Pre-create the AI bubble BEFORE the fetch — the waveform renders inside
         it immediately so there is never a separate "thinking" element to swap
         out, eliminating all layout shift / vibration during streaming. */
      setMessages((prev) => [
        ...prev,
        { id: aiMsgId, role: "assistant", content: "", isStreaming: true, time: msgTime },
      ]);

      try {
        const res = await fetch("/api/chat", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message:    text,
            model:      modelId,
            tool:       activeTool,
            chatId:     currentChatId ?? undefined,
            docContext: docCtx
              ? `Discussing: "${docCtx.name}" (${docCtx.fileType})\n\nInitial analysis summary:\n${docCtx.summary}`
              : undefined,
          }),
          signal: abortRef.current.signal,
        });

        if (res.status === 403) {
          /* Remove the pre-created bubble + the user message */
          setMessages((prev) => prev.filter((m) => m.id !== aiMsgId && m.id !== userMsg.id));
          setNoCreditsOpen(true);
          return;
        }
        if (!res.ok) {
          let errMsg = `Server error (${res.status})`;
          try { const d = await res.json(); errMsg = d.message ?? d.error ?? errMsg; } catch { /* */ }
          setMessages((prev) =>
            prev.map((m) => m.id === aiMsgId ? { ...m, content: `⚠️ **${errMsg}**`, isStreaming: false } : m)
          );
          return;
        }

        const newChatId = res.headers.get("X-Chat-Id");
        if (newChatId && newChatId !== currentChatId) {
          justCreatedIds.current.add(newChatId);
          onChatCreated(newChatId, text);
        }

        if (!res.body) throw new Error("No response stream");

        const reader  = res.body.getReader();
        const decoder = new TextDecoder();
        let   content = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          content += decoder.decode(value, { stream: true });
          setMessages((prev) => prev.map((m) => m.id === aiMsgId ? { ...m, content, isStreaming: true } : m));
        }

        /* Mark stream complete — removes waveform cursor */
        setMessages((prev) => prev.map((m) => m.id === aiMsgId ? { ...m, isStreaming: false } : m));

        if (!content.trim()) {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === aiMsgId
                ? { ...m, content: "⚠️ Empty response — check your GROQ_API_KEY in .env.local.", isStreaming: false }
                : m
            )
          );
        }
        await refetchProfile();
      } catch (err) {
        if ((err as Error).name === "AbortError") {
          /* Keep partial content; remove the bubble only if nothing was received */
          setMessages((prev) =>
            prev
              .map((m) => m.id === aiMsgId ? { ...m, isStreaming: false } : m)
              .filter((m) => !(m.id === aiMsgId && !m.content.trim()))
          );
          return;
        }
        const msg = err instanceof Error ? err.message : "Unknown error";
        setMessages((prev) =>
          prev.map((m) => m.id === aiMsgId ? { ...m, content: `⚠️ **Network error:** ${msg}`, isStreaming: false } : m)
        );
      } finally { setIsTyping(false); }
    },
    [activeTool, currentChatId, docCtx, onChatCreated, onOpenSubscription, profile, refetchProfile, decrementCredits]
  );

  const info              = TOOL_LABELS[activeTool] ?? TOOL_LABELS.chat;
  const creditsLow        = profile && profile.credits <= 2 && profile.subscription === "free";
  const isCreditsExhausted = !!profile && profile.credits <= 0 && profile.subscription === "free";
  const DocIcon           = docCtx?.fileType === "image" ? FileImage : FileText;

  return (
    <>
      <NoCreditsModal
        isOpen={noCreditsOpen}
        onClose={() => setNoCreditsOpen(false)}
        required={toolCost(activeTool)}
        current={profile?.credits}
        onUpgrade={onOpenSubscription}
      />

      <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
        {/* ── Tool header ─────────────────────────────────────── */}
        <div
          className="flex items-center justify-between px-5 py-3 flex-shrink-0"
          style={{ borderBottom: "1px solid rgba(0,212,255,0.07)" }}
        >
          <div>
            <h2 className="font-['Orbitron'] text-sm font-bold text-white tracking-wide">{info.title}</h2>
            <p className="text-[10px] text-[rgba(0,212,255,0.5)] font-['Rajdhani'] tracking-widest mt-0.5">{info.subtitle}</p>
          </div>
          <div className="flex items-center gap-2">
            {/* PROCESSING indicator — header-only, no floating card */}
            <AnimatePresence>
              {isTyping && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.85 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.85 }}
                  transition={{ duration: 0.15 }}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-full flex-shrink-0"
                  style={{ background: "rgba(168,85,247,0.08)", border: "1px solid rgba(168,85,247,0.22)" }}
                >
                  {[0, 1, 2].map((i) => (
                    <motion.span key={i}
                      animate={{ opacity: [0.3, 1, 0.3] }}
                      transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.2 }}
                      className="w-1 h-1 rounded-full bg-[#a855f7]" />
                  ))}
                  <span className="text-[9px] font-['Orbitron'] tracking-[0.15em] text-[rgba(168,85,247,0.7)]">
                    PROCESSING
                  </span>
                </motion.div>
              )}
            </AnimatePresence>

            {profile && (
              <motion.button
                whileHover={{ scale: 1.03 }}
                onClick={() => creditsLow && setNoCreditsOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border transition-all"
                style={{
                  border:     `1px solid ${creditsLow ? "rgba(251,146,60,0.35)" : "rgba(0,212,255,0.2)"}`,
                  background: creditsLow ? "rgba(251,146,60,0.06)" : "rgba(0,212,255,0.05)",
                }}
              >
                {creditsLow && <AlertTriangle className="w-3 h-3 text-orange-400" />}
                <span className="text-[10px] font-['Orbitron'] font-bold" style={{ color: creditsLow ? "#fb923c" : "#00d4ff" }}>
                  {profile.credits.toLocaleString()} credits
                </span>
              </motion.button>
            )}
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[rgba(0,255,136,0.22)] bg-[rgba(0,255,136,0.05)]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#00ff88] animate-pulse" />
              <span className="text-[10px] font-['Orbitron'] text-[#00ff88] tracking-widest">ONLINE</span>
            </div>
          </div>
        </div>

        {/* ── Active document context banner ──────────────────── */}
        <AnimatePresence>
          {docCtx && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="flex-shrink-0 overflow-hidden"
            >
              <div
                className="flex items-center gap-2.5 px-5 py-2"
                style={{
                  background: "rgba(168,85,247,0.06)",
                  borderBottom: "1px solid rgba(168,85,247,0.14)",
                }}
              >
                <DocIcon className="w-3 h-3 text-[#a855f7] flex-shrink-0" />
                <span className="text-[10px] font-['Rajdhani'] font-semibold text-[rgba(168,85,247,0.85)] flex-1 truncate">
                  Document context active: <span className="text-white">{docCtx.name}</span>
                  <span className="text-[rgba(148,163,184,0.4)] ml-1">— follow-up questions will reference this file</span>
                </span>
                <motion.button
                  whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
                  onClick={() => setDocCtx(null)}
                  title="Clear document context"
                  className="w-5 h-5 rounded-md flex items-center justify-center text-[rgba(148,163,184,0.3)] hover:text-red-400 transition-colors flex-shrink-0"
                >
                  <X className="w-3 h-3" />
                </motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Message list ────────────────────────────────────── */}
        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto px-4 py-5 space-y-5 min-h-0"
          style={{ overflowAnchor: "none" }}
        >
          {loadingChat ? (
            <div className="flex flex-col items-center justify-center h-full gap-3">
              <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                className="w-8 h-8 border-2 border-[rgba(0,212,255,0.2)] border-t-[#00d4ff] rounded-full" />
              <p className="text-[rgba(148,163,184,0.4)] text-sm font-['Rajdhani']">Loading conversation…</p>
            </div>
          ) : loadError ? (
            <div className="flex flex-col items-center justify-center h-full gap-3">
              <AlertTriangle className="w-8 h-8 text-orange-400 opacity-60" />
              <p className="text-[rgba(148,163,184,0.5)] text-sm font-['Rajdhani']">{loadError}</p>
              <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                onClick={() => setLoadError(null)}
                className="flex items-center gap-1.5 text-[#00d4ff] text-xs font-['Rajdhani'] font-bold">
                <RefreshCw className="w-3.5 h-3.5" /> Try again
              </motion.button>
            </div>
          ) : (
            <AnimatePresence initial={false}>
              {messages.length === 0 && (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                  className="flex flex-col items-center justify-center h-full gap-5 pt-16"
                >
                  <motion.div
                    animate={{ y: [0, -8, 0] }} transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                    className="w-16 h-16 rounded-2xl flex items-center justify-center"
                    style={{ background: "linear-gradient(135deg, rgba(0,212,255,0.12), rgba(168,85,247,0.12))", border: "1px solid rgba(0,212,255,0.18)", boxShadow: "0 0 40px rgba(0,212,255,0.08)" }}
                  >
                    {activeTool === "image"
                      ? <ImageIcon className="w-7 h-7 text-[#00d4ff]" />
                      : <Sparkles  className="w-7 h-7 text-[#00d4ff]" />
                    }
                  </motion.div>
                  <div className="text-center max-w-xs px-4">
                    <p className="font-['Orbitron'] text-base font-bold text-white mb-2">Start a Conversation</p>
                    <p className="text-[rgba(148,163,184,0.45)] text-sm font-['Rajdhani'] leading-relaxed">
                      {TOOL_HINTS[activeTool]}
                    </p>
                  </div>
                </motion.div>
              )}
              {messages.map((msg, i) => (
                <FluidMessage key={msg.id} message={msg} index={i} />
              ))}
            </AnimatePresence>
          )}

        </div>

        {/* ── Chat input / Credits exhausted ─────────────────── */}
        <div className="flex-shrink-0 px-4 pb-4 pt-2">
          <AnimatePresence mode="wait">
            {isCreditsExhausted ? (
              <motion.button
                key="exhausted"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                transition={{ duration: 0.25 }}
                onClick={() => onOpenSubscription?.()}
                className="w-full py-3.5 rounded-xl font-['Orbitron'] text-sm font-bold tracking-widest flex items-center justify-center gap-2.5 cursor-pointer"
                style={{
                  background: "linear-gradient(135deg, rgba(251,146,60,0.12), rgba(239,68,68,0.1))",
                  border:     "1px solid rgba(251,146,60,0.4)",
                  color:      "#fb923c",
                  boxShadow:  "0 0 24px rgba(251,146,60,0.08)",
                }}
              >
                <AlertTriangle className="w-4 h-4" />
                Credits Exhausted — Upgrade to Pro
              </motion.button>
            ) : (
              <motion.div key="input" initial={false} animate={{ opacity: 1 }}>
                <ChatInput
                  onSend={handleSend}
                  activeTool={activeTool}
                  isGenerating={isTyping}
                  onStop={handleStop}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </>
  );
}
