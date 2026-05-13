"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { motion, AnimatePresence } from "framer-motion";
import { Mail, User, ArrowRight, Sparkles, Shield } from "lucide-react";
import AuthBackground from "@/components/AuthBackground";
import NexusInput from "@/components/NexusInput";

/* ─── Auth logic — preserved exactly ────────────────── */
export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [googleLoading, setGoogleLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!name.trim() || name.trim().length < 2) { setError("Please enter your full name (min 2 characters)."); return; }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) { setError("Please enter a valid email address."); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.toLowerCase().trim(), name: name.trim(), mode: "register" }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Failed to send OTP."); return; }
      const params = new URLSearchParams({ email: email.toLowerCase().trim(), mode: "register" });
      router.push(`/auth/verify-otp?${params}`);
    } catch { setError("Network error. Please check your connection."); }
    finally { setLoading(false); }
  }

  async function handleGoogle() {
    setGoogleLoading(true);
    try { await signIn("google", { callbackUrl: "/dashboard" }); }
    catch { setError("Google sign-in failed. Please try again."); setGoogleLoading(false); }
  }

  /* ─── UI ─────────────────────────────────────────── */
  return (
    <main className="relative min-h-screen flex flex-col items-center justify-center px-4 py-10">
      <AuthBackground />

      <div className="w-full max-w-[420px]">
        {/* Brand */}
        <motion.div
          initial={{ opacity: 0, y: -24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: [0.4, 0, 0.2, 1] }}
          className="flex flex-col items-center mb-8"
        >
          <div className="relative mb-5">
            <motion.div
              animate={{
                boxShadow: ["0 0 24px rgba(168,85,247,0.2)", "0 0 48px rgba(168,85,247,0.38)", "0 0 24px rgba(168,85,247,0.2)"],
              }}
              transition={{ duration: 3, repeat: Infinity }}
              className="w-14 h-14 rounded-2xl flex items-center justify-center"
              style={{
                background: "linear-gradient(135deg, rgba(168,85,247,0.18), rgba(0,212,255,0.14))",
                border: "1px solid rgba(168,85,247,0.35)",
              }}
            >
              <Sparkles className="w-7 h-7 text-[#a855f7]" />
            </motion.div>
          </div>

          <h1
            className="font-['Orbitron'] text-3xl sm:text-4xl font-black tracking-widest text-center mb-2"
            style={{
              background: "linear-gradient(90deg, #a855f7 0%, #00d4ff 55%, #00ff88 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
              filter: "drop-shadow(0 0 24px rgba(168,85,247,0.2))",
            }}
          >
            AI NEXUS
          </h1>
          <p className="text-[rgba(148,163,184,0.4)] text-[10px] font-['Rajdhani'] tracking-[0.28em] uppercase">
            Join the Quantum Knowledge Core
          </p>
        </motion.div>

        {/* Card */}
        <motion.div
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.1, ease: [0.4, 0, 0.2, 1] }}
          className="rounded-2xl overflow-hidden"
          style={{
            background: "linear-gradient(160deg, rgba(8,22,46,0.94), rgba(3,11,26,0.97))",
            border: "1px solid rgba(168,85,247,0.2)",
            boxShadow: "0 24px 64px rgba(0,0,0,0.65), 0 0 80px rgba(168,85,247,0.04)",
            backdropFilter: "blur(24px)",
          }}
        >
          {/* Top accent — purple gradient for register */}
          <div className="h-[1px] bg-gradient-to-r from-transparent via-[rgba(168,85,247,0.55)] to-transparent" />

          <div className="px-6 sm:px-8 py-8">
            {/* Heading — gradient (purple → cyan) */}
            <div className="mb-7">
              <h2
                className="font-['Orbitron'] text-xl sm:text-2xl font-black tracking-wide mb-1.5"
                style={{
                  background: "linear-gradient(90deg, #a855f7, #00d4ff)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                Create Account
              </h2>
              <p className="text-[rgba(148,163,184,0.5)] text-sm font-['Rajdhani'] leading-relaxed">
                Unlock the Future of Intelligence — join 10,000+ builders using AI Nexus.
              </p>
            </div>

            <form onSubmit={handleSubmit} noValidate>
              <NexusInput
                label="Full Name"
                id="name"
                type="text"
                value={name}
                onChange={setName}
                icon={<User className="w-4 h-4" />}
                required
                autoComplete="name"
              />
              <NexusInput
                label="Email Address"
                id="email"
                type="email"
                value={email}
                onChange={setEmail}
                icon={<Mail className="w-4 h-4" />}
                required
                autoComplete="email"
              />

              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -6, height: 0 }}
                    animate={{ opacity: 1, y: 0, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mb-4 px-4 py-3 rounded-xl text-sm font-['Rajdhani'] text-red-400 overflow-hidden"
                    style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.22)" }}
                  >
                    {error}
                  </motion.div>
                )}
              </AnimatePresence>

              <motion.button
                type="submit"
                disabled={loading}
                whileHover={!loading ? { y: -2, boxShadow: "0 0 32px rgba(168,85,247,0.48), 0 0 64px rgba(168,85,247,0.16)" } : {}}
                whileTap={!loading ? { scale: 0.97, y: 0 } : {}}
                transition={{ duration: 0.2 }}
                className="w-full py-3.5 rounded-xl font-['Orbitron'] text-sm font-bold tracking-widest text-white flex items-center justify-center gap-2 disabled:opacity-45 disabled:cursor-not-allowed mb-4"
                style={{ background: "linear-gradient(135deg, #a855f7 0%, #7c3aed 50%, #00d4ff 100%)" }}
              >
                {loading ? (
                  <>
                    <motion.span
                      animate={{ rotate: 360 }}
                      transition={{ duration: 0.9, repeat: Infinity, ease: "linear" }}
                      className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full"
                    />
                    SENDING CODE...
                  </>
                ) : (
                  <>CREATE ACCOUNT <ArrowRight className="w-4 h-4" /></>
                )}
              </motion.button>
            </form>

            {/* Passwordless badge */}
            <div
              className="flex items-center gap-2 mb-5 px-3.5 py-2.5 rounded-xl"
              style={{ background: "rgba(0,255,136,0.04)", border: "1px solid rgba(0,255,136,0.1)" }}
            >
              <Shield className="w-3.5 h-3.5 text-[rgba(0,255,136,0.6)] flex-shrink-0" />
              <p className="text-[10px] font-['Rajdhani'] text-[rgba(0,255,136,0.55)] leading-snug">
                Passwordless — we send a one-time code to your email. No password stored.
              </p>
            </div>

            {/* Divider */}
            <div className="flex items-center gap-3 mb-5">
              <div className="flex-1 h-px bg-[rgba(255,255,255,0.06)]" />
              <span className="text-[rgba(148,163,184,0.3)] text-[10px] font-['Orbitron'] tracking-widest">OR</span>
              <div className="flex-1 h-px bg-[rgba(255,255,255,0.06)]" />
            </div>

            {/* Google */}
            <motion.button
              onClick={handleGoogle}
              disabled={googleLoading}
              whileHover={!googleLoading ? { y: -2, borderColor: "rgba(255,255,255,0.2)" } : {}}
              whileTap={!googleLoading ? { scale: 0.97 } : {}}
              transition={{ duration: 0.2 }}
              className="w-full py-3 rounded-xl font-['Rajdhani'] text-sm font-semibold tracking-wider text-[rgba(226,232,240,0.82)] flex items-center justify-center gap-3 disabled:opacity-45 disabled:cursor-not-allowed"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)" }}
            >
              <svg viewBox="0 0 24 24" style={{ width: 18, height: 18, flexShrink: 0 }}>
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              {googleLoading ? "Connecting..." : "Continue with Google"}
            </motion.button>

            <p className="text-center text-[rgba(148,163,184,0.38)] text-sm mt-6 font-['Rajdhani']">
              Already have an account?{" "}
              <Link href="/auth/login" className="font-bold text-[#00d4ff] hover:text-[#00ff88] transition-colors">
                Sign in
              </Link>
            </p>
          </div>

          <div className="h-[1px] bg-gradient-to-r from-transparent via-[rgba(0,212,255,0.22)] to-transparent" />
        </motion.div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.28 }}
          className="grid grid-cols-3 gap-2 mt-4"
        >
          {[
            { value: "10K+", label: "Users" },
            { value: "FREE", label: "To Start" },
            { value: "5 Tools", label: "Included" },
          ].map(({ value, label }) => (
            <div
              key={label}
              className="rounded-xl px-3 py-3 text-center"
              style={{
                background: "rgba(10,31,61,0.65)",
                border: "1px solid rgba(168,85,247,0.1)",
                backdropFilter: "blur(12px)",
              }}
            >
              <p className="font-['Orbitron'] text-xs font-bold text-[rgba(168,85,247,0.85)]">{value}</p>
              <p className="text-[9px] text-[rgba(148,163,184,0.38)] font-['Rajdhani'] tracking-wider mt-0.5">{label}</p>
            </div>
          ))}
        </motion.div>
      </div>
    </main>
  );
}
