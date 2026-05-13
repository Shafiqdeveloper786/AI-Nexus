"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MessageSquare, Code2, ImageIcon, FileText, Clock,
  Loader2, Trash2, ArrowLeft, Download, Copy, Check,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import CodeBlock from "./CodeBlock";

type Kind = "chat" | "code" | "image" | "resume";

interface HistoryItem {
  id:          string;
  kind:        Kind;
  title:       string;
  tool?:       string;
  model?:      string;
  preview:     string;
  content?:    string;
  contentType?: string;
  metadata?:   Record<string, unknown>;
  time:        string;
  ts:          number;
}

interface HistoryData {
  chats:   HistoryItem[];
  code:    HistoryItem[];
  images:  HistoryItem[];
  resumes: HistoryItem[];
}

const TABS: { id: Kind | "all"; label: string; icon: React.ElementType }[] = [
  { id: "all",    label: "All",     icon: Clock       },
  { id: "chat",   label: "Chats",   icon: MessageSquare },
  { id: "code",   label: "Code",    icon: Code2       },
  { id: "image",  label: "Images",  icon: ImageIcon   },
  { id: "resume", label: "Resumes", icon: FileText    },
];

const KIND_COLOR: Record<Kind, string> = {
  chat:   "#00d4ff",
  code:   "#a855f7",
  image:  "#f0abfc",
  resume: "#00ff88",
};

