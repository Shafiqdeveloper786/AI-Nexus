"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Send, Square, Paperclip, ChevronDown, Zap, Code2, Eye, Brain, ImageIcon, X, FileText, FileImage,
} from "lucide-react";

export interface AttachedFile {
  name:     string;
  fileType: "image" | "pdf" | "text";
  mimeType: string;
  content:  string;   // base64 for images; raw text for txt/pdf
  size:     string;
}

export const AI_MODELS = [
  { id: "nexus-pro",    label: "Nexus Pro",    sub: "Balanced & Smart",          color: "#00d4ff", icon: Brain },
  { id: "nexus-fast",   label: "Nexus Fast",   sub: "Lightning Fast",            color: "#00ff88", icon: Zap   },
  { id: "nexus-code",   label: "Nexus Coder",  sub: "Optimized for Programming", color: "#a855f7", icon: Code2 },
  { id: "nexus-vision", label: "Nexus Vision", sub: "Document & Image Analysis", color: "#fbbf24", icon: Eye   },
];

const IMAGE_MODELS = [
  { id: "flux", label: "FLUX Schnell", sub: "Fast & sharp",  color: "#f0abfc", icon: ImageIcon },
  { id: "sdxl", label: "SDXL",         sub: "High quality",  color: "#a855f7", icon: ImageIcon },
];

const TOOL_PLACEHOLDERS: Record<string, string> = {
  chat:   "Ask me anything — or attach a file to analyse it…",
  code:   "Describe the component or function you need…",
  image:  "Describe the image — style, subject, mood…",
  resume: "Paste your experience and let AI refine it…",
  sql:    "Describe your schema or write a query to optimise…",
};

function formatSize(bytes: number): string {
  if (bytes < 1024)          return `${bytes} B`;
  if (bytes < 1024 * 1024)   return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}


interface ChatInputProps {
  onSend:        (text: string, modelId: string, file?: AttachedFile | null) => void;
  activeTool:    string;
  isGenerating?: boolean;
  onStop?:       () => void;
}

