"use client";

import { useEffect, useRef, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { signIn, useSession } from "next-auth/react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { ShieldCheck, ArrowLeft, RefreshCw, Bot, CheckCircle } from "lucide-react";
import AuthBackground from "@/components/AuthBackground";

/* ─── Shake variants for wrong code ─────────────────── */
import type { Variants } from "framer-motion";

const shakeVariants: Variants = {
  idle:  { x: 0 },
  shake: { x: [-10, 10, -8, 8, -5, 5, 0], transition: { duration: 0.5, type: "tween" } },
};

/* ─── Single OTP digit box ───────────────────────────── */
function OtpBox({
  value, index, focused, error, disabled,
  onChange, onKeyDown, onFocus,
  inputRef,
}: {
  value: string; index: number; focused: boolean; error: boolean; disabled: boolean;
  onChange: (i: number, v: string) => void;
  onKeyDown: (i: number, e: React.KeyboardEvent<HTMLInputElement>) => void;
  onFocus: (i: number) => void;
  inputRef: (el: HTMLInputElement | null) => void;
}) {
  const filled = value !== "";

  const borderColor = error
    ? "rgba(239,68,68,0.7)"
    : focused
    ? "rgba(0,212,255,0.7)"
    : filled
    ? "rgba(0,212,255,0.45)"
    : "rgba(0,212,255,0.12)";

  const glow = error
    ? "0 0 0 2px rgba(239,68,68,0.12), 0 0 16px rgba(239,68,68,0.2)"
    : focused
    ? "0 0 0 2px rgba(0,212,255,0.12), 0 0 20px rgba(0,212,255,0.25)"
    : filled
    ? "0 0 12px rgba(0,212,255,0.15)"
    : "none";

  return (
    <motion.div
      animate={filled ? { scale: [1, 1.08, 1] } : { scale: 1 }}
      transition={{ duration: 0.18 }}
      className="relative"
    >
      {/* Ambient glow behind box */}
      <div
        className="absolute inset-0 rounded-xl pointer-events-none transition-opacity duration-200"
        style={{
          opacity: focused || filled ? 1 : 0,
          background: error
            ? "rgba(239,68,68,0.08)"
            : "linear-gradient(135deg,rgba(0,212,255,0.1),rgba(168,85,247,0.06))",
          filter: "blur(4px)",
        }}
      />
      <input
        ref={inputRef}
        type="text"
        inputMode="numeric"
        maxLength={2}
        value={value}
        onChange={(e) => onChange(index, e.target.value)}
        onKeyDown={(e) => onKeyDown(index, e)}
        onFocus={() => onFocus(index)}
        disabled={disabled}
        className="relative text-center font-['Orbitron'] font-bold text-xl sm:text-2xl outline-none rounded-xl transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed select-none"
        style={{
          width: "clamp(40px, 12vw, 54px)",
          height: "clamp(50px, 15vw, 66px)",
          background: "rgba(3,11,26,0.85)",
          border: `1.5px solid ${borderColor}`,
          boxShadow: glow,
          color: error ? "#ef4444" : filled ? "#00d4ff" : "rgba(148,163,184,0.5)",
          caretColor: "#00d4ff",
        }}
      />
    </motion.div>
  );
}

/* ─── Main form ──────────────────────────────────────── */
function OtpVerifyForm() {
  const { update } = useSession();
  const params   = useSearchParams();
  const email    = params.get("email") ?? "";
  const mode     = params.get("mode")  ?? "login";

  const [digits,    setDigits]    = useState(["", "", "", "", "", ""]);
  const [focusedIdx, setFocused]  = useState<number>(-1);
  const [loading,   setLoading]   = useState(false);
  const [resending, setResending] = useState(false);
  const [error,     setError]     = useState("");
  const [success,   setSuccess]   = useState(false);
  const [countdown, setCountdown] = useState(60);
  const [shakeState, setShake]    = useState<"idle" | "shake">("idle");
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  /* ── Resend countdown ──────────────────────────────── */
  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  /* ── Auto-focus first box ──────────────────────────── */
  useEffect(() => { inputRefs.current[0]?.focus(); }, []);

  /* ── Digit handlers ────────────────────────────────── */
  function handleDigitChange(index: number, val: string) {
    const cleaned = val.replace(/\D/g, "").slice(-1);
    const updated = [...digits];
    updated[index] = cleaned;
    setDigits(updated);
    setError("");
    setShake("idle");
    if (cleaned && index < 5) {
      setTimeout(() => inputRefs.current[index + 1]?.focus(), 0);
    }
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace") {
      if (digits[index]) {
        const updated = [...digits];
        updated[index] = "";
        setDigits(updated);
      } else if (index > 0) {
        inputRefs.current[index - 1]?.focus();
      }
    } else if (e.key === "ArrowLeft" && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === "ArrowRight" && index < 5) {
      inputRefs.current[index + 1]?.focus();
    } else if (e.key === "Enter") {
      handleVerify(e as unknown as React.FormEvent);
    }
  }

  function handlePaste(e: React.ClipboardEvent) {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pasted.length > 0) {
      const updated = [...digits];
      for (let i = 0; i < 6; i++) updated[i] = pasted[i] ?? "";
      setDigits(updated);
      const focusIdx = Math.min(pasted.length, 5);
      setTimeout(() => inputRefs.current[focusIdx]?.focus(), 0);
    }
  }

  /* ── Verify ─────────────────────────────────────────── */
  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    const otp = digits.join("");
    if (otp.length !== 6) {
      setError("Please enter all 6 digits.");
      triggerShake();
      return;
    }

    setLoading(true);
    setError("");

    try {
      const result = await signIn("otp", { email, otp, redirect: false });

      if (!result?.ok || result?.error) {
        setError("Incorrect or expired code. Try again or request a new one.");
        triggerShake();
        setDigits(["", "", "", "", "", ""]);
        setTimeout(() => inputRefs.current[0]?.focus(), 50);
        return;
      }

      /* ── SUCCESS ─────────────────────────────────────────
         1. Show the success screen immediately.
         2. Call update() so NextAuth syncs the JWT cookie
            into the client-side session store — this acts
            as a checkpoint confirming the cookie is active.
         3. Hard-navigate after update() resolves so the
            browser carries the committed cookie to /dashboard.  */
      setSuccess(true);
      await update();
      window.location.href = "/dashboard";
    } catch {
      setError("Network error. Please check your connection.");
      triggerShake();
    } finally {
      setLoading(false);
    }
  }

  function triggerShake() {
    setShake("shake");
    setTimeout(() => setShake("idle"), 600);
  }

  /* ── Resend ─────────────────────────────────────────── */
  async function handleResend() {
    if (countdown > 0 || resending) return;
    setResending(true);
    setError("");
    try {
      const res  = await fetch("/api/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, mode }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Failed to resend."); return; }
      setCountdown(60);
      setDigits(["", "", "", "", "", ""]);
      setTimeout(() => inputRefs.current[0]?.focus(), 50);
    } catch {
      setError("Network error.");
    } finally {
      setResending(false);
    }
  }

  const otp = digits.join("");
  const isComplete = otp.length === 6;

  /* ── Masked email display ────────────────────────────── */
  const maskedEmail = (() => {
    const [local, domain] = email.split("@");
    if (!local || !domain) return email;
    const visible = local.slice(0, 2);
    return `${visible}${"•".repeat(Math.max(local.length - 2, 3))}@${domain}`;
  })();

  /* ── Success screen ─────────────────────────────────── */
  if (success) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center justify-center py-10 gap-5"
      >
        <motion.div
          initial={{ scale: 0, rotate: -45 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 280, damping: 20 }}
          className="w-20 h-20 rounded-full flex items-center justify-center"
          style={{
            background: "rgba(0,255,136,0.1)",
            border: "2px solid rgba(0,255,136,0.4)",
            boxShadow: "0 0 40px rgba(0,255,136,0.25)",
          }}
        >
          <CheckCircle className="w-10 h-10 text-[#00ff88]" />
        </motion.div>
        <div className="text-center">
          <p className="font-['Orbitron'] text-base font-bold text-white mb-1">Identity Verified!</p>
          <p className="text-sm text-[rgba(148,163,184,0.55)] font-['Rajdhani']">Redirecting to your dashboard…</p>
        </div>
        <div className="flex items-center gap-2.5 px-5 py-3 rounded-xl"
          style={{ background: "rgba(0,212,255,0.06)", border: "1px solid rgba(0,212,255,0.18)" }}>
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            className="w-4 h-4 border-2 border-[rgba(0,212,255,0.25)] border-t-[#00d4ff] rounded-full flex-shrink-0"
          />
          <span className="text-xs font-['Rajdhani'] font-semibold text-[#00d4ff] tracking-wider">
            LAUNCHING DASHBOARD
          </span>
        </div>
      </motion.div>
    );
  }

  /* ── Form ────────────────────────────────────────────── */
  return (
    <form onSubmit={handleVerify} noValidate>
      {/* Email indicator */}
      <div className="flex items-center gap-2 mb-6 px-4 py-3 rounded-xl"
        style={{ background: "rgba(0,212,255,0.05)", border: "1px solid rgba(0,212,255,0.12)" }}>
        <ShieldCheck className="w-4 h-4 text-[#00d4ff] flex-shrink-0" />
        <p className="text-xs font-['Rajdhani'] text-[rgba(148,163,184,0.65)] truncate">
          Code sent to <span className="text-[#00d4ff] font-semibold">{maskedEmail || "your email"}</span>
        </p>
      </div>

      {/* OTP boxes */}
      <motion.div
        variants={shakeVariants}
        animate={shakeState}
        className="flex justify-center gap-2 sm:gap-3 mb-6"
        onPaste={handlePaste}
      >
        {digits.map((digit, i) => (
          <div key={i} className="flex items-center gap-2 sm:gap-3">
            <OtpBox
              value={digit}
              index={i}
              focused={focusedIdx === i}
              error={!!error && otp.length === 6}
              disabled={loading}
              onChange={handleDigitChange}
              onKeyDown={handleKeyDown}
              onFocus={setFocused}
              inputRef={(el) => { inputRefs.current[i] = el; }}
            />
            {/* Dot separator between box 3 and 4 */}
            {i === 2 && (
              <span className="text-[rgba(0,212,255,0.35)] text-xl font-bold select-none">·</span>
            )}
          </div>
        ))}
      </motion.div>

      {/* Error / info messages */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -8, height: 0 }}
            animate={{ opacity: 1, y: 0, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-4 px-4 py-3 rounded-xl text-sm font-['Rajdhani'] text-red-400 overflow-hidden"
            style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)" }}
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Verify button */}
      <motion.button
        type="submit"
        disabled={loading || !isComplete}
        whileHover={isComplete && !loading ? {
          y: -2,
          boxShadow: "0 0 32px rgba(0,212,255,0.45), 0 0 64px rgba(0,212,255,0.15)",
        } : {}}
        whileTap={isComplete && !loading ? { scale: 0.97, y: 0 } : {}}
        transition={{ duration: 0.2 }}
        className="w-full py-3.5 rounded-xl font-['Orbitron'] text-sm font-bold tracking-widest text-white flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed mb-5"
        style={{ background: "linear-gradient(135deg, #00d4ff 0%, #0284c7 50%, #7c3aed 100%)" }}
      >
        {loading ? (
          <>
            <motion.span
              animate={{ rotate: 360 }}
              transition={{ duration: 0.9, repeat: Infinity, ease: "linear" }}
              className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full"
            />
            VERIFYING…
          </>
        ) : (
          <>VERIFY CODE <ShieldCheck className="w-4 h-4" /></>
        )}
      </motion.button>

      {/* Resend + back */}
      <div className="flex items-center justify-between">
        <Link
          href={mode === "register" ? "/auth/register" : "/auth/login"}
          className="flex items-center gap-1.5 text-[rgba(148,163,184,0.45)] hover:text-[#00d4ff] transition-colors text-xs font-['Rajdhani'] font-semibold"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back
        </Link>

        <motion.button
          type="button"
          onClick={handleResend}
          disabled={countdown > 0 || resending}
          whileHover={countdown === 0 && !resending ? { scale: 1.03 } : {}}
          whileTap={countdown === 0 && !resending ? { scale: 0.97 } : {}}
          className="flex items-center gap-1.5 text-xs font-['Rajdhani'] font-semibold transition-colors disabled:opacity-35 disabled:cursor-not-allowed"
          style={{ color: countdown === 0 && !resending ? "#00d4ff" : "rgba(148,163,184,0.4)" }}
        >
          {resending ? (
            <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Sending…</>
          ) : countdown > 0 ? (
            <span>Resend in <span className="font-['Orbitron']">{countdown}s</span></span>
          ) : (
            <><RefreshCw className="w-3.5 h-3.5" /> Resend Code</>
          )}
        </motion.button>
      </div>
    </form>
  );
}

