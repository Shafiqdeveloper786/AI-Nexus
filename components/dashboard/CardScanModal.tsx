"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, CreditCard, CheckCircle, Scan } from "lucide-react";

interface CardScanModalProps {
  isOpen:  boolean;
  onClose: () => void;
  onScanned: (card: { number: string; expiry: string; name: string }) => void;
}

type ScanPhase = "align" | "scanning" | "processing" | "done";

export default function CardScanModal({ isOpen, onClose, onScanned }: CardScanModalProps) {
  const [phase, setPhase] = useState<ScanPhase>("align");

  /* Simulate the scan sequence */
  useEffect(() => {
    if (!isOpen) { setPhase("align"); return; }

    const t1 = setTimeout(() => setPhase("scanning"),    800);
    const t2 = setTimeout(() => setPhase("processing"), 3_200);
    const t3 = setTimeout(() => {
      setPhase("done");
      /* Simulate detected card data */
      onScanned({
        number: "4242 4242 4242 4242",
        expiry: "12/28",
        name:   "CARD HOLDER",
      });
    }, 4_800);

    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  const phaseLabel: Record<ScanPhase, string> = {
    align:      "Align your card within the frame",
    scanning:   "Scanning card…",
    processing: "Processing card data…",
    done:       "Card detected!",
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/90 backdrop-blur-lg"
            onClick={onClose}
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 20 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-[380px] rounded-3xl overflow-hidden"
            style={{
              background: "linear-gradient(160deg, rgba(6,15,30,0.98), rgba(3,9,20,0.99))",
              border:     "1px solid rgba(0,212,255,0.25)",
              boxShadow:  "0 32px 80px rgba(0,0,0,0.95), 0 0 60px rgba(0,212,255,0.08)",
            }}
          >
            <div className="h-[2px] bg-gradient-to-r from-transparent via-[#00d4ff] to-transparent" />

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4">
              <div className="flex items-center gap-2">
                <Scan className="w-4 h-4 text-[#00d4ff]" />
                <span className="font-['Orbitron'] text-xs font-bold text-white tracking-widest">
                  CARD SCANNER
                </span>
              </div>
              <button
                onClick={onClose}
                className="w-7 h-7 rounded-full flex items-center justify-center text-[rgba(148,163,184,0.35)] hover:text-white hover:bg-[rgba(255,255,255,0.08)] transition-all"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Camera viewfinder */}
            <div className="mx-5 mb-5">
              <div
                className="relative w-full aspect-[1.586/1] rounded-2xl overflow-hidden flex items-center justify-center"
                style={{
                  background: "rgba(0,5,12,0.95)",
                  border:     "1px solid rgba(0,212,255,0.2)",
                }}
              >
                {/* Corner brackets */}
                {["top-2 left-2", "top-2 right-2", "bottom-2 left-2", "bottom-2 right-2"].map((pos, i) => (
                  <div
                    key={i}
                    className={`absolute ${pos} w-7 h-7`}
                    style={{
                      borderTop:    i < 2 ? "2px solid #00d4ff" : "none",
                      borderBottom: i >= 2 ? "2px solid #00d4ff" : "none",
                      borderLeft:   i % 2 === 0 ? "2px solid #00d4ff" : "none",
                      borderRight:  i % 2 === 1 ? "2px solid #00d4ff" : "none",
                      borderRadius: i === 0 ? "8px 0 0 0" : i === 1 ? "0 8px 0 0" : i === 2 ? "0 0 0 8px" : "0 0 8px 0",
                      boxShadow:    "0 0 12px rgba(0,212,255,0.5)",
                    }}
                  />
                ))}

                {/* Card outline ghost */}
                <div
                  className="absolute inset-6 rounded-xl"
                  style={{ border: "1px dashed rgba(0,212,255,0.18)" }}
                />

                {/* Scanning laser beam */}
                {phase === "scanning" && (
                  <motion.div
                    className="absolute left-4 right-4 h-[2px] rounded-full"
                    style={{
                      background: "linear-gradient(90deg, transparent, rgba(0,212,255,0.9), rgba(0,212,255,1), rgba(0,212,255,0.9), transparent)",
                      boxShadow:  "0 0 12px rgba(0,212,255,0.8), 0 0 24px rgba(0,212,255,0.4)",
                    }}
                    animate={{ top: ["20%", "80%", "20%"] }}
                    transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                  />
                )}

                {/* Processing state */}
                {phase === "processing" && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="flex flex-col items-center gap-2">
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
                        className="w-8 h-8 border-2 border-[rgba(0,212,255,0.2)] border-t-[#00d4ff] rounded-full"
                      />
                      <span className="text-[10px] font-['Orbitron'] text-[#00d4ff] tracking-widest">
                        READING DATA
                      </span>
                    </div>
                  </div>
                )}

                {/* Done state */}
                {phase === "done" && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.7 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="absolute inset-0 flex flex-col items-center justify-center gap-2"
                    style={{ background: "rgba(0,255,136,0.06)" }}
                  >
                    <motion.div
                      initial={{ scale: 0, rotate: -45 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{ type: "spring", stiffness: 280, damping: 18 }}
                    >
                      <CheckCircle className="w-12 h-12 text-[#00ff88]" style={{ filter: "drop-shadow(0 0 16px rgba(0,255,136,0.8))" }} />
                    </motion.div>
                    <span className="font-['Orbitron'] text-xs font-bold text-[#00ff88] tracking-widest">
                      CARD DETECTED
                    </span>
                  </motion.div>
                )}

                {/* Card icon for align state */}
                {phase === "align" && (
                  <motion.div
                    animate={{ opacity: [0.3, 0.7, 0.3] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  >
                    <CreditCard className="w-14 h-14 text-[rgba(0,212,255,0.3)]" />
                  </motion.div>
                )}
              </div>

              {/* Status label */}
              <motion.p
                key={phase}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center mt-3 text-[11px] font-['Rajdhani'] font-semibold tracking-wider"
                style={{ color: phase === "done" ? "#00ff88" : "rgba(148,163,184,0.6)" }}
              >
                {phaseLabel[phase]}
              </motion.p>
            </div>

            <div className="h-[1px] bg-gradient-to-r from-transparent via-[rgba(0,212,255,0.1)] to-transparent" />
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
