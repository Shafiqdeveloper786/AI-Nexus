"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Zap, Crown, X, ArrowRight, Check } from "lucide-react";

interface NoCreditsModalProps {
  isOpen:       boolean;
  onClose:      () => void;
  required?:    number;
  current?:     number;
  /** Opens the Subscription tab in the Profile modal */
  onUpgrade?:   () => void;
}

const PRO_FEATURES = [
  "Unlimited AI Chat, Code & SQL generation",
  "100 Image generations per month",
  "Unlimited Resume Builder",
  "Priority model access (GPT-4 level)",
  "Full chat history & Markdown export",
];

export default function NoCreditsModal({
  isOpen, onClose, required, current, onUpgrade,
}: NoCreditsModalProps) {
  return (
    <>

      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
              onClick={onClose}
            />

            {/* Card */}
            <motion.div
              initial={{ opacity: 0, scale: 0.88, y: 32 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.88, y: 32 }}
              transition={{ type: "spring", stiffness: 300, damping: 26 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-[380px] rounded-3xl overflow-hidden"
              style={{
                background: "linear-gradient(160deg, rgba(8,22,46,0.99) 0%, rgba(3,11,26,0.99) 100%)",
                border:     "1px solid rgba(239,68,68,0.35)",
                boxShadow:  "0 32px 80px rgba(0,0,0,0.9), 0 0 80px rgba(239,68,68,0.08)",
              }}
            >
              {/* Top accent */}
              <div className="h-[2px] bg-gradient-to-r from-transparent via-red-500 to-transparent" />

              {/* Dismiss */}
              <button
                onClick={onClose}
                className="absolute top-3.5 right-3.5 w-7 h-7 rounded-full flex items-center justify-center text-[rgba(148,163,184,0.35)] hover:text-white hover:bg-[rgba(255,255,255,0.08)] transition-all z-10"
              >
                <X className="w-3.5 h-3.5" />
              </button>

              {/* Icon + heading */}
              <div className="flex flex-col items-center pt-8 px-6 pb-3">
                <motion.div
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
                  className="w-[72px] h-[72px] rounded-2xl flex items-center justify-center mb-4"
                  style={{
                    background: "linear-gradient(135deg, rgba(239,68,68,0.15), rgba(251,146,60,0.1))",
                    border:     "1px solid rgba(239,68,68,0.35)",
                    boxShadow:  "0 0 48px rgba(239,68,68,0.15)",
                  }}
                >
                  <Zap className="w-8 h-8 text-red-400" />
                </motion.div>

                <h2 className="font-['Orbitron'] text-sm font-black text-white tracking-wide mb-2 text-center">
                  ⚠️ Credits Exhausted!
                </h2>

                <p className="text-sm text-[rgba(148,163,184,0.65)] font-['Rajdhani'] text-center leading-relaxed">
                  You have used all your free credits. Upgrade to the{" "}
                  <span className="text-[#a855f7] font-bold">Pro Plan</span> for unlimited access
                  to all AI Nexus tools.
                </p>

                {/* Credit pill */}
                {required !== undefined && (
                  <div
                    className="flex items-center gap-2 mt-3 px-3.5 py-2 rounded-xl"
                    style={{
                      background: "rgba(239,68,68,0.07)",
                      border:     "1px solid rgba(239,68,68,0.2)",
                    }}
                  >
                    <Zap className="w-3 h-3 text-red-400 flex-shrink-0" />
                    <span className="text-xs font-['Rajdhani'] text-[rgba(226,232,240,0.7)]">
                      Needs{" "}
                      <span className="text-red-400 font-bold">{required} credits</span>
                      {current !== undefined && (
                        <>
                          {" "}· You have{" "}
                          <span className="text-red-400 font-bold">{current}</span>
                        </>
                      )}
                    </span>
                  </div>
                )}
              </div>

              {/* Pro plan card */}
              <div
                className="mx-4 mb-4 p-4 rounded-2xl"
                style={{
                  background: "linear-gradient(135deg, rgba(168,85,247,0.1), rgba(0,212,255,0.07))",
                  border:     "1px solid rgba(168,85,247,0.22)",
                }}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Crown className="w-4 h-4 text-[#f0abfc]" />
                    <span className="font-['Orbitron'] text-xs font-bold text-white tracking-wide">
                      PRO PLAN
                    </span>
                  </div>
                  <div
                    className="px-2.5 py-0.5 rounded-full text-[10px] font-['Orbitron'] font-bold"
                    style={{
                      color:      "#a855f7",
                      background: "rgba(168,85,247,0.12)",
                      border:     "1px solid rgba(168,85,247,0.25)",
                    }}
                  >
                    $29/mo
                  </div>
                </div>

                <div className="space-y-1.5">
                  {PRO_FEATURES.map((f) => (
                    <div key={f} className="flex items-center gap-2">
                      <div
                        className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0"
                        style={{
                          background: "rgba(0,255,136,0.12)",
                          border:     "1px solid rgba(0,255,136,0.25)",
                        }}
                      >
                        <Check className="w-2.5 h-2.5 text-[#00ff88]" />
                      </div>
                      <span className="text-[11px] text-[rgba(226,232,240,0.65)] font-['Rajdhani']">
                        {f}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* CTA buttons */}
              <div className="px-4 pb-6 space-y-2">
                <motion.button
                  whileHover={{ y: -2, boxShadow: "0 0 32px rgba(168,85,247,0.55)" }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => { onClose(); onUpgrade?.(); }}
                  className="w-full py-3.5 rounded-xl font-['Orbitron'] text-sm font-bold tracking-widest text-white flex items-center justify-center gap-2"
                  style={{
                    background: "linear-gradient(135deg, #7c3aed 0%, #a855f7 55%, #00d4ff 100%)",
                  }}
                >
                  <Crown className="w-4 h-4" />
                  Upgrade to Pro
                  <ArrowRight className="w-4 h-4" />
                </motion.button>

                <button
                  onClick={onClose}
                  className="w-full py-2.5 rounded-xl text-xs font-['Rajdhani'] font-semibold transition-colors"
                  style={{ color: "rgba(148,163,184,0.45)" }}
                  onMouseEnter={(e) => { (e.currentTarget.style.color = "rgba(148,163,184,0.75)"); }}
                  onMouseLeave={(e) => { (e.currentTarget.style.color = "rgba(148,163,184,0.45)"); }}
                >
                  Not now — I'll upgrade later
                </button>
              </div>

              <div className="h-[1px] bg-gradient-to-r from-transparent via-[rgba(168,85,247,0.2)] to-transparent" />
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
