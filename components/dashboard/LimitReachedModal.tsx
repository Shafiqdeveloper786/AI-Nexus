"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Clock, X, Crown, ArrowRight, RefreshCw } from "lucide-react";
import PaymentModal from "./PaymentModal";

interface LimitReachedModalProps {
  isOpen:       boolean;
  onClose:      () => void;
  type:         "image" | "resume";
  resetInHours: number;
  used?:        number;
  limit?:       number;
}

export default function LimitReachedModal({
  isOpen, onClose, type, resetInHours, used, limit,
}: LimitReachedModalProps) {
  const [payOpen, setPayOpen] = useState(false);

  const label = type === "image" ? "image generations" : "resume builds";
  const icon  = type === "image" ? "🎨" : "📄";

  return (
    <>
      <PaymentModal isOpen={payOpen} onClose={() => setPayOpen(false)} />

      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
              onClick={onClose}
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.88, y: 28 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.88, y: 28 }}
              transition={{ type: "spring", stiffness: 300, damping: 26 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-[360px] rounded-3xl overflow-hidden"
              style={{
                background: "linear-gradient(160deg, rgba(8,22,46,0.99), rgba(3,11,26,0.99))",
                border:     "1px solid rgba(251,146,60,0.35)",
                boxShadow:  "0 32px 80px rgba(0,0,0,0.9), 0 0 60px rgba(251,146,60,0.08)",
              }}
            >
              <div className="h-[2px] bg-gradient-to-r from-transparent via-orange-400 to-transparent" />

              <button
                onClick={onClose}
                className="absolute top-3.5 right-3.5 w-7 h-7 rounded-full flex items-center justify-center text-[rgba(148,163,184,0.35)] hover:text-white hover:bg-[rgba(255,255,255,0.08)] transition-all z-10"
              >
                <X className="w-3.5 h-3.5" />
              </button>

              {/* Icon */}
              <div className="flex flex-col items-center pt-8 px-6 pb-4">
                <motion.div
                  animate={{ rotate: [0, -8, 8, -5, 5, 0] }}
                  transition={{ duration: 0.6, delay: 0.3 }}
                  className="text-5xl mb-4"
                >
                  {icon}
                </motion.div>

                <h2 className="font-['Orbitron'] text-sm font-black text-white tracking-wide mb-2 text-center">
                  Daily Limit Reached!
                </h2>

                <p className="text-sm text-[rgba(148,163,184,0.65)] font-['Rajdhani'] text-center leading-relaxed mb-3">
                  Your <span className="text-orange-400 font-bold">{limit ?? 3}</span> free {label} have been used.
                  They will reset in:
                </p>

                {/* Countdown pill */}
                <div
                  className="flex items-center gap-2.5 px-5 py-3 rounded-2xl mb-2"
                  style={{
                    background: "rgba(251,146,60,0.08)",
                    border:     "1px solid rgba(251,146,60,0.25)",
                  }}
                >
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                  >
                    <Clock className="w-5 h-5 text-orange-400" />
                  </motion.div>
                  <div>
                    <span className="font-['Orbitron'] text-xl font-black text-orange-400">
                      {resetInHours}h
                    </span>
                    <span className="text-[10px] text-[rgba(148,163,184,0.45)] font-['Rajdhani'] ml-1.5">
                      until reset
                    </span>
                  </div>
                </div>

                {used !== undefined && limit !== undefined && (
                  <div className="w-full mt-1">
                    <div className="flex justify-between mb-1">
                      <span className="text-[10px] font-['Rajdhani'] text-[rgba(148,163,184,0.45)]">Used today</span>
                      <span className="text-[10px] font-['Orbitron'] text-orange-400">{used} / {limit}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-[rgba(255,255,255,0.06)] overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width:      `${Math.min(100, (used / limit) * 100)}%`,
                          background: "linear-gradient(90deg, #f97316, #fb923c)",
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Upgrade pitch */}
              <div className="mx-4 mb-4 p-3.5 rounded-2xl"
                style={{
                  background: "linear-gradient(135deg, rgba(168,85,247,0.1), rgba(0,212,255,0.06))",
                  border:     "1px solid rgba(168,85,247,0.2)",
                }}>
                <div className="flex items-center gap-2 mb-1.5">
                  <Crown className="w-3.5 h-3.5 text-[#f0abfc]" />
                  <span className="font-['Orbitron'] text-xs font-bold text-white tracking-wide">PRO — Unlimited generations</span>
                </div>
                <p className="text-[11px] text-[rgba(148,163,184,0.55)] font-['Rajdhani']">
                  No daily limits. Priority model access. Full history.
                </p>
              </div>

              {/* Buttons */}
              <div className="px-4 pb-6 space-y-2">
                <motion.button
                  whileHover={{ y: -2, boxShadow: "0 0 28px rgba(168,85,247,0.45)" }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => { onClose(); setPayOpen(true); }}
                  className="w-full py-3 rounded-xl font-['Orbitron'] text-sm font-bold tracking-widest text-white flex items-center justify-center gap-2"
                  style={{ background: "linear-gradient(135deg, #7c3aed, #a855f7, #00d4ff)" }}
                >
                  <Crown className="w-4 h-4" /> Upgrade to Pro <ArrowRight className="w-4 h-4" />
                </motion.button>

                <button
                  onClick={onClose}
                  className="w-full py-2 rounded-xl text-xs font-['Rajdhani'] font-semibold flex items-center justify-center gap-1.5 transition-colors"
                  style={{ color: "rgba(148,163,184,0.45)" }}
                >
                  <RefreshCw className="w-3 h-3" /> Come back in {resetInHours}h
                </button>
              </div>

              <div className="h-[1px] bg-gradient-to-r from-transparent via-[rgba(251,146,60,0.2)] to-transparent" />
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
