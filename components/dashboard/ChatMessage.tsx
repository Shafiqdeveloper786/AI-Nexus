"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bot, User, ThumbsUp, ThumbsDown, Copy, Check, Volume2, VolumeX, FileText, FileImage, Brain,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import CodeBlock from "./CodeBlock";
import type { ChatMessage as ChatMessageType } from "./mockData";

interface Props {
  message: ChatMessageType;
  index:   number;
}

/* ── Strip markdown for clean TTS ─────────────────────────────────────────── */
function stripMarkdown(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, "")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/#{1,6}\s+/g, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/>\s+/g, "")
    .replace(/[-*+]\s/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\n{2,}/g, ". ")
    .trim();
}

/* ── Cyberpunk markdown component map ─────────────────────────────────────── */
const mdComponents: React.ComponentProps<typeof ReactMarkdown>["components"] = {
  h1: ({ children }) => (
    <h1
      className="font-['Orbitron'] font-bold tracking-wide mt-4 mb-2 first:mt-0"
      style={{ fontSize: "1.05rem", color: "#00d4ff", textShadow: "0 0 12px rgba(0,212,255,0.35)" }}
    >
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2
      className="font-['Orbitron'] font-bold tracking-wide mt-3 mb-1.5"
      style={{ fontSize: "0.95rem", color: "#00d4ff", textShadow: "0 0 10px rgba(0,212,255,0.25)" }}
    >
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3
      className="font-['Orbitron'] font-semibold mt-2.5 mb-1"
      style={{ fontSize: "0.85rem", color: "rgba(0,212,255,0.8)" }}
    >
      {children}
    </h3>
  ),
  p: ({ children }) => (
    <p
      className="font-['Rajdhani'] mb-2 last:mb-0"
      style={{ fontSize: "0.875rem", lineHeight: 1.75, color: "rgba(226,232,240,0.88)" }}
    >
      {children}
    </p>
  ),
  ul: ({ children }) => (
    <ul className="mb-2 space-y-1" style={{ listStyle: "none", paddingLeft: "2px" }}>
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol
      className="mb-2 space-y-1 font-['Rajdhani']"
      style={{ listStyleType: "decimal", paddingLeft: "18px", fontSize: "0.875rem", color: "rgba(226,232,240,0.85)", lineHeight: 1.7 }}
    >
      {children}
    </ol>
  ),
  li: ({ children }) => (
    <li
      className="flex items-start gap-2 font-['Rajdhani']"
      style={{ fontSize: "0.875rem", color: "rgba(226,232,240,0.85)", lineHeight: 1.7 }}
    >
      <span
        className="flex-shrink-0 rounded-full mt-[7px]"
        style={{ width: "5px", height: "5px", background: "#00d4ff", boxShadow: "0 0 6px rgba(0,212,255,0.7)" }}
      />
      <span>{children}</span>
    </li>
  ),
  pre: ({ children }) => <>{children}</>,
  code: ({ className, children }) => {
    const match   = /language-(\w+)/.exec(className ?? "");
    const content = String(children).replace(/\n$/, "");
    if (match || content.includes("\n")) {
      return <CodeBlock language={match?.[1] ?? "text"} snippet={content} />;
    }
    return (
      <code
        className="font-mono"
        style={{ padding: "2px 6px", borderRadius: "4px", fontSize: "0.78rem", color: "#00d4ff", background: "rgba(0,212,255,0.08)", border: "1px solid rgba(0,212,255,0.15)" }}
      >
        {content}
      </code>
    );
  },
  blockquote: ({ children }) => (
    <blockquote
      className="my-2 font-['Rajdhani'] italic"
      style={{ borderLeft: "2px solid rgba(0,212,255,0.4)", paddingLeft: "12px", color: "rgba(148,163,184,0.72)" }}
    >
      {children}
    </blockquote>
  ),
  strong:  ({ children }) => <strong style={{ color: "white", fontWeight: 700 }}>{children}</strong>,
  em:      ({ children }) => <em style={{ color: "rgba(168,85,247,0.9)", fontStyle: "italic" }}>{children}</em>,
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noopener noreferrer" style={{ color: "#00d4ff", textDecoration: "underline", cursor: "pointer" }}>
      {children}
    </a>
  ),
  hr: () => <hr className="my-3" style={{ borderColor: "rgba(0,212,255,0.15)" }} />,
  table: ({ children }) => (
    <div className="overflow-x-auto mb-2 rounded-lg" style={{ border: "1px solid rgba(0,212,255,0.12)" }}>
      <table className="w-full font-['Rajdhani']" style={{ fontSize: "0.78rem", borderCollapse: "collapse" }}>
        {children}
      </table>
    </div>
  ),
  th: ({ children }) => (
    <th className="text-left font-bold" style={{ padding: "7px 10px", color: "#00d4ff", borderBottom: "1px solid rgba(0,212,255,0.2)", background: "rgba(0,212,255,0.05)" }}>
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td style={{ padding: "6px 10px", color: "rgba(226,232,240,0.72)", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
      {children}
    </td>
  ),
};

/* ── Inline thinking waveform — rendered inside the AI bubble while streaming
     and content is empty. Lives in the same container, so no layout shift.   */
const THINK_LABELS = ["Thinking", "Processing", "Analysing", "Generating"];
const WAVE_HEIGHTS = [0.4, 0.7, 1, 0.6, 0.9, 0.5, 0.8, 1, 0.4, 0.7];

function InlineThinking() {
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setPhase((p) => (p + 1) % THINK_LABELS.length), 1800);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <motion.div
          animate={{ boxShadow: ["0 0 0px rgba(168,85,247,0)", "0 0 16px rgba(168,85,247,0.5)", "0 0 0px rgba(168,85,247,0)"] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ background: "linear-gradient(135deg, rgba(168,85,247,0.4), rgba(0,212,255,0.3))", border: "1px solid rgba(168,85,247,0.5)" }}
        >
          <Brain className="w-3 h-3 text-[#a855f7]" />
        </motion.div>
        <AnimatePresence mode="wait">
          <motion.span
            key={phase}
            initial={{ opacity: 0, y: 3 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -3 }}
            transition={{ duration: 0.2 }}
            className="text-[9px] font-['Orbitron'] tracking-[0.2em] text-[rgba(168,85,247,0.65)]"
          >
            {THINK_LABELS[phase].toUpperCase()}
          </motion.span>
        </AnimatePresence>
        {[0, 1, 2].map((i) => (
          <motion.span key={i} animate={{ opacity: [0.2, 1, 0.2] }}
            transition={{ duration: 1, repeat: Infinity, delay: i * 0.25 }}
            className="w-1 h-1 rounded-full bg-[#a855f7]" />
        ))}
      </div>
      <div className="flex items-center gap-[3px]">
        {WAVE_HEIGHTS.map((h, i) => (
          <motion.div key={i}
            animate={{ scaleY: [h * 0.4, h, h * 0.4] }}
            transition={{ duration: 0.7 + i * 0.06, repeat: Infinity, ease: "easeInOut", delay: i * 0.07 }}
            className="w-[3px] rounded-full"
            style={{ height: "20px", background: `rgba(168,85,247,${0.3 + h * 0.45})`, transformOrigin: "center" }}
          />
        ))}
      </div>
    </div>
  );
}

