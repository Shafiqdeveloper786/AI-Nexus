"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Trash2, ShieldAlert, CheckCircle, Loader2, Calendar } from "lucide-react";
import { signOut } from "next-auth/react";

interface DeleteAccountModalProps {
  isOpen:  boolean;
  onClose: () => void;
}

type Phase = "confirm" | "loading" | "done";

export default function DeleteAccountModal({ isOpen, onClose }: DeleteAccountModalProps) {
  const [phase,        setPhase]        = useState<Phase>("confirm");
  const [deletionDate, setDeletionDate] = useState<string>("");
  const [error,        setError]        = useState<string>("");

  const handleDelete = async () => {
    setPhase("loading");
    setError("");
    try {
      const res = await fetch("/api/user/delete", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to initiate deletion.");
      setDeletionDate(data.deletionDate);
      setPhase("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setPhase("confirm");
    }
  };

  const handleClose = () => {
    if (phase === "done") {
      /* Sign out after acknowledging deletion notice */
      signOut({ callbackUrl: "/auth/login" });
      return;
    }
    setPhase("confirm");
    setError("");
    onClose();
  };

  const formattedDate = deletionDate
    ? new Date(deletionDate).toLocaleDateString("en-US", {
        year: "numeric", month: "long", day: "numeric",
      })
    : "";

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/85 backdrop-blur-lg"
            onClick={phase === "loading" ? undefined : handleClose}
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.88, y: 28 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.88, y: 28 }}
            transition={{ type: "spring", stiffness: 300, damping: 26 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-[380px] rounded-3xl overflow-hidden"
            style={{
              background: "linear-gradient(160deg, rgba(8,22,46,0.99), rgba(3,11,26,0.99))",
              border:     phase === "done"
                ? "1px solid rgba(0,255,136,0.3)"
                : "1px solid rgba(239,68,68,0.3)",
              boxShadow:  "0 32px 80px rgba(0,0,0,0.9)",
            }}
          >
            <div
              className="h-[2px]"
              style={{
                background: phase === "done"
                  ? "linear-gradient(90deg, transparent, #00ff88, transparent)"
                  : "linear-gradient(90deg, transparent, #ef4444, transparent)",
              }}
            />

            {phase !== "loading" && (
              <button
                onClick={handleClose}
                className="absolute top-3.5 right-3.5 w-7 h-7 rounded-full flex items-center justify-center text-[rgba(148,163,184,0.35)] hover:text-white hover:bg-[rgba(255,255,255,0.08)] transition-all z-10"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}

            <div className="px-6 py-6">
              {/* ── Confirmation phase ─────────────────────────────── */}
              {(phase === "confirm" || phase === "loading") && (
                <div className="flex flex-col items-center text-center gap-4">
                  <motion.div
                    animate={phase === "loading" ? {} : { scale: [1, 1.08, 1] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                    className="w-16 h-16 rounded-2xl flex items-center justify-center"
                    style={{
                      background: "linear-gradient(135deg, rgba(239,68,68,0.15), rgba(251,146,60,0.1))",
                      border:     "1px solid rgba(239,68,68,0.35)",
                      boxShadow:  "0 0 40px rgba(239,68,68,0.15)",
                    }}
                  >
                    {phase === "loading"
                      ? <Loader2 className="w-8 h-8 text-red-400 animate-spin" />
                      : <ShieldAlert className="w-8 h-8 text-red-400" />
                    }
                  </motion.div>

                  <div>
                    <h2 className="font-['Orbitron'] text-sm font-black text-white tracking-wide mb-2">
                      Delete Your Account?
                    </h2>
                    <p className="text-sm text-[rgba(148,163,184,0.65)] font-['Rajdhani'] leading-relaxed">
                      This will start a{" "}
                      <span className="text-red-400 font-bold">30-day deletion process</span>.
                      You can log back in at any time within that window to cancel and recover
                      all your data.
                    </p>
                  </div>

                  {error && (
                    <p className="text-xs text-red-400 font-['Rajdhani'] px-4 py-2 rounded-xl w-full text-center"
                      style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
                      {error}
                    </p>
                  )}

                  <div className="flex gap-2 w-full pt-1">
                    <motion.button
                      whileHover={{ y: -1 }} whileTap={{ scale: 0.97 }}
                      onClick={handleClose}
                      disabled={phase === "loading"}
                      className="flex-1 py-3 rounded-xl text-xs font-['Rajdhani'] font-bold tracking-wider transition-all disabled:opacity-40"
                      style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(148,163,184,0.7)" }}
                    >
                      Cancel
                    </motion.button>
                    <motion.button
                      whileHover={phase !== "loading" ? { y: -1, boxShadow: "0 0 20px rgba(239,68,68,0.4)" } : {}}
                      whileTap={phase !== "loading" ? { scale: 0.97 } : {}}
                      onClick={handleDelete}
                      disabled={phase === "loading"}
                      className="flex-1 flex items-center justify-center gap-1.5 py-3 rounded-xl text-xs font-['Orbitron'] font-bold tracking-wider text-white disabled:opacity-70"
                      style={{ background: "linear-gradient(135deg, #dc2626, #ef4444)" }}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      {phase === "loading" ? "Processing…" : "Yes, Delete"}
                    </motion.button>
                  </div>
                </div>
              )}

              {/* ── Done phase ─────────────────────────────────────── */}
              {phase === "done" && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex flex-col items-center text-center gap-4"
                >
                  <motion.div
                    initial={{ scale: 0, rotate: -30 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: "spring", stiffness: 260, damping: 18 }}
                    className="w-16 h-16 rounded-2xl flex items-center justify-center"
                    style={{
                      background: "rgba(0,255,136,0.1)",
                      border:     "1px solid rgba(0,255,136,0.35)",
                      boxShadow:  "0 0 40px rgba(0,255,136,0.2)",
                    }}
                  >
                    <CheckCircle className="w-8 h-8 text-[#00ff88]" />
                  </motion.div>

                  <div>
                    <h2 className="font-['Orbitron'] text-sm font-black text-white tracking-wide mb-2">
                      Account Deletion Initiated
                    </h2>
                    <p className="text-sm text-[rgba(148,163,184,0.65)] font-['Rajdhani'] leading-relaxed">
                      Your account is now in the deletion process. You have{" "}
                      <span className="text-[#00ff88] font-bold">30 days</span> to log back
                      in to cancel this request and save your data. Otherwise, all data will
                      be permanently purged.
                    </p>
                  </div>

                  {formattedDate && (
                    <div
                      className="flex items-center gap-2.5 px-4 py-3 rounded-xl w-full"
                      style={{
                        background: "rgba(0,255,136,0.06)",
                        border:     "1px solid rgba(0,255,136,0.18)",
                      }}
                    >
                      <Calendar className="w-4 h-4 text-[#00ff88] flex-shrink-0" />
                      <div className="text-left">
                        <p className="text-[9px] font-['Orbitron'] text-[rgba(0,255,136,0.6)] tracking-widest uppercase">
                          Permanent Deletion On
                        </p>
                        <p className="text-xs font-['Rajdhani'] font-bold text-[#00ff88] mt-0.5">
                          {formattedDate}
                        </p>
                      </div>
                    </div>
                  )}

                  <motion.button
                    whileHover={{ y: -2 }} whileTap={{ scale: 0.97 }}
                    onClick={handleClose}
                    className="w-full py-3 rounded-xl font-['Orbitron'] text-xs font-bold tracking-widest text-white"
                    style={{ background: "linear-gradient(135deg, #00d4ff, #a855f7)" }}
                  >
                    Understood — Sign Me Out
                  </motion.button>
                </motion.div>
              )}
            </div>

            <div className="h-[1px] bg-gradient-to-r from-transparent via-[rgba(168,85,247,0.15)] to-transparent" />
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
