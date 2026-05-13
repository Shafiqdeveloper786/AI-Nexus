"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { signOut } from "next-auth/react";
import { pushNotif } from "@/lib/notifications";
import {
  MessageSquare, Code2, ImageIcon, FileText, Database,
  Bell, Menu, PanelRightClose, PanelRightOpen, ChevronRight,
  User, Settings2, LogOut, Crown, Zap, CheckCheck, Info,
  AlertTriangle, Cpu,
} from "lucide-react";
import { useUserProfile, type UserProfileData } from "@/hooks/useUserProfile";
import { NOTIF_EVENT, type NotifPayload, type NotifType } from "@/lib/notifications";

const TOOLS = [
  { id: "chat", label: "AI Chat", icon: MessageSquare },
  { id: "code", label: "Code Gen", icon: Code2 },
  { id: "image", label: "Images", icon: ImageIcon },
  { id: "resume", label: "Resume", icon: FileText },
  { id: "sql", label: "SQL", icon: Database },
];

const TOOL_NAMES: Record<string, string> = {
  chat: "AI Chat", code: "Code Generator",
  image: "Image Studio", resume: "Resume Builder",
  sql: "SQL Query", dashboard: "Dashboard", history: "History",
};

type LiveNotif = {
  id:     string;
  icon:   React.ElementType;
  color:  string;
  title:  string;
  sub:    string;
  time:   string;
  unread: boolean;
};

const TYPE_META: Record<NotifType, { icon: React.ElementType; color: string }> = {
  info:    { icon: Info,          color: "#00d4ff" },
  warning: { icon: AlertTriangle, color: "#fb923c" },
  error:   { icon: AlertTriangle, color: "#ef4444" },
  success: { icon: Zap,           color: "#00ff88" },
};

const SEED_NOTIFS: LiveNotif[] = [
  { id: "seed-1", icon: Cpu,   color: "#00d4ff", title: "Llama-3.3 70B is now active",     sub: "Model updated to latest Groq snapshot",  time: "2m ago",  unread: true  },
  { id: "seed-2", icon: Info,  color: "#a855f7", title: "40,000 welcome credits applied",  sub: "Enjoy your free tier AI quota",           time: "Today",   unread: true  },
  { id: "seed-3", icon: Crown, color: "#f0abfc", title: "Pro Plan — upgrade available",    sub: "Unlimited generations from $29/month",    time: "Today",   unread: false },
];

function useClickOutside(ref: React.RefObject<HTMLElement | null>, callback: () => void) {
  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) callback();
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [ref, callback]);
}

interface TopNavProps {
  activeTool: string;
  initialProfile?: UserProfileData | null;
  onToolChange: (tool: string) => void;
  onToggleSidebar: () => void;
  onToggleRightSidebar: () => void;
  rightSidebarOpen: boolean;
  onOpenProfile: () => void;
}

