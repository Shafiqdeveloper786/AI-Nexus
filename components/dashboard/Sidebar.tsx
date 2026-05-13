"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard, MessageSquare, Code2, ImageIcon, FileText,
  Database, History, Plus, ChevronRight, ChevronLeft,
  Zap, LogOut, Settings, Bot, Trash2, Loader2, Clock, AlertTriangle,
  Images, X as XIcon, ChevronDown, ChevronUp, ZoomIn, Download,
} from "lucide-react";
import { signOut } from "next-auth/react";
import { useChatHistory } from "@/hooks/useChatHistory";
import { useUserProfile, type UserProfileData } from "@/hooks/useUserProfile";
import type { ToolId } from "./mockData";

/* Kind → icon + accent colour */
const KIND_ICONS: Record<string, React.ElementType> = {
  chat:  MessageSquare,
  code:  Code2,
  image: ImageIcon,
};
const KIND_COLORS: Record<string, string> = {
  chat:  "#00d4ff",
  code:  "#a855f7",
  image: "#f0abfc",
};

/* Shown on mobile only (lg:hidden applied to the wrapper) */
const NAV_ITEMS = [
  { id: "dashboard", label: "Dashboard",     icon: LayoutDashboard },
  { id: "chat",      label: "AI Chat",        icon: MessageSquare },
  { id: "code",      label: "Code Generator", icon: Code2 },
  { id: "image",     label: "Image Studio",   icon: ImageIcon },
  { id: "resume",    label: "Resume Builder", icon: FileText },
  { id: "sql",       label: "SQL Query",      icon: Database },
  { id: "history",   label: "History",        icon: History },
];

interface SidebarProps {
  isOpen: boolean;
  activeTool: string;
  currentChatId: string | null;
  refreshHistoryKey?: number;
  initialProfile?: UserProfileData | null;
  onToolChange: (tool: string) => void;
  onChatSelect: (chatId: string) => void;
  onNewChat: () => void;
  onToggle: () => void;
  onSettingsClick: () => void;
}

