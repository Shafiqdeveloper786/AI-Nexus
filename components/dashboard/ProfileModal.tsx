"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { signOut } from "next-auth/react";
import {
  X, User, CreditCard, Settings2, Mail, Shield,
  Crown, Zap, Check, Key, Download, Trash2,
  LogOut, Lock, Loader2, AlertTriangle, Scan, Info,
} from "lucide-react";
import CardScanModal from "./CardScanModal";
import DeleteAccountModal from "./DeleteAccountModal";
import { useUserProfile } from "@/hooks/useUserProfile";
import { CREDITS } from "@/lib/credits";

const TABS = [
  { id: "account",      label: "Account",      icon: User      },
  { id: "subscription", label: "Subscription", icon: CreditCard },
  { id: "settings",     label: "Settings",     icon: Settings2  },
];

/* ─────────────────────────────────────────────────────────────────────────────
   Account Tab — READ-ONLY display, no editing allowed
   ───────────────────────────────────────────────────────────────────────────── */
function AccountTab() {
  const { profile, loading } = useUserProfile();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10 gap-2">
        <Loader2 className="w-5 h-5 text-[#00d4ff] animate-spin" />
        <span className="text-sm text-[rgba(148,163,184,0.5)] font-['Rajdhani']">Loading profile…</span>
      </div>
    );
  }

  const displayName  = profile?.name  ?? "—";
  const displayEmail = profile?.email ?? "—";
  const initial      = displayName[0]?.toUpperCase() ?? "?";
  const planLabel    =
    profile?.subscription === "pro"        ? "PRO MEMBER"
    : profile?.subscription === "enterprise" ? "ENTERPRISE"
    : "FREE PLAN";

  const infoRows = [
    { icon: User,   label: "Display Name",  value: displayName,              locked: true  },
    { icon: Mail,   label: "Email Address", value: displayEmail,             locked: true  },
    { icon: Shield, label: "Auth Method",   value: "OTP + Google OAuth",     locked: false },
    { icon: Zap,    label: "Credits",       value: `${(profile?.credits ?? 0).toLocaleString()} remaining`, locked: false },
    { icon: Crown,  label: "Plan",          value: (profile?.subscription ?? "free").toUpperCase(), locked: false },
  ];

  return (
    <div className="space-y-4">
      {/* Avatar row */}
      <div className="flex items-center gap-4">
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center text-white text-xl font-['Orbitron'] font-bold flex-shrink-0"
          style={{ background: "linear-gradient(135deg, #00d4ff, #a855f7)", boxShadow: "0 0 24px rgba(0,212,255,0.3)" }}
        >
          {initial}
        </div>
        <div>
          <p className="font-['Orbitron'] text-sm font-bold text-white">{displayName}</p>
          <div className="flex items-center gap-1.5 mt-1">
            <Crown className="w-3 h-3 text-[#f0abfc]" />
            <span className="text-[10px] font-['Rajdhani'] font-bold tracking-widest text-[#f0abfc]">
              {planLabel}
            </span>
          </div>
        </div>
      </div>

      {/* Read-only info fields */}
      <div className="space-y-2">
        {infoRows.map(({ icon: Icon, label, value, locked }) => (
          <div
            key={label}
            className="flex items-center gap-3 px-4 py-3 rounded-xl"
            style={locked ? {
              background: "rgba(3,9,20,0.6)",
              border:     "1px solid rgba(148,163,184,0.08)",
            } : {
              background: "rgba(255,255,255,0.03)",
              border:     "1px solid rgba(255,255,255,0.06)",
            }}
          >
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
              style={locked
                ? { background: "rgba(148,163,184,0.06)", border: "1px solid rgba(148,163,184,0.1)" }
                : { background: "rgba(0,212,255,0.08)",   border: "1px solid rgba(0,212,255,0.15)" }
              }
            >
              <Icon className={`w-3.5 h-3.5 ${locked ? "text-[rgba(148,163,184,0.45)]" : "text-[#00d4ff]"}`} />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1">
                <p className="text-[9px] text-[rgba(148,163,184,0.4)] font-['Orbitron'] tracking-widest uppercase">
                  {label}
                </p>
                {label === "Email Address" && (
                  <Lock className="w-2 h-2 text-[rgba(148,163,184,0.28)]" />
                )}
              </div>
              <p className="text-xs text-[rgba(226,232,240,0.92)] font-['Rajdhani'] font-semibold truncate mt-0.5">
                {value}
              </p>
            </div>

            {locked && (
              <div
                className="flex items-center gap-1 px-2 py-0.5 rounded-full flex-shrink-0"
                style={{ background: "rgba(148,163,184,0.05)", border: "1px solid rgba(148,163,184,0.1)" }}
              >
                <Lock className="w-2.5 h-2.5 text-[rgba(148,163,184,0.35)]" />
                <span className="text-[8px] font-['Orbitron'] text-[rgba(148,163,184,0.35)]">LOCKED</span>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Locked notice */}
      <div
        className="flex items-start gap-2.5 px-3.5 py-3 rounded-xl"
        style={{ background: "rgba(148,163,184,0.04)", border: "1px solid rgba(148,163,184,0.1)" }}
      >
        <Lock className="w-3.5 h-3.5 text-[rgba(148,163,184,0.4)] flex-shrink-0 mt-0.5" />
        <p className="text-[10px] text-[rgba(148,163,184,0.5)] font-['Rajdhani'] leading-relaxed">
          Personal information is locked for security. Your name and email are set at registration
          and cannot be changed. Contact support if you need assistance.
        </p>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   Subscription Tab — with card scanning + payment-gateway notice
   ───────────────────────────────────────────────────────────────────────────── */
function SubscriptionTab() {
  const { profile } = useUserProfile();
  const [scanOpen, setScanOpen]   = useState(false);
  const [cardNum,  setCardNum]    = useState("");
  const [cardExp,  setCardExp]    = useState("");
  const [cardCvv,  setCardCvv]    = useState("");
  const [cardName, setCardName]   = useState("");
  const [payNotice, setPayNotice] = useState(false);

  const isPro    = profile?.subscription === "pro" || profile?.subscription === "enterprise";
  const credits  = profile?.credits ?? 0;
  const maxFree  = CREDITS.WELCOME;
  const usedFree = Math.max(0, maxFree - credits);
  const creditPct = Math.min(100, Math.round((usedFree / maxFree) * 100));

  const handleScanned = (card: { number: string; expiry: string; name: string }) => {
    setCardNum(card.number);
    setCardExp(card.expiry);
    setCardName(card.name);
    setScanOpen(false);
  };

  const handlePay = () => setPayNotice(true);

  const features = [
    "Unlimited AI Chat & SQL generation",
    "Unlimited Code generation",
    "100 Image generations / month",
    "100 Resume builds / month",
    "Priority model access (GPT-4 level)",
    "Full history & Markdown export",
  ];

  return (
    <>
      <CardScanModal isOpen={scanOpen} onClose={() => setScanOpen(false)} onScanned={handleScanned} />

      <div className="space-y-4">
        {/* Plan card */}
        <div
          className="rounded-xl p-4 relative overflow-hidden"
          style={{ background: "linear-gradient(135deg, rgba(168,85,247,0.12), rgba(0,212,255,0.08))", border: "1px solid rgba(168,85,247,0.25)" }}
        >
          <div className="absolute -top-6 -right-6 w-28 h-28 rounded-full bg-[#a855f7] opacity-[0.06] blur-3xl pointer-events-none" />
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Crown className="w-4 h-4 text-[#f0abfc]" />
              <span className="font-['Orbitron'] text-sm font-bold text-white tracking-wider">
                {(profile?.subscription ?? "free").toUpperCase()} PLAN
              </span>
            </div>
            <span
              className="text-[10px] font-['Orbitron'] px-2.5 py-0.5 rounded-full"
              style={{
                color:      isPro ? "#a855f7" : "#00d4ff",
                background: isPro ? "rgba(168,85,247,0.12)" : "rgba(0,212,255,0.08)",
                border:     `1px solid ${isPro ? "rgba(168,85,247,0.25)" : "rgba(0,212,255,0.2)"}`,
              }}
            >
              {isPro ? "ACTIVE" : "FREE"}
            </span>
          </div>
          {isPro ? (
            <>
              <p className="font-['Orbitron'] text-2xl font-black text-white">
                $29<span className="text-sm font-normal text-[rgba(148,163,184,0.5)]">/mo</span>
              </p>
              {profile?.subscriptionEndsAt && (
                <p className="text-[10px] text-[rgba(0,255,136,0.7)] font-['Rajdhani'] mt-1">
                  Renews {new Date(profile.subscriptionEndsAt).toLocaleDateString()}
                </p>
              )}
            </>
          ) : (
            <p className="text-sm text-[rgba(148,163,184,0.6)] font-['Rajdhani'] mt-1">
              {credits.toLocaleString()} credit{credits !== 1 ? "s" : ""} remaining
            </p>
          )}
        </div>

        {/* Usage bars */}
        <div className="space-y-3">
          <div>
            <div className="flex justify-between mb-1.5">
              <span className="text-xs font-['Rajdhani'] font-semibold text-[rgba(148,163,184,0.7)]">Credits Used</span>
              <span className="text-xs font-['Orbitron'] font-bold text-[#00d4ff]">
                {usedFree.toLocaleString()} / {maxFree.toLocaleString()}
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-[rgba(255,255,255,0.05)] overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${creditPct}%` }}
                transition={{ duration: 1 }}
                className="h-full rounded-full"
                style={{ background: "linear-gradient(90deg, rgba(0,212,255,0.5), #00d4ff)" }}
              />
            </div>
          </div>
          <div>
            <div className="flex justify-between mb-1.5">
              <span className="text-xs font-['Rajdhani'] font-semibold text-[rgba(148,163,184,0.7)]">Tokens Generated</span>
              <span className="text-xs font-['Orbitron'] font-bold text-[#a855f7]">
                {((profile?.totalTokens ?? 0) / 1000).toFixed(1)}k
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-[rgba(255,255,255,0.05)] overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(100, (profile?.totalTokens ?? 0) / 200)}%` }}
                transition={{ duration: 1 }}
                className="h-full rounded-full"
                style={{ background: "linear-gradient(90deg, rgba(168,85,247,0.5), #a855f7)" }}
              />
            </div>
          </div>
        </div>

        {/* Card entry (free users only) */}
        {!isPro && (
          <div
            className="rounded-xl p-4 space-y-3"
            style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)" }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CreditCard className="w-3.5 h-3.5 text-[#00d4ff]" />
                <span className="text-[10px] font-['Orbitron'] font-bold text-[rgba(226,232,240,0.8)] tracking-widest">
                  PAYMENT METHOD
                </span>
              </div>
              <motion.button
                whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}
                onClick={() => setScanOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-['Orbitron'] font-bold tracking-wider"
                style={{
                  background: "linear-gradient(135deg, rgba(0,212,255,0.12), rgba(168,85,247,0.12))",
                  border:     "1px solid rgba(0,212,255,0.3)",
                  color:      "#00d4ff",
                  boxShadow:  "0 0 12px rgba(0,212,255,0.12)",
                }}
              >
                <Scan className="w-3 h-3" /> Scan Card
              </motion.button>
            </div>

            <div>
              <label className="block text-[9px] font-['Orbitron'] tracking-widest text-[rgba(148,163,184,0.4)] mb-1.5 uppercase">Card Number</label>
              <input
                value={cardNum}
                onChange={(e) => setCardNum(e.target.value)}
                placeholder="4242 4242 4242 4242"
                maxLength={19}
                className="w-full px-3.5 py-2.5 rounded-xl text-sm font-mono outline-none transition-all"
                style={{ background: "rgba(3,11,26,0.85)", border: "1px solid rgba(0,212,255,0.15)", color: "rgba(226,232,240,0.9)", caretColor: "#00d4ff", letterSpacing: "0.1em" }}
                onFocus={(e) => { e.target.style.border = "1px solid rgba(0,212,255,0.4)"; }}
                onBlur={(e)  => { e.target.style.border = "1px solid rgba(0,212,255,0.15)"; }}
              />
            </div>

            <div className="grid grid-cols-3 gap-2">
              {[
                { label: "Expiry", value: cardExp, set: setCardExp, placeholder: "MM/YY", max: 5, type: "text" as const },
                { label: "CVV",    value: cardCvv, set: setCardCvv, placeholder: "123",   max: 4, type: "password" as const },
                { label: "Name",   value: cardName,set: setCardName,placeholder: "J. DOE",max: 26,type: "text" as const },
              ].map(({ label, value, set, placeholder, max, type }) => (
                <div key={label}>
                  <label className="block text-[9px] font-['Orbitron'] tracking-widest text-[rgba(148,163,184,0.4)] mb-1.5 uppercase">{label}</label>
                  <input
                    value={value}
                    onChange={(e) => set(e.target.value)}
                    placeholder={placeholder}
                    maxLength={max}
                    type={type}
                    className="w-full px-3 py-2.5 rounded-xl text-sm font-mono outline-none transition-all"
                    style={{ background: "rgba(3,11,26,0.85)", border: "1px solid rgba(0,212,255,0.15)", color: "rgba(226,232,240,0.9)", caretColor: "#00d4ff" }}
                    onFocus={(e) => { e.target.style.border = "1px solid rgba(0,212,255,0.4)"; }}
                    onBlur={(e)  => { e.target.style.border = "1px solid rgba(0,212,255,0.15)"; }}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Features list */}
        <div className="space-y-2">
          {features.map((f) => (
            <div key={f} className="flex items-center gap-2.5">
              <div className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ background: "rgba(0,255,136,0.12)", border: "1px solid rgba(0,255,136,0.2)" }}>
                <Check className="w-2.5 h-2.5 text-[#00ff88]" />
              </div>
              <span className="text-xs text-[rgba(148,163,184,0.65)] font-['Rajdhani']">{f}</span>
            </div>
          ))}
        </div>

        {/* CTA — shows payment-gateway notice instead of live checkout */}
        <AnimatePresence mode="wait">
          {payNotice ? (
            <motion.div
              key="notice"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="rounded-xl p-4"
              style={{ background: "rgba(251,146,60,0.07)", border: "1px solid rgba(251,146,60,0.25)" }}
            >
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-orange-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-['Orbitron'] font-bold text-orange-400 mb-1">
                    Payment Gateway — Coming Soon
                  </p>
                  <p className="text-[11px] text-[rgba(148,163,184,0.65)] font-['Rajdhani'] leading-relaxed">
                    We are currently experiencing technical issues with our payment gateway.
                    Our team is working on it, and it will be live soon.{" "}
                    <span className="text-orange-400">Thank you for your patience!</span>
                  </p>
                  <button
                    onClick={() => setPayNotice(false)}
                    className="mt-2 text-[10px] font-['Rajdhani'] font-bold text-[rgba(148,163,184,0.45)] hover:text-white transition-colors"
                  >
                    ← Back
                  </button>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.button
              key="cta"
              whileHover={{ y: -2, boxShadow: "0 0 28px rgba(168,85,247,0.45)" }}
              whileTap={{ scale: 0.97 }}
              onClick={handlePay}
              className="w-full py-3.5 rounded-xl font-['Orbitron'] text-sm font-bold tracking-wider text-white flex items-center justify-center gap-2"
              style={{ background: "linear-gradient(135deg, #7c3aed, #a855f7, #00d4ff)" }}
            >
              <Crown className="w-4 h-4" />
              {isPro ? "Manage Billing" : "Upgrade to Pro — $29/mo"}
            </motion.button>
          )}
        </AnimatePresence>

        {/* Sign out */}
        <motion.button
          whileHover={{ y: -1 }} whileTap={{ scale: 0.97 }}
          onClick={() => signOut({ callbackUrl: "/auth/login" })}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-['Rajdhani'] font-bold text-red-400 hover:text-red-300 transition-colors"
          style={{ background: "rgba(239,68,68,0.05)", border: "1px solid rgba(239,68,68,0.12)" }}
        >
          <LogOut className="w-3.5 h-3.5" /> Sign Out
        </motion.button>
      </div>
    </>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   Settings Tab — toggles, API notice, export, delete
   ───────────────────────────────────────────────────────────────────────────── */
function ToggleRow({ label, sub, defaultOn = false }: { label: string; sub: string; defaultOn?: boolean }) {
  const [on, setOn] = useState(defaultOn);
  return (
    <div className="flex items-center justify-between py-3 border-b border-[rgba(255,255,255,0.04)]">
      <div>
        <p className="text-xs font-['Rajdhani'] font-bold text-[rgba(226,232,240,0.8)]">{label}</p>
        <p className="text-[10px] text-[rgba(148,163,184,0.38)]">{sub}</p>
      </div>
      <button
        onClick={() => setOn((v) => !v)}
        className="w-10 h-5 rounded-full relative transition-all duration-300 flex-shrink-0"
        style={{ background: on ? "linear-gradient(90deg, #00d4ff, #a855f7)" : "rgba(255,255,255,0.08)" }}
      >
        <motion.span
          animate={{ x: on ? 21 : 2 }}
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
          className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow"
        />
      </button>
    </div>
  );
}

function SettingsTab() {
  const [copied,       setCopied]       = useState(false);
  const [exporting,    setExporting]    = useState(false);
  const [deleteOpen,   setDeleteOpen]   = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await fetch("/api/user/export");
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      const cd   = res.headers.get("Content-Disposition") ?? "";
      const name = cd.match(/filename="([^"]+)"/)?.[1] ?? "ai-nexus-export.json";
      a.href = url; a.download = name; a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("[Export]", err);
    } finally {
      setExporting(false);
    }
  };

  const copy = () => { setCopied(true); setTimeout(() => setCopied(false), 2000); };

  return (
    <>
      <DeleteAccountModal isOpen={deleteOpen} onClose={() => setDeleteOpen(false)} />

      <div className="space-y-1">
        <ToggleRow label="Email Notifications" sub="Usage reports and system alerts"       defaultOn />
        <ToggleRow label="Streaming Responses" sub="Display tokens as they're generated"  defaultOn />
        <ToggleRow label="Code Auto-format"    sub="Format snippets on paste"             defaultOn />
        <ToggleRow label="Analytics Sharing"   sub="Help improve AI models (anonymous)" />

        {/* API Key */}
        <div className="pt-4">
          <p className="text-[9px] font-['Orbitron'] tracking-widest text-[rgba(148,163,184,0.3)] mb-3 uppercase">
            API Access
          </p>
          <div
            className="flex items-center gap-2 px-3.5 py-3 rounded-xl"
            style={{ background: "rgba(3,11,26,0.8)", border: "1px solid rgba(0,212,255,0.12)" }}
          >
            <Key className="w-3.5 h-3.5 text-[rgba(0,212,255,0.5)] flex-shrink-0" />
            <span className="flex-1 text-xs font-mono text-[rgba(148,163,184,0.4)] tracking-wider">
              nx_••••••••••••••••••••••
            </span>
            <motion.button
              whileTap={{ scale: 0.92 }}
              onClick={copy}
              className="text-[10px] font-['Rajdhani'] font-bold transition-colors"
              style={{ color: copied ? "#00ff88" : "rgba(0,212,255,0.7)" }}
            >
              {copied ? "COPIED!" : "COPY"}
            </motion.button>
          </div>
          {/* API Key notice — amber alert */}
          <div
            className="mt-2.5 flex items-start gap-2.5 px-3.5 py-3 rounded-xl"
            style={{
              background: "rgba(251,191,36,0.06)",
              border:     "1px solid rgba(251,191,36,0.2)",
              boxShadow:  "0 0 18px rgba(251,191,36,0.04)",
            }}
          >
            <Info className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
            <p className="text-[10px] font-['Rajdhani'] leading-relaxed text-[rgba(226,232,240,0.7)]">
              <span className="text-amber-400 font-bold">Pro Plan Required — </span>
              Custom API keys are only active for Pro Plan users. Upgrade to use
              personal Groq, OpenAI, or HuggingFace keys with your own quota.
            </p>
          </div>
        </div>

        {/* Danger zone */}
        <div className="pt-4">
          <p className="text-[9px] font-['Orbitron'] tracking-widest text-[rgba(239,68,68,0.4)] mb-3 uppercase">
            Danger Zone
          </p>

          {/* 30-day retention info card */}
          <div
            className="rounded-xl p-3.5 mb-3"
            style={{
              background: "rgba(0,212,255,0.03)",
              border:     "1px solid rgba(0,212,255,0.09)",
            }}
          >
            <div className="flex items-center gap-2 mb-2.5">
              <Info className="w-3 h-3 text-[rgba(0,212,255,0.5)] flex-shrink-0" />
              <p className="text-[9px] font-['Orbitron'] tracking-[0.15em] text-[rgba(0,212,255,0.55)] uppercase">
                Data Retention Policy
              </p>
            </div>
            <ul className="space-y-1.5">
              {[
                "Account enters a 30-day deletion cooldown period",
                "All your data remains intact and recoverable",
                "Cancel deletion anytime before the deadline",
                "After 30 days all data is permanently erased",
                "Includes chats, images, resumes, and profile",
              ].map((point) => (
                <li key={point} className="flex items-start gap-2">
                  <div className="w-1 h-1 rounded-full bg-[rgba(0,212,255,0.35)] flex-shrink-0 mt-[5px]" />
                  <p className="text-[10px] text-[rgba(148,163,184,0.5)] font-['Rajdhani'] leading-relaxed">
                    {point}
                  </p>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex gap-2">
            <motion.button
              whileHover={{ y: -1 }} whileTap={{ scale: 0.97 }}
              onClick={handleExport}
              disabled={exporting}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-['Rajdhani'] font-bold tracking-wider disabled:opacity-50 transition-all"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", color: exporting ? "rgba(0,212,255,0.6)" : "rgba(148,163,184,0.6)" }}
            >
              {exporting
                ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Exporting…</>
                : <><Download className="w-3.5 h-3.5" /> Export Data</>
              }
            </motion.button>
            <motion.button
              whileHover={{ y: -1 }} whileTap={{ scale: 0.97 }}
              onClick={() => setDeleteOpen(true)}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-['Rajdhani'] font-bold tracking-wider text-red-400"
              style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.15)" }}
            >
              <Trash2 className="w-3.5 h-3.5" /> Delete Account
            </motion.button>
          </div>
        </div>
      </div>
    </>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   Modal shell
   ───────────────────────────────────────────────────────────────────────────── */
interface ProfileModalProps {
  isOpen:      boolean;
  onClose:     () => void;
  initialTab?: "account" | "subscription" | "settings";
}

export default function ProfileModal({ isOpen, onClose, initialTab = "account" }: ProfileModalProps) {
  const [activeTab, setActiveTab] = useState(initialTab);

  /* Sync tab when modal is re-opened with a different initialTab */
  useEffect(() => { if (isOpen) setActiveTab(initialTab); }, [isOpen, initialTab]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 bg-black/75 backdrop-blur-md"
            onClick={onClose}
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 24 }}
            transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-lg rounded-2xl overflow-hidden"
            style={{
              background: "linear-gradient(160deg, rgba(8,22,46,0.98), rgba(3,11,26,0.99))",
              border:     "1px solid rgba(0,212,255,0.18)",
              boxShadow:  "0 30px 80px rgba(0,0,0,0.85), 0 0 80px rgba(0,212,255,0.06)",
            }}
          >
            <div className="h-[1px] bg-gradient-to-r from-transparent via-[rgba(0,212,255,0.5)] to-transparent" />

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-[rgba(0,212,255,0.08)]">
              <div>
                <h2 className="font-['Orbitron'] text-xs font-bold text-white tracking-[0.15em]">
                  PROFILE SETTINGS
                </h2>
                <p className="text-[10px] text-[rgba(0,212,255,0.45)] font-['Rajdhani'] tracking-widest mt-0.5">
                  Manage your account &amp; preferences
                </p>
              </div>
              <motion.button
                whileHover={{ rotate: 90 }}
                transition={{ duration: 0.2 }}
                onClick={onClose}
                className="w-8 h-8 rounded-xl flex items-center justify-center text-[rgba(148,163,184,0.4)] hover:text-white hover:bg-[rgba(255,255,255,0.08)] transition-all"
              >
                <X className="w-4 h-4" />
              </motion.button>
            </div>

            {/* Tabs */}
            <div className="flex px-5 gap-1 pt-3 border-b border-[rgba(255,255,255,0.05)]">
              {TABS.map(({ id, label, icon: Icon }) => {
                const active = activeTab === id;
                return (
                  <button
                    key={id}
                    onClick={() => setActiveTab(id as "account" | "subscription" | "settings")}
                    className={`relative flex items-center gap-1.5 px-4 py-2.5 rounded-t-lg text-xs font-['Rajdhani'] font-bold tracking-wider transition-all ${
                      active
                        ? "text-[#00d4ff] bg-[rgba(0,212,255,0.06)]"
                        : "text-[rgba(148,163,184,0.45)] hover:text-[rgba(226,232,240,0.7)] hover:bg-[rgba(255,255,255,0.03)]"
                    }`}
                    style={active ? { border: "1px solid rgba(0,212,255,0.15)", borderBottom: "none" } : undefined}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {label}
                    {active && (
                      <motion.div
                        layoutId="modalTabLine"
                        className="absolute -bottom-px left-0 right-0 h-[2px] bg-gradient-to-r from-[#00d4ff] to-[#a855f7] rounded-full"
                      />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Content */}
            <div className="overflow-y-auto" style={{ maxHeight: "62vh" }}>
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeTab}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.18 }}
                  className="px-5 py-4"
                >
                  {activeTab === "account"      && <AccountTab />}
                  {activeTab === "subscription" && <SubscriptionTab />}
                  {activeTab === "settings"     && <SettingsTab />}
                </motion.div>
              </AnimatePresence>
            </div>

            <div className="h-[1px] bg-gradient-to-r from-transparent via-[rgba(168,85,247,0.25)] to-transparent" />
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