export default function ChatInput({ onSend, activeTool, isGenerating = false, onStop }: ChatInputProps) {
  const isImage = activeTool === "image";
  const models  = isImage ? IMAGE_MODELS : AI_MODELS;

  const [value,         setValue]         = useState("");
  const [selectedModel, setSelectedModel] = useState(models[0]);
  const [modelOpen,     setModelOpen]     = useState(false);
  const [dropdownPos,   setDropdownPos]   = useState<{ top: number; left: number } | null>(null);
  const [mounted,       setMounted]       = useState(false);
  const [attachedFile,  setAttachedFile]  = useState<AttachedFile | null>(null);
  const [fileLoading,   setFileLoading]   = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const modelBtnRef = useRef<HTMLButtonElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setMounted(true); }, []);

  const validModel = models.find((m) => m.id === selectedModel.id) ?? models[0];

  /* Close dropdown on outside click */
  useEffect(() => {
    if (!modelOpen) return;
    const handler = (e: MouseEvent) => {
      if (!(e.target as Element).closest("[data-model-dropdown]")) setModelOpen(false);
    };
    window.addEventListener("mousedown", handler);
    return () => window.removeEventListener("mousedown", handler);
  }, [modelOpen]);

  useEffect(() => {
    if (!modelOpen || !modelBtnRef.current) return;
    const update = () => {
      const r = modelBtnRef.current!.getBoundingClientRect();
      setDropdownPos({ top: r.top, left: r.left });
    };
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => { window.removeEventListener("resize", update); window.removeEventListener("scroll", update, true); };
  }, [modelOpen]);

  const openDropdown = () => {
    if (!modelBtnRef.current) return;
    const r = modelBtnRef.current.getBoundingClientRect();
    setDropdownPos({ top: r.top, left: r.left });
    setModelOpen((v) => !v);
  };

  /* ── File selection ─────────────────────────────────── */
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileLoading(true);

    const reader = new FileReader();
    const size   = formatSize(file.size);

    if (file.type.startsWith("image/")) {
      reader.readAsDataURL(file);
      reader.onload = () => {
        const dataUrl = reader.result as string;
        const base64  = dataUrl.split(",")[1] ?? "";
        setAttachedFile({ name: file.name, fileType: "image", mimeType: file.type, content: base64, size });
        setFileLoading(false);
      };
    } else if (file.type === "application/pdf") {
      /* Send raw PDF as base64 — server uses pdf-parse for reliable extraction */
      reader.readAsDataURL(file);
      reader.onload = () => {
        const base64 = (reader.result as string).split(",")[1] ?? "";
        setAttachedFile({ name: file.name, fileType: "pdf", mimeType: file.type, content: base64, size });
        setFileLoading(false);
      };
    } else {
      /* Text file — send as base64 so server decodes it uniformly */
      reader.readAsDataURL(file);
      reader.onload = () => {
        const base64 = (reader.result as string).split(",")[1] ?? "";
        setAttachedFile({ name: file.name, fileType: "text", mimeType: file.type || "text/plain", content: base64, size });
        setFileLoading(false);
      };
    }

    /* Reset input so same file can be re-selected */
    e.target.value = "";
  };

  const handleSend = () => {
    const trimmed = value.trim();
    if (!trimmed && !attachedFile) return;
    onSend(trimmed, validModel.id, attachedFile);
    setValue("");
    setAttachedFile(null);
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const handleInput = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 140) + "px";
  };

  const ModelIcon = validModel.icon;
  const canSend   = !!(value.trim() || attachedFile);

  const dropdownStyle: React.CSSProperties = dropdownPos ? {
    position: "fixed",
    left:     dropdownPos.left,
    bottom:   window.innerHeight - dropdownPos.top + 8,
    width:    220,
    zIndex:   9999,
  } : {};

  const fileIconColor = attachedFile?.fileType === "image" ? "#a855f7" : "#00d4ff";
  const FileTypeIcon  = attachedFile?.fileType === "image" ? FileImage : FileText;

  return (
    <div className="relative">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept="image/*,.pdf,.txt,.md,.csv,.json"
        onChange={handleFileSelect}
      />

      {/* Ambient glow */}
      <div className="absolute -inset-px rounded-2xl bg-gradient-to-r from-[rgba(0,212,255,0.12)] via-[rgba(168,85,247,0.08)] to-[rgba(0,212,255,0.12)] blur-sm pointer-events-none" />

      <div
        className="relative rounded-2xl overflow-hidden"
        style={{
          background: "linear-gradient(135deg, rgba(10,31,61,0.96), rgba(6,18,36,0.99))",
          border:     "1px solid rgba(0,212,255,0.18)",
          boxShadow:  "0 8px 32px rgba(0,0,0,0.5)",
        }}
      >
        <div className="h-[1px] bg-gradient-to-r from-transparent via-[rgba(0,212,255,0.28)] to-transparent" />

        {/* Toolbar */}
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-[rgba(255,255,255,0.04)]">
          {/* Paperclip — file upload */}
          <motion.button
            whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
            onClick={() => fileInputRef.current?.click()}
            disabled={fileLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-['Rajdhani'] font-semibold tracking-wider border transition-all disabled:opacity-50"
            style={attachedFile ? {
              color:       fileIconColor,
              borderColor: `${fileIconColor}40`,
              background:  `${fileIconColor}0c`,
            } : {
              color:       "rgba(148,163,184,0.6)",
              borderColor: "transparent",
              background:  "transparent",
            }}
          >
            {fileLoading ? (
              <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                className="w-3.5 h-3.5 border border-[rgba(0,212,255,0.4)] border-t-[#00d4ff] rounded-full" />
            ) : (
              <Paperclip className="w-3.5 h-3.5" />
            )}
            <span className="hidden sm:inline">{fileLoading ? "Reading…" : "Attach"}</span>
          </motion.button>

          <div className="w-px h-4 bg-[rgba(255,255,255,0.06)]" />

          {/* Model selector */}
          <div data-model-dropdown>
            <motion.button
              ref={modelBtnRef}
              whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
              onClick={openDropdown}
              data-model-dropdown
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-['Rajdhani'] font-semibold tracking-wider border transition-all"
              style={{ color: validModel.color, borderColor: `${validModel.color}30`, background: `${validModel.color}0c` }}
            >
              <ModelIcon className="w-3.5 h-3.5" />
              <span>{validModel.label}</span>
              <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${modelOpen ? "rotate-180" : ""}`} />
            </motion.button>
          </div>

          {/* Keyboard hint */}
          <div className="ml-auto text-[10px] font-['Rajdhani'] text-[rgba(148,163,184,0.28)] hidden sm:flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 rounded border border-[rgba(148,163,184,0.12)] bg-[rgba(255,255,255,0.03)]">↵</kbd>
            <span>send</span>
            <kbd className="px-1.5 py-0.5 rounded border border-[rgba(148,163,184,0.12)] bg-[rgba(255,255,255,0.03)] ml-2">⇧↵</kbd>
            <span>newline</span>
          </div>
        </div>

        {/* Attached file chip */}
        <AnimatePresence>
          {attachedFile && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.18 }}
              className="px-4 pt-2.5 pb-0"
            >
              <div
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl"
                style={{ background: `${fileIconColor}0c`, border: `1px solid ${fileIconColor}28` }}
              >
                <FileTypeIcon className="w-3.5 h-3.5 flex-shrink-0" style={{ color: fileIconColor }} />
                <span className="text-[11px] font-['Rajdhani'] font-semibold truncate max-w-[180px]"
                  style={{ color: fileIconColor }}>
                  {attachedFile.name}
                </span>
                <span className="text-[10px] text-[rgba(148,163,184,0.4)] font-['Rajdhani']">
                  {attachedFile.size}
                </span>
                <button onClick={() => setAttachedFile(null)} className="transition-colors hover:text-red-400"
                  style={{ color: "rgba(148,163,184,0.35)" }}>
                  <X className="w-3 h-3" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Input row */}
        <div className="flex items-end gap-3 px-4 py-3">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onInput={handleInput}
            rows={1}
            placeholder={attachedFile
              ? `Ask something about ${attachedFile.name}…`
              : (TOOL_PLACEHOLDERS[activeTool] ?? TOOL_PLACEHOLDERS.chat)
            }
            className="flex-1 bg-transparent text-sm font-['Rajdhani'] text-[rgba(226,232,240,0.9)] placeholder:text-[rgba(148,163,184,0.28)] resize-none outline-none leading-relaxed"
            style={{ minHeight: "24px", maxHeight: "140px" }}
          />

          {isGenerating ? (
            /* ── Stop button ── */
            <motion.button
              onClick={onStop}
              whileHover={{ scale: 1.08, boxShadow: "0 0 24px rgba(239,68,68,0.5)" }}
              whileTap={{ scale: 0.93 }}
              title="Stop generating"
              className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center transition-all"
              style={{ background: "linear-gradient(135deg, #dc2626, #ef4444)", boxShadow: "0 0 16px rgba(239,68,68,0.4)" }}
            >
              <Square className="w-4 h-4 text-white" fill="white" />
            </motion.button>
          ) : (
            /* ── Send button ── */
            <motion.button
              onClick={handleSend}
              whileHover={canSend ? { scale: 1.08, boxShadow: "0 0 24px rgba(0,212,255,0.5)" } : {}}
              whileTap={canSend ? { scale: 0.93 } : {}}
              disabled={!canSend}
              className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center transition-all disabled:opacity-25 disabled:cursor-not-allowed"
              style={canSend ? {
                background: "linear-gradient(135deg, #00d4ff, #7c3aed)",
                boxShadow:  "0 0 20px rgba(0,212,255,0.3)",
              } : {
                background: "rgba(255,255,255,0.05)",
                border:     "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <Send className="w-4 h-4 text-white" />
            </motion.button>
          )}
        </div>
      </div>

      {/* ── Model dropdown portal ─────────────────────────── */}
      {mounted && createPortal(
        <AnimatePresence>
          {modelOpen && dropdownPos && (
            <motion.div
              key="model-dropdown"
              data-model-dropdown
              initial={{ opacity: 0, scale: 0.95, y: 6 }}
              animate={{ opacity: 1, scale: 1,    y: 0 }}
              exit={{ opacity: 0,   scale: 0.95, y: 6 }}
              transition={{ duration: 0.15, ease: [0.4, 0, 0.2, 1] }}
              style={dropdownStyle}
              className="rounded-xl overflow-hidden"
              onMouseDown={(e) => e.stopPropagation()}
            >
              <div style={{
                background:   "rgba(6,18,36,0.99)",
                border:       "1px solid rgba(0,212,255,0.22)",
                boxShadow:    "0 16px 48px rgba(0,0,0,0.8), 0 0 24px rgba(0,212,255,0.06)",
                borderRadius: "0.75rem",
                overflow:     "hidden",
              }}>
                <div className="h-[1px] bg-gradient-to-r from-transparent via-[rgba(0,212,255,0.4)] to-transparent" />
                {models.map((m) => {
                  const Icon   = m.icon;
                  const active = m.id === validModel.id;
                  return (
                    <motion.button
                      key={m.id}
                      whileHover={{ backgroundColor: "rgba(255,255,255,0.04)" }}
                      onClick={() => { setSelectedModel(m); setModelOpen(false); }}
                      className="w-full flex items-center gap-3 px-4 py-3 transition-colors"
                      data-model-dropdown
                    >
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ background: `${m.color}12`, border: `1px solid ${m.color}28` }}>
                        <Icon className="w-4 h-4" style={{ color: m.color }} />
                      </div>
                      <div className="flex-1 text-left min-w-0">
                        <p className="text-xs font-['Rajdhani'] font-bold tracking-wide"
                          style={{ color: active ? m.color : "rgba(226,232,240,0.82)" }}>
                          {m.label}
                        </p>
                        <p className="text-[10px] text-[rgba(148,163,184,0.42)] font-['Rajdhani'] leading-tight mt-0.5">
                          {m.sub}
                        </p>
                      </div>
                      {active && (
                        <span className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                          style={{ background: m.color, boxShadow: `0 0 6px ${m.color}` }} />
                      )}
                    </motion.button>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
}