/* ── Toast component ──────────────────────────────────────────────────────── */
function FeedbackToast({ text }: { text: string }) {
  return (
    <motion.div
      key="feedback-toast"
      initial={{ opacity: 0, y: 24, scale: 0.95 }}
      animate={{ opacity: 1, y: 0,  scale: 1    }}
      exit={{ opacity: 0,   y: 24, scale: 0.95 }}
      transition={{ duration: 0.22 }}
      className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[999] flex items-center gap-2.5 px-5 py-3 rounded-2xl pointer-events-none select-none"
      style={{
        background: "rgba(6,18,36,0.97)",
        border:     "1px solid rgba(0,212,255,0.22)",
        boxShadow:  "0 8px 40px rgba(0,0,0,0.7), 0 0 24px rgba(0,212,255,0.07)",
      }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
        style={{ background: "#00ff88", boxShadow: "0 0 6px rgba(0,255,136,0.8)" }}
      />
      <span className="text-sm font-['Rajdhani'] font-semibold text-[rgba(226,232,240,0.92)] whitespace-nowrap">
        {text}
      </span>
    </motion.div>
  );
}

/* ── Main component ───────────────────────────────────────────────────────── */
export default function ChatMessage({ message, index }: Props) {
  const [copied,   setCopied]   = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [toast,    setToast]    = useState<string | null>(null);
  const [mounted,  setMounted]  = useState(false);
  const isUser = message.role === "user";

  useEffect(() => {
    setMounted(true);
    return () => { window.speechSynthesis?.cancel(); };
  }, []);

  const showToast = (text: string) => {
    setToast(text);
    setTimeout(() => setToast(null), 3500);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      showToast("Copied to clipboard!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      showToast("Copy failed — please select text manually.");
    }
  };

  const handleThumbsUp = () => {
    showToast("Thanks! We're glad you liked the response.");
  };

  const handleThumbsDown = () => {
    showToast("Sorry to hear that. We'll work on improving!");
  };

  const handleSpeak = () => {
    if (!("speechSynthesis" in window)) {
      showToast("Text-to-speech is not supported in your browser.");
      return;
    }
    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }
    const clean      = stripMarkdown(message.content);
    const utterance  = new SpeechSynthesisUtterance(clean);
    utterance.rate   = 1;
    utterance.pitch  = 1;
    utterance.onend  = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(utterance);
    setSpeaking(true);
  };

  const aiActions = [
    {
      key:    "thumbs-up",
      icon:   ThumbsUp,
      label:  "Good response",
      action: handleThumbsUp,
      active: false,
      activeColor: "#00ff88",
    },
    {
      key:    "thumbs-down",
      icon:   ThumbsDown,
      label:  "Bad response",
      action: handleThumbsDown,
      active: false,
      activeColor: "#ef4444",
    },
    {
      key:    "copy",
      icon:   copied ? Check : Copy,
      label:  "Copy",
      action: handleCopy,
      active: copied,
      activeColor: "#00ff88",
    },
    {
      key:    "speak",
      icon:   speaking ? VolumeX : Volume2,
      label:  speaking ? "Stop reading" : "Read aloud",
      action: handleSpeak,
      active: speaking,
      activeColor: "#a855f7",
    },
  ];

  return (
    <>
      {/* Feedback toast portal */}
      {mounted && createPortal(
        <AnimatePresence>{toast && <FeedbackToast text={toast} />}</AnimatePresence>,
        document.body
      )}

      <motion.div
        initial={message.isStreaming ? false : { opacity: 0, y: isUser ? 8 : 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: isUser ? 0.18 : 0.14, ease: "easeOut" }}
        className={`flex gap-3 ${isUser ? "flex-row-reverse" : "flex-row"}`}
      >
        {/* Avatar */}
        <div
          className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center mt-1 ${
            isUser
              ? "bg-gradient-to-br from-[#00d4ff] to-[#7c3aed]"
              : "bg-gradient-to-br from-[rgba(168,85,247,0.3)] to-[rgba(0,212,255,0.3)] border border-[rgba(168,85,247,0.4)]"
          }`}
        >
          {isUser
            ? <User className="w-4 h-4 text-white" />
            : <Bot  className="w-4 h-4 text-[#a855f7]" />
          }
        </div>

        {/* Bubble */}
        <div className={`max-w-[80%] flex flex-col gap-1 ${isUser ? "items-end" : "items-start"}`}>
          {/* Header */}
          <div className={`flex items-center gap-2 ${isUser ? "flex-row-reverse" : ""}`}>
            <span className="text-[10px] font-['Orbitron'] tracking-wider text-[rgba(148,163,184,0.5)]">
              {isUser ? "YOU" : "AI NEXUS"}
            </span>
            <span className="text-[10px] text-[rgba(148,163,184,0.3)] font-['Rajdhani']">{message.time}</span>
          </div>

          {/* File attachment chip (user messages) */}
          {isUser && message.fileAttachment && (
            <div
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl mb-1 self-end"
              style={{
                background: message.fileAttachment.fileType === "image"
                  ? "rgba(168,85,247,0.1)" : "rgba(0,212,255,0.08)",
                border: message.fileAttachment.fileType === "image"
                  ? "1px solid rgba(168,85,247,0.25)" : "1px solid rgba(0,212,255,0.2)",
              }}
            >
              {message.fileAttachment.fileType === "image"
                ? <FileImage className="w-3 h-3 text-[#a855f7]" />
                : <FileText  className="w-3 h-3 text-[#00d4ff]" />
              }
              <span className="text-[11px] font-['Rajdhani'] font-semibold truncate max-w-[160px]"
                style={{ color: message.fileAttachment.fileType === "image" ? "#a855f7" : "#00d4ff" }}>
                {message.fileAttachment.name}
              </span>
              <span className="text-[10px] text-[rgba(148,163,184,0.4)] font-['Rajdhani']">
                {message.fileAttachment.size}
              </span>
            </div>
          )}

          {/* Content bubble */}
          <div
            className={`rounded-2xl px-4 py-3 ${isUser ? "rounded-tr-sm" : "rounded-tl-sm"}`}
            style={
              isUser
                ? {
                    background: "linear-gradient(135deg, rgba(0,212,255,0.15) 0%, rgba(124,58,237,0.2) 100%)",
                    border:     "1px solid rgba(0,212,255,0.25)",
                    color:      "white",
                    fontSize:   "0.875rem",
                    fontFamily: "Rajdhani, sans-serif",
                    lineHeight: 1.7,
                  }
                : {
                    background:    "linear-gradient(135deg, rgba(10,31,61,0.95) 0%, rgba(6,18,36,0.98) 100%)",
                    border:        "1px solid rgba(168,85,247,0.2)",
                    boxShadow:     "0 4px 28px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.03)",
                    minHeight:     "3rem",
                    overflow:      "hidden",
                    contain:       "layout",
                    willChange:    "contents",
                  }
            }
          >
            {isUser ? (
              message.content
            ) : message.isStreaming && !message.content ? (
              /* Thinking waveform lives INSIDE the bubble — zero layout shift */
              <InlineThinking />
            ) : (
              /* Text content — streaming cursor appended via CSS while isStreaming */
              <div className={message.isStreaming ? "nexus-streaming" : ""}>
                <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
                  {message.content}
                </ReactMarkdown>
              </div>
            )}

            {message.code && (
              <CodeBlock language={message.code.language} snippet={message.code.snippet} />
            )}

            {message.imageUrl && (
              <div className="mt-3 rounded-xl overflow-hidden" style={{ border: "1px solid rgba(168,85,247,0.25)" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={message.imageUrl} alt="AI generated" className="w-full max-w-sm rounded-xl" />
              </div>
            )}
          </div>

          {/* Action bar — AI messages only, hidden while streaming */}
          {!isUser && !message.isStreaming && (
            <div className="flex items-center gap-0.5 px-1 mt-0.5">
              {aiActions.map(({ key, icon: Icon, label, action, active, activeColor }) => (
                <motion.button
                  key={key}
                  whileHover={{ scale: 1.15 }}
                  whileTap={{ scale: 0.9 }}
                  title={label}
                  onClick={action}
                  className="w-6 h-6 rounded-md flex items-center justify-center transition-colors"
                  style={{ color: active ? activeColor : "rgba(148,163,184,0.3)" }}
                  onMouseEnter={(e) => {
                    if (!active) (e.currentTarget as HTMLButtonElement).style.color = "#00d4ff";
                  }}
                  onMouseLeave={(e) => {
                    if (!active) (e.currentTarget as HTMLButtonElement).style.color = "rgba(148,163,184,0.3)";
                  }}
                >
                  {/* Pulse ring when speaking */}
                  {key === "speak" && active && (
                    <span
                      className="absolute w-5 h-5 rounded-full animate-ping opacity-30"
                      style={{ background: activeColor }}
                    />
                  )}
                  <Icon className="w-3 h-3" />
                </motion.button>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </>
  );
}