/* ── Markdown for resume preview ─────────────────────────────────────────── */
const mdComponents: React.ComponentProps<typeof ReactMarkdown>["components"] = {
  h1: ({ children }) => (
    <h1 className="font-['Orbitron'] font-black text-base text-white mt-0 mb-1" style={{ textShadow: "0 0 12px rgba(0,212,255,0.25)" }}>{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="font-['Orbitron'] font-bold text-xs text-[#00d4ff] mt-4 mb-1 pb-1" style={{ borderBottom: "1px solid rgba(0,212,255,0.2)" }}>{children}</h2>
  ),
  h3: ({ children }) => <h3 className="font-['Rajdhani'] font-bold text-sm text-white mt-2 mb-0.5">{children}</h3>,
  p:  ({ children }) => <p className="font-['Rajdhani'] text-sm text-[rgba(226,232,240,0.78)] mb-1.5 leading-relaxed">{children}</p>,
  ul: ({ children }) => <ul style={{ listStyle: "none", paddingLeft: "2px" }} className="mb-2 space-y-1">{children}</ul>,
  li: ({ children }) => (
    <li className="flex items-start gap-2 text-sm font-['Rajdhani'] text-[rgba(226,232,240,0.8)]">
      <span className="mt-2 w-1 h-1 rounded-full bg-[#00d4ff] flex-shrink-0" />
      <span>{children}</span>
    </li>
  ),
  strong: ({ children }) => <strong className="text-white font-bold">{children}</strong>,
  hr: () => <hr className="my-3 border-[rgba(0,212,255,0.15)]" />,
  pre: ({ children }) => <>{children}</>,
  code: ({ className, children }) => {
    const match = /language-(\w+)/.exec(className ?? "");
    const content = String(children).replace(/\n$/, "");
    if (match || content.includes("\n")) return <CodeBlock language={match?.[1] ?? "text"} snippet={content} />;
    return <code className="px-1 py-0.5 rounded font-mono text-xs text-[#00d4ff] bg-[rgba(0,212,255,0.08)]">{content}</code>;
  },
};

export default function HistoryView() {
  const [data,       setData]       = useState<HistoryData | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [activeTab,  setActiveTab]  = useState<Kind | "all">("all");
  const [selected,   setSelected]   = useState<HistoryItem | null>(null);
  const [detailData, setDetailData] = useState<any>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [copied,     setCopied]     = useState(false);
  const [deleting,   setDeleting]   = useState<string | null>(null);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/history?view=full");
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  /* Load detail when an item is selected */
  useEffect(() => {
    if (!selected) { setDetailData(null); return; }
    if (selected.content) { setDetailData(selected); return; } // asset already has content
    setLoadingDetail(true);
    fetch(`/api/history/${selected.id}`)
      .then((r) => r.json())
      .then(setDetailData)
      .catch(console.error)
      .finally(() => setLoadingDetail(false));
  }, [selected]);

  const handleDelete = async (item: HistoryItem) => {
    setDeleting(item.id);
    const type = item.kind === "chat" ? "chat" : "asset";
    await fetch(`/api/history?id=${item.id}&type=${type}`, { method: "DELETE" });
    if (selected?.id === item.id) setSelected(null);
    await fetchHistory();
    setDeleting(null);
  };

  const handleCopy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = (item: HistoryItem) => {
    if (!item.content) return;
    const ext  = item.kind === "image" ? "png" : item.kind === "resume" ? "md" : "md";
    const mime = item.kind === "image" ? "image/png" : "text/markdown";
    if (item.kind === "image") {
      const a = document.createElement("a");
      a.href = item.content;
      a.download = `ai-nexus-image-${item.id}.png`;
      a.click();
    } else {
      const blob = new Blob([item.content], { type: mime });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href = url; a.download = `ai-nexus-${item.kind}-${item.id}.${ext}`; a.click();
      URL.revokeObjectURL(url);
    }
  };

  /* Build the flat list for the current tab */
  const allItems: HistoryItem[] = data
    ? [
        ...data.chats.map((i) => ({ ...i, kind: "chat" as Kind })),
        ...data.code.map((i) => ({ ...i, kind: "code" as Kind })),
        ...data.images.map((i) => ({ ...i, kind: "image" as Kind })),
        ...data.resumes.map((i) => ({ ...i, kind: "resume" as Kind })),
      ].sort((a, b) => b.ts - a.ts)
    : [];

  const filtered = activeTab === "all"
    ? allItems
    : (data
      ? {
          chat: data.chats, code: data.code,
          image: data.images, resume: data.resumes,
        }[activeTab] ?? []
      : []);

  if (loading) {
    return (
      <div className="flex flex-col flex-1 min-h-0 items-center justify-center gap-3">
        <Loader2 className="w-7 h-7 text-[#00d4ff] animate-spin" />
        <p className="text-[rgba(148,163,184,0.45)] text-sm font-['Rajdhani']">Loading history…</p>
      </div>
    );
  }

  /* ── Detail pane ─────────────────────────────────────────────────────── */
  if (selected) {
    const detail = detailData ?? selected;
    return (
      <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-3 flex-shrink-0"
          style={{ borderBottom: "1px solid rgba(0,212,255,0.07)" }}>
          <button
            onClick={() => setSelected(null)}
            className="flex items-center gap-1.5 text-[rgba(148,163,184,0.5)] hover:text-[#00d4ff] transition-colors text-xs font-['Rajdhani'] font-semibold"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back
          </button>
          <div className="flex-1 min-w-0">
            <p className="font-['Orbitron'] text-xs font-bold text-white truncate">{selected.title}</p>
            <p className="text-[9px] text-[rgba(148,163,184,0.35)] font-['Rajdhani']">{selected.time}</p>
          </div>
          <div className="flex items-center gap-1.5">
            {selected.content && (
              <>
                <button
                  onClick={() => handleCopy(detail.content ?? "")}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-['Rajdhani'] font-bold transition-all"
                  style={{ color: copied ? "#00ff88" : "rgba(148,163,184,0.55)", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}
                >
                  {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  {copied ? "Copied" : "Copy"}
                </button>
                <button
                  onClick={() => handleDownload(selected)}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-['Rajdhani'] font-bold text-[#00d4ff]"
                  style={{ background: "rgba(0,212,255,0.06)", border: "1px solid rgba(0,212,255,0.2)" }}
                >
                  <Download className="w-3 h-3" /> Save
                </button>
              </>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-5">
          {loadingDetail ? (
            <div className="flex items-center justify-center h-full gap-2">
              <Loader2 className="w-5 h-5 text-[#00d4ff] animate-spin" />
            </div>
          ) : selected.kind === "image" && detail.content ? (
            /* Image viewer */
            <div className="flex justify-center">
              <div className="rounded-2xl overflow-hidden max-w-lg w-full" style={{ border: "1px solid rgba(168,85,247,0.3)", boxShadow: "0 0 40px rgba(168,85,247,0.1)" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={detail.content} alt={selected.title} className="w-full block" />
              </div>
            </div>
          ) : selected.kind === "chat" && detail.messages ? (
            /* Chat messages */
            <div className="space-y-4 max-w-2xl mx-auto">
              {detail.messages.map((msg: any) => (
                <div
                  key={msg.id}
                  className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}
                >
                  <div
                    className="max-w-[80%] px-4 py-3 rounded-2xl text-sm font-['Rajdhani'] leading-relaxed"
                    style={msg.role === "user"
                      ? { background: "linear-gradient(135deg, rgba(0,212,255,0.15), rgba(124,58,237,0.2))", border: "1px solid rgba(0,212,255,0.25)", color: "white" }
                      : { background: "linear-gradient(135deg, rgba(10,31,61,0.95), rgba(6,18,36,0.98))", border: "1px solid rgba(168,85,247,0.2)", color: "rgba(226,232,240,0.88)" }
                    }
                  >
                    {msg.role === "assistant" ? (
                      <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>{msg.content}</ReactMarkdown>
                    ) : msg.content}
                  </div>
                </div>
              ))}
            </div>
          ) : (detail.content || detail.preview) ? (
            /* Resume / Code — rendered markdown */
            <div className="max-w-2xl mx-auto rounded-2xl p-6"
              style={{ background: "linear-gradient(160deg, rgba(8,22,46,0.96), rgba(3,11,26,0.98))", border: "1px solid rgba(0,212,255,0.12)" }}>
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
                {detail.content ?? detail.preview ?? ""}
              </ReactMarkdown>
            </div>
          ) : (
            <p className="text-center text-[rgba(148,163,184,0.4)] font-['Rajdhani'] text-sm">No preview available.</p>
          )}
        </div>
      </div>
    );
  }

  /* ── List pane ───────────────────────────────────────────────────────── */
  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 flex-shrink-0"
        style={{ borderBottom: "1px solid rgba(0,212,255,0.07)" }}>
        <div>
          <h2 className="font-['Orbitron'] text-sm font-bold text-white tracking-wide">History</h2>
          <p className="text-[10px] text-[rgba(0,212,255,0.5)] font-['Rajdhani'] tracking-widest mt-0.5">
            {allItems.length} item{allItems.length !== 1 ? "s" : ""} saved
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 px-4 pt-3 pb-0 flex-shrink-0">
        {TABS.map(({ id, label, icon: Icon }) => {
          const active = activeTab === id;
          const count  = id === "all" ? allItems.length
            : id === "chat" ? data?.chats.length ?? 0
            : id === "code" ? data?.code.length ?? 0
            : id === "image" ? data?.images.length ?? 0
            : data?.resumes.length ?? 0;
          return (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-['Rajdhani'] font-bold tracking-wider transition-all"
              style={active ? {
                background: "rgba(0,212,255,0.1)",
                border: "1px solid rgba(0,212,255,0.25)",
                color: "#00d4ff",
              } : {
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.06)",
                color: "rgba(148,163,184,0.5)",
              }}
            >
              <Icon className="w-3 h-3" />
              {label}
              <span
                className="rounded-full px-1 py-0.5 text-[9px] font-['Orbitron']"
                style={{ background: active ? "rgba(0,212,255,0.15)" : "rgba(255,255,255,0.05)" }}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Item list */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 gap-2 opacity-50">
            <Clock className="w-8 h-8 text-[rgba(148,163,184,0.3)]" />
            <p className="text-sm font-['Rajdhani'] text-[rgba(148,163,184,0.4)]">
              No {activeTab === "all" ? "history" : activeTab} items yet
            </p>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {(filtered as HistoryItem[]).map((item, idx) => {
              const Icon  = { chat: MessageSquare, code: Code2, image: ImageIcon, resume: FileText }[item.kind];
              const color = KIND_COLOR[item.kind];
              return (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ delay: idx * 0.03 }}
                  onClick={() => setSelected(item)}
                  className="group flex items-start gap-3 px-3.5 py-3 rounded-xl cursor-pointer transition-all"
                  style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.05)" }}
                  onMouseEnter={(e) => {
                    (e.currentTarget.style.background = "rgba(255,255,255,0.045)");
                    (e.currentTarget.style.border = `1px solid ${color}25`);
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget.style.background = "rgba(255,255,255,0.025)");
                    (e.currentTarget.style.border = "1px solid rgba(255,255,255,0.05)");
                  }}
                >
                  {/* Icon */}
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                    style={{ background: `${color}12`, border: `1px solid ${color}25` }}
                  >
                    {item.kind === "image" && item.preview?.startsWith("data:")
                      /* eslint-disable-next-line @next/next/no-img-element */
                      ? <img src={item.preview} alt="" className="w-8 h-8 object-cover rounded-lg" />
                      : <Icon className="w-3.5 h-3.5" style={{ color }} />
                    }
                  </div>

                  {/* Text */}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-['Rajdhani'] font-bold text-[rgba(226,232,240,0.85)] truncate">
                      {item.title}
                    </p>
                    <p className="text-[10px] text-[rgba(148,163,184,0.38)] truncate mt-0.5 font-['Rajdhani']">
                      {item.kind !== "image" ? item.preview : "Image generation"}
                    </p>
                  </div>

                  {/* Meta + delete */}
                  <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                    <span
                      className="text-[9px] font-['Orbitron'] px-1.5 py-0.5 rounded-full"
                      style={{ color, background: `${color}10`, border: `1px solid ${color}20` }}
                    >
                      {item.kind.toUpperCase()}
                    </span>
                    <span className="text-[9px] text-[rgba(148,163,184,0.25)] font-['Rajdhani']">{item.time}</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(item); }}
                      className="opacity-0 group-hover:opacity-100 text-[rgba(148,163,184,0.3)] hover:text-red-400 transition-all"
                    >
                      {deleting === item.id
                        ? <Loader2 className="w-3 h-3 animate-spin" />
                        : <Trash2 className="w-3 h-3" />}
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