/* ─── Page ───────────────────────────────────────────── */
export default function VerifyOtpPage() {
  return (
    <main className="relative min-h-screen flex flex-col items-center justify-center px-4 py-10">
      <AuthBackground />

      <div className="w-full max-w-[420px]">
        {/* Brand */}
        <motion.div
          initial={{ opacity: 0, y: -22 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex flex-col items-center mb-8"
        >
          <motion.div
            animate={{
              boxShadow: [
                "0 0 20px rgba(0,212,255,0.18)",
                "0 0 40px rgba(0,212,255,0.32)",
                "0 0 20px rgba(0,212,255,0.18)",
              ],
            }}
            transition={{ duration: 2.5, repeat: Infinity }}
            className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
            style={{
              background: "linear-gradient(135deg, rgba(0,212,255,0.15), rgba(168,85,247,0.2))",
              border: "1px solid rgba(0,212,255,0.3)",
            }}
          >
            <Bot className="w-7 h-7 text-[#00d4ff]" />
          </motion.div>

          <h1
            className="font-['Orbitron'] text-3xl sm:text-4xl font-black tracking-widest text-center mb-2"
            style={{
              background: "linear-gradient(90deg, #00d4ff 0%, #a855f7 55%, #f0abfc 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
              filter: "drop-shadow(0 0 20px rgba(0,212,255,0.18))",
            }}
          >
            AI NEXUS
          </h1>
          <p className="text-[rgba(148,163,184,0.4)] text-[10px] font-['Rajdhani'] tracking-[0.28em] uppercase">
            Identity Verification
          </p>
        </motion.div>

        {/* Card */}
        <motion.div
          initial={{ opacity: 0, y: 26 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="rounded-2xl overflow-hidden"
          style={{
            background: "linear-gradient(160deg, rgba(8,22,46,0.94), rgba(3,11,26,0.97))",
            border: "1px solid rgba(0,212,255,0.18)",
            boxShadow: "0 24px 64px rgba(0,0,0,0.65), 0 0 80px rgba(0,212,255,0.05)",
            backdropFilter: "blur(24px)",
          }}
        >
          <div className="h-[1px] bg-gradient-to-r from-transparent via-[rgba(0,212,255,0.55)] to-transparent" />

          <div className="px-6 sm:px-8 py-8">
            {/* Heading */}
            <div className="mb-7 text-center">
              <h2
                className="font-['Orbitron'] text-xl font-black tracking-wide mb-1.5"
                style={{
                  background: "linear-gradient(90deg, #00d4ff, #a855f7)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                Enter Verification Code
              </h2>
              <p className="text-[rgba(148,163,184,0.5)] text-sm font-['Rajdhani']">
                We sent a 6-digit code to your inbox
              </p>
            </div>

            <Suspense fallback={
              <div className="flex justify-center py-8">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  className="w-8 h-8 border-2 border-[rgba(0,212,255,0.2)] border-t-[#00d4ff] rounded-full"
                />
              </div>
            }>
              <OtpVerifyForm />
            </Suspense>
          </div>

          <div className="h-[1px] bg-gradient-to-r from-transparent via-[rgba(168,85,247,0.3)] to-transparent" />
        </motion.div>

        {/* Bottom status */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.25 }}
          className="grid grid-cols-3 gap-2 mt-4"
        >
          {[
            { emoji: "🔒", label: "End-to-end encrypted" },
            { emoji: "⚡", label: "Expires in 10 min" },
            { emoji: "🛡️", label: "Passwordless auth" },
          ].map(({ emoji, label }) => (
            <div
              key={label}
              className="rounded-xl px-2 py-2.5 flex flex-col items-center gap-1"
              style={{
                background: "rgba(10,31,61,0.65)",
                border: "1px solid rgba(0,212,255,0.09)",
                backdropFilter: "blur(12px)",
              }}
            >
              <span className="text-sm leading-none">{emoji}</span>
              <span className="text-[9px] font-['Rajdhani'] font-semibold text-[rgba(148,163,184,0.4)] tracking-wide text-center leading-tight">
                {label}
              </span>
            </div>
          ))}
        </motion.div>
      </div>
    </main>
  );
}