export default function DashboardSidebar({
  isOpen, activeTool, currentChatId, refreshHistoryKey = 0,
  initialProfile,
  onToolChange, onChatSelect, onNewChat, onToggle, onSettingsClick,
}: SidebarProps) {
  const [deletingId,      setDeletingId]      = useState<string | null>(null);
  const [confirmDelete,   setConfirmDelete]   = useState<{ id: string; kind: "chat" | "code" | "image" } | null>(null);
  const [mounted,         setMounted]         = useState(false);
  const [libraryOpen,   setLibraryOpen]   = useState(false);
  const [libImages,     setLibImages]     = useState<{ id: string; imageUrl: string; prompt: string }[]>([]);
  const [libLoading,    setLibLoading]    = useState(false);
  const [viewingImg,    setViewingImg]    = useState<{ imageUrl: string; prompt: string } | null>(null);
  const { sessions, loading: histLoading, deleteChat, refetch: refetchHistory } = useChatHistory(refreshHistoryKey);
  const { profile } = useUserProfile(initialProfile);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!libraryOpen || libImages.length > 0) return;
    setLibLoading(true);
    fetch("/api/library?limit=9")
      .then((r) => r.json())
      .then((d) => setLibImages(d.images ?? []))
      .catch(console.error)
      .finally(() => setLibLoading(false));
  }, [libraryOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (refreshHistoryKey > 0) refetchHistory();
  }, [refreshHistoryKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const requestDelete = (e: React.MouseEvent, id: string, kind: "chat" | "code" | "image") => {
    e.stopPropagation();
    setConfirmDelete({ id, kind });
  };

  const handleConfirmDelete = async () => {
    if (!confirmDelete) return;
    const { id, kind } = confirmDelete;
    setConfirmDelete(null);
    setDeletingId(id);
    await deleteChat(id, kind);
    setDeletingId(null);
  };

  /* Route a history item click based on kind */
  const handleSessionClick = (session: { id: string; kind: string; tool: string }) => {
    if (session.kind === "image") {
      onToolChange("image");
    } else if (session.kind === "code") {
      onToolChange("code");
      onChatSelect(session.id);
    } else {
      /* chat / sql */
      if (session.tool === "sql") onToolChange("sql");
      else onToolChange("chat");
      onChatSelect(session.id);
    }
  };

  return (
    <>
      {/* Mobile overlay */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/70 z-20 lg:hidden backdrop-blur-sm"
            onClick={onToggle}
          />
        )}
      </AnimatePresence>

      {/* Delete confirmation portal */}
      {mounted && createPortal(
        <AnimatePresence>
          {confirmDelete && (
            <>
              {/* Backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
                className="fixed inset-0 z-[70] bg-black/70 backdrop-blur-sm"
                onClick={() => setConfirmDelete(null)}
              />

              {/* Dialog */}
              <motion.div
                initial={{ opacity: 0, scale: 0.93, y: 20 }}
                animate={{ opacity: 1, scale: 1,    y: 0  }}
                exit={{ opacity: 0,   scale: 0.93, y: 20 }}
                transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
                className="fixed inset-0 z-[71] flex items-center justify-center p-4 pointer-events-none"
              >
                <div
                  className="w-full max-w-[320px] rounded-2xl p-6 pointer-events-auto"
                  style={{
                    background: "linear-gradient(160deg, rgba(8,22,46,0.99), rgba(3,11,26,0.99))",
                    border:     "1px solid rgba(239,68,68,0.25)",
                    boxShadow:  "0 24px 60px rgba(0,0,0,0.85), 0 0 40px rgba(239,68,68,0.05)",
                  }}
                >
                  <div className="h-[1px] -mt-6 -mx-6 mb-5 bg-gradient-to-r from-transparent via-[rgba(239,68,68,0.4)] to-transparent" />

                  {/* Icon */}
                  <div
                    className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4"
                    style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.22)" }}
                  >
                    <AlertTriangle className="w-6 h-6 text-red-400" />
                  </div>

                  <h3 className="font-['Orbitron'] text-sm font-bold text-white text-center tracking-wide mb-1.5">
                    Delete Conversation?
                  </h3>
                  <p className="text-[11px] text-[rgba(148,163,184,0.55)] font-['Rajdhani'] text-center leading-relaxed mb-5">
                    This action cannot be undone. The conversation and all its messages will be permanently removed.
                  </p>

                  <div className="flex gap-2.5">
                    <motion.button
                      whileHover={{ y: -1 }} whileTap={{ scale: 0.97 }}
                      onClick={() => setConfirmDelete(null)}
                      className="flex-1 py-2.5 rounded-xl text-xs font-['Rajdhani'] font-bold tracking-wider transition-all"
                      style={{
                        background: "rgba(255,255,255,0.05)",
                        border:     "1px solid rgba(255,255,255,0.1)",
                        color:      "rgba(148,163,184,0.7)",
                      }}
                    >
                      Cancel
                    </motion.button>
                    <motion.button
                      whileHover={{ y: -1, boxShadow: "0 0 20px rgba(239,68,68,0.35)" }}
                      whileTap={{ scale: 0.97 }}
                      onClick={handleConfirmDelete}
                      className="flex-1 py-2.5 rounded-xl text-xs font-['Rajdhani'] font-bold tracking-wider text-white flex items-center justify-center gap-1.5 transition-all"
                      style={{
                        background: "linear-gradient(135deg, #dc2626, #ef4444)",
                        border:     "1px solid rgba(239,68,68,0.4)",
                      }}
                    >
                      <Trash2 className="w-3 h-3" /> Delete
                    </motion.button>
                  </div>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>,
        document.body
      )}

      {/* Image lightbox portal */}
      {mounted && createPortal(
        <AnimatePresence>
          {viewingImg && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-[80] bg-black/90 backdrop-blur-sm flex flex-col items-center justify-center p-4"
              onClick={() => setViewingImg(null)}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1,   opacity: 1 }}
                exit={{ scale: 0.9,    opacity: 0 }}
                transition={{ duration: 0.22 }}
                className="relative max-w-3xl w-full"
                onClick={(e) => e.stopPropagation()}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={viewingImg.imageUrl}
                  alt={viewingImg.prompt}
                  className="w-full max-h-[80vh] object-contain rounded-2xl"
                  style={{ border: "1px solid rgba(168,85,247,0.3)", boxShadow: "0 0 60px rgba(168,85,247,0.15)" }}
                />
                <div className="flex items-center justify-between mt-3 px-1">
                  <p className="text-xs text-[rgba(148,163,184,0.6)] font-['Rajdhani'] truncate flex-1 mr-3">
                    {viewingImg.prompt}
                  </p>
                  <div className="flex gap-2 flex-shrink-0">
                    <motion.button
                      whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                      onClick={() => {
                        const a = document.createElement("a");
                        a.href = viewingImg.imageUrl;
                        a.download = `ai-nexus-${Date.now()}.png`;
                        a.click();
                      }}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-['Rajdhani'] font-bold text-white"
                      style={{ background: "rgba(168,85,247,0.2)", border: "1px solid rgba(168,85,247,0.35)" }}
                    >
                      <Download className="w-3.5 h-3.5" /> Download
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                      onClick={() => setViewingImg(null)}
                      className="w-9 h-9 rounded-xl flex items-center justify-center text-[rgba(148,163,184,0.5)] hover:text-white"
                      style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.1)" }}
                    >
                      <XIcon className="w-4 h-4" />
                    </motion.button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}

      {/* Sidebar panel */}
      <motion.aside
        animate={{ width: isOpen ? 264 : 0 }}
        transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
        className="relative z-30 flex-shrink-0 overflow-hidden max-lg:fixed max-lg:left-0 max-lg:top-0 max-lg:h-full"
      >
        <div
          className="w-[264px] h-full flex flex-col"
          style={{
            background:  "linear-gradient(180deg, rgba(6,18,36,0.99) 0%, rgba(3,11,26,0.99) 100%)",
            borderRight: "1px solid rgba(0,212,255,0.12)",
          }}
        >
          <div className="h-[1px] bg-gradient-to-r from-transparent via-[rgba(0,212,255,0.45)] to-transparent" />

          {/* ── Brand ──────────────────────────────────────── */}
          <div className="flex items-center justify-between px-4 pt-4 pb-3">
            <div className="flex items-center gap-2.5">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center"
                style={{
                  background: "linear-gradient(135deg, rgba(0,212,255,0.15), rgba(168,85,247,0.2))",
                  border:     "1px solid rgba(0,212,255,0.3)",
                  boxShadow:  "0 0 20px rgba(0,212,255,0.15)",
                }}
              >
                <Bot className="w-5 h-5 text-[#00d4ff]" />
              </div>
              <div>
                <p className="font-['Orbitron'] text-sm font-bold text-white leading-none tracking-widest">
                  AI NEXUS
                </p>
                <p className="text-[#00d4ff] text-[9px] font-['Rajdhani'] tracking-[0.2em] mt-0.5 opacity-60">
                  v4.0.2 · QUANTUM CORE
                </p>
              </div>
            </div>
            <button
              onClick={onToggle}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-[rgba(148,163,184,0.4)] hover:text-[#00d4ff] hover:bg-[rgba(0,212,255,0.08)] transition-all"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>

          {/* ── New Chat ────────────────────────────────────── */}
          <div className="px-3 mb-3">
            <motion.button
              whileHover={{ boxShadow: "0 0 20px rgba(0,212,255,0.28)" }}
              whileTap={{ scale: 0.97 }}
              onClick={onNewChat}
              className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl font-['Rajdhani'] text-sm font-bold tracking-wider text-[#00d4ff] group"
              style={{ background: "rgba(0,212,255,0.06)", border: "1px solid rgba(0,212,255,0.22)" }}
            >
              <Plus className="w-4 h-4 group-hover:rotate-90 transition-transform duration-300" />
              NEW CHAT
            </motion.button>
          </div>

          {/* ── Image Library ──────────────────────────────── */}
          <div className="px-3 mb-2">
            <button
              onClick={() => setLibraryOpen((v) => !v)}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-[10px] font-['Orbitron'] tracking-[0.15em] text-[rgba(148,163,184,0.5)] hover:text-[#a855f7] hover:bg-[rgba(168,85,247,0.06)] transition-all"
              style={{ border: "1px solid rgba(255,255,255,0.04)" }}
            >
              <Images className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="flex-1 text-left">IMAGE LIBRARY</span>
              {libraryOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>

            <AnimatePresence initial={false}>
              {libraryOpen && (
                <motion.div
                  key="lib"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.22 }}
                  className="overflow-hidden"
                >
                  <div className="mt-2">
                    {libLoading ? (
                      <div className="flex items-center justify-center py-4">
                        <Loader2 className="w-4 h-4 text-[rgba(168,85,247,0.4)] animate-spin" />
                      </div>
                    ) : libImages.length === 0 ? (
                      <p className="text-center text-[10px] text-[rgba(148,163,184,0.3)] font-['Rajdhani'] py-4">
                        No generated images yet
                      </p>
                    ) : (
                      <div className="grid grid-cols-3 gap-1.5">
                        {libImages.map((img) => (
                          <motion.button
                            key={img.id}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => setViewingImg(img)}
                            className="relative group rounded-lg overflow-hidden aspect-square"
                            style={{ border: "1px solid rgba(168,85,247,0.18)" }}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={img.imageUrl}
                              alt={img.prompt}
                              className="w-full h-full object-cover"
                              loading="lazy"
                            />
                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <ZoomIn className="w-4 h-4 text-white" />
                            </div>
                          </motion.button>
                        ))}
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* ── Nav items — MOBILE ONLY (hidden on desktop lg+) ── */}
          <nav className="lg:hidden px-2 mb-1 space-y-0.5">
            {NAV_ITEMS.map(({ id, label, icon: Icon }) => {
              const active = activeTool === id;
              return (
                <motion.button
                  key={id}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => onToolChange(id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-['Rajdhani'] font-semibold tracking-wide transition-all group ${
                    active
                      ? "text-[#00d4ff]"
                      : "text-[rgba(148,163,184,0.65)] hover:text-[rgba(226,232,240,0.85)] hover:bg-[rgba(255,255,255,0.03)]"
                  }`}
                  style={active ? {
                    background: "rgba(0,212,255,0.09)",
                    border:     "1px solid rgba(0,212,255,0.2)",
                    boxShadow:  "inset 0 0 20px rgba(0,212,255,0.04)",
                  } : undefined}
                >
                  <Icon className={`w-4 h-4 flex-shrink-0 transition-colors ${
                    active ? "text-[#00d4ff]" : "text-[rgba(148,163,184,0.4)] group-hover:text-[rgba(148,163,184,0.7)]"
                  }`} />
                  <span className="flex-1 text-left">{label}</span>
                  {active && <ChevronRight className="w-3.5 h-3.5 text-[rgba(0,212,255,0.6)]" />}
                </motion.button>
              );
            })}
          </nav>

          {/* Divider — mobile only */}
          <div className="lg:hidden mx-3 my-2 h-[1px] bg-gradient-to-r from-transparent via-[rgba(0,212,255,0.08)] to-transparent" />

          {/* ── Recent Chats ─────────────────────────────────── */}
          <div className="flex-1 overflow-y-auto cyber-scrollbar px-2 min-h-0 pb-1">

            {/* Styled header with icon + gradient rule */}
            <div className="flex items-center gap-2 px-3 mb-2.5 mt-0.5">
              <Clock className="w-3 h-3 text-[rgba(0,212,255,0.45)] flex-shrink-0" />
              <span className="text-[9px] font-['Orbitron'] tracking-[0.18em] text-[rgba(148,163,184,0.5)] uppercase">
                Recent Chats
              </span>
              <div className="flex-1 h-[1px] bg-gradient-to-r from-[rgba(0,212,255,0.18)] to-transparent" />
            </div>

            {histLoading ? (
              <div className="flex items-center gap-2 px-3 py-2">
                <Loader2 className="w-3.5 h-3.5 text-[rgba(0,212,255,0.4)] animate-spin" />
                <span className="text-[10px] text-[rgba(148,163,184,0.35)] font-['Rajdhani']">Loading history…</span>
              </div>
            ) : sessions.length === 0 ? (
              <div className="px-3 py-3 text-center">
                <MessageSquare className="w-5 h-5 text-[rgba(148,163,184,0.15)] mx-auto mb-1.5" />
                <p className="text-[10px] text-[rgba(148,163,184,0.25)] font-['Rajdhani']">
                  No conversations yet
                </p>
              </div>
            ) : (
              <div className="space-y-0.5">
                {sessions.map((session) => {
                  const kind        = session.kind ?? "chat";
                  const Icon        = KIND_ICONS[kind]   ?? MessageSquare;
                  const accentColor = KIND_COLORS[kind]  ?? "#00d4ff";
                  const active      = currentChatId === session.id && kind !== "image";
                  return (
                    <motion.button
                      key={session.id}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => handleSessionClick(session)}
                      className="w-full text-left px-3 py-2.5 rounded-xl transition-all group"
                      style={active ? {
                        background: `${accentColor}12`,
                        border:     `1px solid ${accentColor}35`,
                      } : {
                        border: "1px solid transparent",
                      }}
                      onMouseEnter={(e) => {
                        if (!active) {
                          (e.currentTarget.style.background = "rgba(0,212,255,0.03)");
                          (e.currentTarget.style.border     = "1px solid rgba(0,212,255,0.1)");
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!active) {
                          (e.currentTarget.style.background = "");
                          (e.currentTarget.style.border     = "1px solid transparent");
                        }
                      }}
                    >
                      <div className="flex items-start gap-2.5">
                        {/* Kind icon with accent colour */}
                        <div
                          className="w-6 h-6 rounded-md flex-shrink-0 flex items-center justify-center mt-0.5 transition-colors"
                          style={active
                            ? { background: `${accentColor}25` }
                            : { background: "rgba(255,255,255,0.04)" }
                          }
                        >
                          <Icon
                            className="w-3 h-3"
                            style={{ color: active ? accentColor : "rgba(148,163,184,0.35)" }}
                          />
                        </div>

                        {/* Title + preview */}
                        <div className="flex-1 min-w-0">
                          <p className={`text-xs font-['Rajdhani'] font-semibold truncate transition-colors ${
                            active
                              ? "text-[rgba(226,232,240,0.9)]"
                              : "text-[rgba(148,163,184,0.55)] group-hover:text-[rgba(226,232,240,0.75)]"
                          }`}>
                            {session.title}
                          </p>
                          <p className="text-[10px] text-[rgba(148,163,184,0.28)] truncate mt-0.5 font-['Rajdhani']">
                            {session.preview}
                          </p>
                        </div>

                        {/* Time + delete */}
                        <div className="flex flex-col items-end gap-1 flex-shrink-0">
                          <span className="text-[9px] text-[rgba(148,163,184,0.22)] font-['Rajdhani']">
                            {session.time}
                          </span>
                          <motion.button
                            whileHover={{ color: "#ef4444" }}
                            whileTap={{ scale: 0.9 }}
                            onClick={(e) => requestDelete(e, session.id, kind as "chat" | "code" | "image")}
                            className="opacity-0 group-hover:opacity-100 text-[rgba(148,163,184,0.25)] transition-all"
                          >
                            {deletingId === session.id
                              ? <Loader2 className="w-3 h-3 animate-spin" />
                              : <Trash2 className="w-3 h-3" />
                            }
                          </motion.button>
                        </div>
                      </div>
                    </motion.button>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── User Profile footer ──────────────────────────── */}
          <div className="p-3 border-t border-[rgba(0,212,255,0.07)]">
            <div
              className="rounded-xl p-3 flex items-center gap-2.5"
              style={{
                background: "linear-gradient(135deg, rgba(10,31,61,0.8), rgba(6,18,36,0.9))",
                border:     "1px solid rgba(0,212,255,0.12)",
              }}
            >
              <div className="relative flex-shrink-0">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#00d4ff] to-[#a855f7] flex items-center justify-center text-white text-sm font-['Orbitron'] font-bold">
                  {profile?.name?.[0]?.toUpperCase() ?? "?"}
                </div>
                <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-[#00ff88] border-2 border-[#061224]" />
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-xs font-['Rajdhani'] font-bold text-[rgba(226,232,240,0.9)] truncate">
                  {profile?.name ?? "Loading…"}
                </p>
                <div className="flex items-center gap-1 mt-0.5">
                  <Zap className="w-2.5 h-2.5 text-[#00d4ff] flex-shrink-0" />
                  <p className="text-[10px] text-[#00d4ff] font-['Rajdhani'] font-semibold">
                    {profile ? `${profile.credits.toLocaleString()} Credits` : "—"}
                  </p>
                </div>
              </div>

              <div className="flex gap-1">
                <button
                  onClick={onSettingsClick}
                  title="Profile Settings"
                  className="w-6 h-6 rounded-lg flex items-center justify-center text-[rgba(148,163,184,0.35)] hover:text-[#00d4ff] hover:bg-[rgba(0,212,255,0.08)] transition-all"
                >
                  <Settings className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => signOut({ callbackUrl: "/auth/login" })}
                  title="Sign Out"
                  className="w-6 h-6 rounded-lg flex items-center justify-center text-[rgba(148,163,184,0.35)] hover:text-red-400 hover:bg-[rgba(239,68,68,0.08)] transition-all"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

        </div>
      </motion.aside>
    </>
  );
}