export default function TopNav({
  activeTool, initialProfile,
  onToolChange,
  onToggleSidebar, onToggleRightSidebar, rightSidebarOpen,
  onOpenProfile,
}: TopNavProps) {
  const [profileOpen,    setProfileOpen]    = useState(false);
  const [notifOpen,      setNotifOpen]      = useState(false);
  const [notifications,  setNotifications]  = useState<LiveNotif[]>(SEED_NOTIFS);
  const [signOutConfirm, setSignOutConfirm] = useState(false);
  const [signingOut,     setSigningOut]     = useState(false);
  const [mounted,        setMounted]        = useState(false);
  const { profile } = useUserProfile(initialProfile);

  useEffect(() => { setMounted(true); }, []);

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await signOut({ redirect: false });
      pushNotif({ title: "Signed Out Successfully", sub: "See you next time! 👋", type: "success" });
      setTimeout(() => { window.location.href = "/auth/login"; }, 900);
    } catch {
      setSigningOut(false);
    }
  };

  /* Listen for live notifications dispatched by any component */
  const addNotif = useCallback((payload: NotifPayload) => {
    const meta = TYPE_META[payload.type];
    const item: LiveNotif = {
      id:     `live-${Date.now()}`,
      icon:   meta.icon,
      color:  meta.color,
      title:  payload.title,
      sub:    payload.sub,
      time:   "Just now",
      unread: true,
    };
    setNotifications((prev) => [item, ...prev.slice(0, 19)]); // keep last 20
  }, []);

  useEffect(() => {
    const handler = (e: Event) => addNotif((e as CustomEvent<NotifPayload>).detail);
    window.addEventListener(NOTIF_EVENT, handler);
    return () => window.removeEventListener(NOTIF_EVENT, handler);
  }, [addNotif]);

  const profileRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  useClickOutside(profileRef, () => setProfileOpen(false));
  useClickOutside(notifRef, () => setNotifOpen(false));

  const unreadCount = notifications.filter((n) => n.unread).length;
  const markAllRead = () => setNotifications((n) => n.map((x) => ({ ...x, unread: false })));

  const dropdownBase = {
    background: "linear-gradient(160deg, rgba(8,22,46,0.98), rgba(3,11,26,0.99))",
    border: "1px solid rgba(0,212,255,0.18)",
    boxShadow: "0 20px 60px rgba(0,0,0,0.8), 0 0 40px rgba(0,212,255,0.05)",
    backdropFilter: "blur(24px)",
  };

  return (
    <>
    <header
      className="flex items-center gap-3 px-4 h-14 flex-shrink-0 z-10 relative"
      style={{
        background: "rgba(6,18,36,0.97)",
        backdropFilter: "blur(24px)",
        borderBottom: "1px solid rgba(0,212,255,0.1)",
      }}
    >
      {/* Sidebar toggle */}
      <motion.button
        whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
        onClick={onToggleSidebar}
        className="w-9 h-9 rounded-xl flex items-center justify-center text-[rgba(148,163,184,0.5)] hover:text-[#00d4ff] hover:bg-[rgba(0,212,255,0.08)] transition-all flex-shrink-0"
      >
        <Menu className="w-5 h-5" />
      </motion.button>

      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <span className="font-['Orbitron'] text-sm font-bold text-white">Dashboard</span>
        <ChevronRight className="w-3.5 h-3.5 text-[rgba(0,212,255,0.3)]" />
        <span className="text-[#00d4ff] text-xs font-['Rajdhani'] font-semibold tracking-wider">
          {TOOL_NAMES[activeTool] ?? "AI Chat"}
        </span>
      </div>

      <div className="w-px h-5 bg-[rgba(255,255,255,0.06)] flex-shrink-0 hidden sm:block" />

      {/* Tool tabs */}
      <nav className="flex items-center gap-0.5 overflow-x-auto flex-1 min-w-0 no-scrollbar">
        {TOOLS.map(({ id, label, icon: Icon }) => {
          const active = activeTool === id;
          return (
            <motion.button
              key={id}
              onClick={() => onToolChange(id)}
              whileHover={{ backgroundColor: active ? undefined : "rgba(255,255,255,0.04)" }}
              whileTap={{ scale: 0.96 }}
              className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-['Rajdhani'] font-bold tracking-wider whitespace-nowrap transition-colors flex-shrink-0 ${
                active ? "text-[#00d4ff] bg-[rgba(0,212,255,0.1)]" : "text-[rgba(148,163,184,0.55)]"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{label}</span>
              {active && (
                <motion.div
                  layoutId="toolIndicator"
                  className="absolute bottom-0 left-2 right-2 h-[1px] rounded-full bg-gradient-to-r from-[#00d4ff] to-[#a855f7]"
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
            </motion.button>
          );
        })}
      </nav>

      {/* Right actions */}
      <div className="flex items-center gap-1.5 flex-shrink-0 ml-auto">

        {/* ── Notification Bell ────────────────────────── */}
        <div ref={notifRef} className="relative">
          <motion.button
            whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.93 }}
            onClick={() => { setNotifOpen((v) => !v); setProfileOpen(false); }}
            className="relative w-9 h-9 rounded-xl flex items-center justify-center text-[rgba(148,163,184,0.5)] hover:text-[#00d4ff] hover:bg-[rgba(0,212,255,0.08)] transition-all"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <motion.span
                initial={{ scale: 0 }} animate={{ scale: 1 }}
                className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 rounded-full flex items-center justify-center text-[9px] font-['Orbitron'] font-bold text-white px-0.5"
                style={{ background: "linear-gradient(135deg, #a855f7, #7c3aed)", boxShadow: "0 0 8px rgba(168,85,247,0.7)" }}
              >
                {unreadCount}
              </motion.span>
            )}
          </motion.button>

          <AnimatePresence>
            {notifOpen && (
              <motion.div
                initial={{ opacity: 0, y: -8, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.96 }}
                transition={{ duration: 0.18 }}
                className="absolute right-0 top-full mt-2 w-[320px] rounded-2xl overflow-hidden z-50"
                style={dropdownBase}
              >
                <div className="h-[1px] bg-gradient-to-r from-transparent via-[rgba(168,85,247,0.4)] to-transparent" />
                <div className="flex items-center justify-between px-4 py-3 border-b border-[rgba(255,255,255,0.05)]">
                  <span className="font-['Orbitron'] text-[10px] font-bold text-[rgba(226,232,240,0.7)] tracking-widest">NOTIFICATIONS</span>
                  <button onClick={markAllRead}
                    className="flex items-center gap-1 text-[9px] font-['Rajdhani'] font-bold text-[rgba(0,212,255,0.5)] hover:text-[#00d4ff] transition-colors">
                    <CheckCheck className="w-3 h-3" /> Mark all read
                  </button>
                </div>
                <div className="max-h-[320px] overflow-y-auto">
                  {notifications.map((n) => {
                    const Icon = n.icon;
                    return (
                      <motion.div
                        key={n.id}
                        whileHover={{ backgroundColor: "rgba(255,255,255,0.03)" }}
                        className="flex items-start gap-3 px-4 py-3 border-b border-[rgba(255,255,255,0.03)] cursor-pointer transition-colors relative"
                      >
                        {n.unread && (
                          <span className="absolute top-3.5 right-3 w-1.5 h-1.5 rounded-full"
                            style={{ background: n.color, boxShadow: `0 0 6px ${n.color}` }} />
                        )}
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                          style={{ background: `${n.color}15`, border: `1px solid ${n.color}25` }}>
                          <Icon className="w-3.5 h-3.5" style={{ color: n.color }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-xs font-['Rajdhani'] font-bold truncate ${n.unread ? "text-[rgba(226,232,240,0.9)]" : "text-[rgba(148,163,184,0.55)]"}`}>
                            {n.title}
                          </p>
                          <p className="text-[10px] text-[rgba(148,163,184,0.35)] mt-0.5 truncate">{n.sub}</p>
                        </div>
                        <span className="text-[9px] text-[rgba(148,163,184,0.25)] flex-shrink-0 mt-0.5 font-['Rajdhani']">{n.time}</span>
                      </motion.div>
                    );
                  })}
                </div>
                <div className="h-[1px] bg-gradient-to-r from-transparent via-[rgba(0,212,255,0.1)] to-transparent" />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Right sidebar toggle */}
        <motion.button
          whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.93 }}
          onClick={onToggleRightSidebar}
          className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
            rightSidebarOpen
              ? "text-[#00d4ff] bg-[rgba(0,212,255,0.1)] border border-[rgba(0,212,255,0.2)]"
              : "text-[rgba(148,163,184,0.5)] hover:text-[#00d4ff] hover:bg-[rgba(0,212,255,0.08)]"
          }`}
        >
          {rightSidebarOpen ? <PanelRightClose className="w-4 h-4" /> : <PanelRightOpen className="w-4 h-4" />}
        </motion.button>

        {/* ── Profile Avatar + Dropdown ────────────────── */}
        <div ref={profileRef} className="relative">
          <motion.button
            whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.93 }}
            onClick={() => { setProfileOpen((v) => !v); setNotifOpen(false); }}
            className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-['Orbitron'] font-bold ring-2 ring-transparent hover:ring-[rgba(0,212,255,0.4)] transition-all duration-200"
            style={{ background: "linear-gradient(135deg, #00d4ff, #a855f7)", boxShadow: "0 0 14px rgba(0,212,255,0.32)" }}
          >
            {profile?.name?.[0]?.toUpperCase() ?? "?"}
          </motion.button>

          <AnimatePresence>
            {profileOpen && (
              <motion.div
                initial={{ opacity: 0, y: -8, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.96 }}
                transition={{ duration: 0.18 }}
                className="absolute right-0 top-full mt-2 w-[220px] rounded-2xl overflow-hidden z-50"
                style={dropdownBase}
              >
                <div className="h-[1px] bg-gradient-to-r from-transparent via-[rgba(0,212,255,0.45)] to-transparent" />

                {/* User info — live from MongoDB */}
                <div className="flex items-center gap-3 px-4 py-3.5 border-b border-[rgba(255,255,255,0.05)]">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center font-['Orbitron'] font-bold text-sm text-white flex-shrink-0"
                    style={{ background: "linear-gradient(135deg, #00d4ff, #a855f7)", boxShadow: "0 0 12px rgba(0,212,255,0.25)" }}>
                    {profile?.name?.[0]?.toUpperCase() ?? "?"}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-['Rajdhani'] font-bold text-[rgba(226,232,240,0.9)] truncate">
                      {profile?.name ?? "Loading…"}
                    </p>
                    <div className="flex items-center gap-1">
                      <Crown className="w-2.5 h-2.5 text-[#f0abfc]" />
                      <span className="text-[9px] font-['Orbitron'] text-[#f0abfc]">
                        {(profile?.subscription ?? "free").toUpperCase()}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Menu items */}
                <div className="py-1.5">
                  {[
                    { icon: User,     label: "My Profile", action: () => { onOpenProfile(); setProfileOpen(false); }, color: "#00d4ff" },
                    { icon: Settings2,label: "Settings",   action: () => { onOpenProfile(); setProfileOpen(false); }, color: "#a855f7" },
                    { icon: Zap,      label: `${profile?.credits ?? "—"} Credits`, action: () => {}, color: "#00ff88", sub: true },
                  ].map(({ icon: Icon, label, action, color, sub }) => (
                    <motion.button
                      key={label}
                      onClick={action}
                      whileHover={{ backgroundColor: "rgba(255,255,255,0.04)", x: 2 }}
                      transition={{ duration: 0.15 }}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-xs font-['Rajdhani'] font-semibold tracking-wide transition-colors ${
                        sub ? "text-[rgba(148,163,184,0.45)]" : "text-[rgba(226,232,240,0.75)] hover:text-white"
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5 flex-shrink-0" style={{ color }} />
                      {label}
                    </motion.button>
                  ))}
                </div>

                <div className="h-px bg-[rgba(255,255,255,0.05)] mx-3" />

                {/* Sign out */}
                <div className="py-1.5">
                  <motion.button
                    whileHover={{ backgroundColor: "rgba(239,68,68,0.06)", x: 2 }}
                    whileTap={{ scale: 0.97 }}
                    transition={{ duration: 0.15 }}
                    onClick={() => { setSignOutConfirm(true); setProfileOpen(false); }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-xs font-['Rajdhani'] font-semibold tracking-wide text-red-400 hover:text-red-300 transition-colors"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    Sign Out
                  </motion.button>
                </div>

                <div className="h-[1px] bg-gradient-to-r from-transparent via-[rgba(168,85,247,0.2)] to-transparent" />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>

    {/* ── Sign-out confirmation modal ─────────────────────────────────── */}
    {mounted && createPortal(
      <AnimatePresence>
        {signOutConfirm && (
          <motion.div key="signout-backdrop"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-[200] flex items-center justify-center p-4"
            style={{ background: "rgba(0,0,0,0.72)", backdropFilter: "blur(6px)" }}
            onClick={() => !signingOut && setSignOutConfirm(false)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 16 }} animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 16 }} transition={{ type: "spring", stiffness: 360, damping: 30 }}
              className="w-full max-w-sm rounded-2xl overflow-hidden"
              style={{
                background:  "linear-gradient(160deg, rgba(8,22,46,0.99), rgba(3,11,26,0.99))",
                border:      "1px solid rgba(239,68,68,0.28)",
                boxShadow:   "0 24px 64px rgba(0,0,0,0.85), 0 0 40px rgba(239,68,68,0.06)",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="h-[2px] bg-gradient-to-r from-red-600 via-red-400 to-red-600" />
              <div className="px-6 py-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)" }}>
                    <LogOut className="w-5 h-5 text-red-400" />
                  </div>
                  <div>
                    <p className="font-['Orbitron'] text-sm font-bold text-white">Sign Out</p>
                    <p className="text-[10px] font-['Rajdhani'] text-[rgba(148,163,184,0.45)]">Your session will end</p>
                  </div>
                </div>
                <p className="text-sm font-['Rajdhani'] text-[rgba(226,232,240,0.65)] mb-5 leading-relaxed">
                  Are you sure you want to sign out? You will be redirected to the login page.
                </p>
                <div className="flex items-center gap-2">
                  <motion.button
                    whileHover={{ backgroundColor: "rgba(255,255,255,0.05)" }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => setSignOutConfirm(false)}
                    disabled={signingOut}
                    className="flex-1 py-2.5 rounded-xl text-[10px] font-['Orbitron'] font-bold text-[rgba(226,232,240,0.55)] disabled:opacity-40 transition-colors"
                    style={{ border: "1px solid rgba(255,255,255,0.08)" }}
                  >
                    CANCEL
                  </motion.button>
                  <motion.button
                    whileHover={!signingOut ? { boxShadow: "0 0 22px rgba(239,68,68,0.45)" } : {}}
                    whileTap={!signingOut ? { scale: 0.97 } : {}}
                    onClick={handleSignOut}
                    disabled={signingOut}
                    className="flex-1 py-2.5 rounded-xl text-[10px] font-['Orbitron'] font-bold text-white flex items-center justify-center gap-2 disabled:opacity-70 transition-all"
                    style={{ background: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)" }}
                  >
                    {signingOut ? (
                      <>
                        <motion.div animate={{ rotate: 360 }}
                          transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
                          className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full" />
                        SIGNING OUT…
                      </>
                    ) : (
                      <>
                        <LogOut className="w-3.5 h-3.5" />
                        YES, SIGN OUT
                      </>
                    )}
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>,
      document.body
    )}
    </>
  );
}
