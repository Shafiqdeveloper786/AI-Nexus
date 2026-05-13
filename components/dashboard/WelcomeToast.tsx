"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, X, Zap } from "lucide-react";

interface WelcomeToastProps {
  name:    string;
  credits: number;
}

const SESSION_KEY = "ai-nexus:welcome-shown";

export default function WelcomeToast({ name, credits }: WelcomeToastProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    /* Show only once per browser session */
    if (typeof sessionStorage !== "undefined" && !sessionStorage.getItem(SESSION_KEY)) {
      const t = setTimeout(() => {
        setVisible(true);
        sessionStorage.setItem(SESSION_KEY, "1");
      }, 800); // slight delay so the dashboard finishes mounting first
      return () => clearTimeout(t);
    }
  }, []);

  /* Auto-dismiss after 6 seconds */
  useEffect(() => {
    if (!visible) return;
    const t = setTimeout(() => setVisible(false), 6_000);
    return () => clearTimeout(t);
  }, [visible]);

  const displayName = name?.split(" ")[0] || "there";

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: -80, scale: 0.9 }}
          animate={{ opacity: 1, y: 0,   scale: 1    }}
          exit={{   opacity: 0, y: -60,  scale: 0.95 }}
          transition={{ type: "spring", stiffness: 280, damping: 24 }}
          className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] w-full max-w-sm pointer-events-auto"
        >
          <div
            className="mx-4 rounded-2xl overflow-hidden"
            style={{
              background: "linear-gradient(135deg, rgba(8,22,46,0.98), rgba(3,11,26,0.99))",
              border:     "1px solid rgba(0,212,255,0.3)",
              boxShadow:  "0 20px 60px rgba(0,0,0,0.8), 0 0 40px rgba(0,212,255,0.12)",
              backdropFilter: "blur(24px)",
            }}
          >
            {/* Top accent line */}
            <div className="h-[2px] bg-gradient-to-r from-[#00d4ff] via-[#a855f7] to-[#00d4ff]" />

            <div className="flex items-center gap-3.5 px-4 py-3.5">
              {/* Animated icon */}
              <motion.div
                animate={{ rotate: [0, 15, -10, 8, 0] }}
                transition={{ duration: 0.7, delay: 0.5 }}
                className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{
                  background: "linear-gradient(135deg, rgba(0,212,255,0.2), rgba(168,85,247,0.2))",
                  border:     "1px solid rgba(0,212,255,0.3)",
                  boxShadow:  "0 0 20px rgba(0,212,255,0.2)",
                }}
              >
                <Sparkles className="w-5 h-5 text-[#00d4ff]" />
              </motion.div>

              {/* Text */}
              <div className="flex-1 min-w-0">
                <p className="font-['Orbitron'] text-xs font-bold text-white leading-tight">
                  Welcome back, {displayName}! 👋
                </p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <p className="text-[10px] text-[rgba(148,163,184,0.6)] font-['Rajdhani'] leading-tight">
                    Your AI Nexus workspace is ready.
                  </p>
                  <span className="flex items-center gap-0.5 text-[10px] font-['Orbitron'] font-bold text-[#00d4ff]">
                    <Zap className="w-2.5 h-2.5" />
                    {credits.toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Dismiss */}
              <button
                onClick={() => setVisible(false)}
                className="w-6 h-6 rounded-full flex items-center justify-center text-[rgba(148,163,184,0.35)] hover:text-white hover:bg-[rgba(255,255,255,0.08)] transition-all flex-shrink-0"
              >
                <X className="w-3 h-3" />
              </button>
            </div>

            {/* Auto-dismiss progress bar */}
            <motion.div
              initial={{ scaleX: 1 }}
              animate={{ scaleX: 0 }}
              transition={{ duration: 6, ease: "linear" }}
              className="h-[2px] origin-left"
              style={{ background: "linear-gradient(90deg, #00d4ff, #a855f7)" }}
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
