"use client";

import { motion } from "framer-motion";

export default function AuthBackground() {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
      {/* Base */}
      <div className="absolute inset-0 bg-[#030b1a]" />

      {/* Grid */}
      <div
        className="absolute inset-0 opacity-50"
        style={{
          backgroundImage:
            "linear-gradient(rgba(0,212,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(0,212,255,0.04) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />

      {/* Animated cyan orb — top-left */}
      <motion.div
        animate={{ x: [-60, 60, -60], y: [-40, 40, -40], scale: [1, 1.15, 1] }}
        transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
        className="absolute -top-32 -left-32 w-[600px] h-[600px] rounded-full bg-[#00d4ff] opacity-[0.05] blur-[110px]"
      />

      {/* Animated purple orb — top-right */}
      <motion.div
        animate={{ x: [50, -50, 50], y: [30, -30, 30], scale: [1.1, 1, 1.1] }}
        transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
        className="absolute -top-20 -right-20 w-[500px] h-[500px] rounded-full bg-[#a855f7] opacity-[0.06] blur-[100px]"
      />

      {/* Animated cyan orb — bottom-center */}
      <motion.div
        animate={{ x: [-40, 40, -40], y: [40, -40, 40] }}
        transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
        className="absolute -bottom-40 left-1/2 -translate-x-1/2 w-[700px] h-[350px] rounded-full bg-[#00d4ff] opacity-[0.03] blur-[120px]"
      />

      {/* Slow-rotating mesh overlay */}
      <motion.div
        animate={{ rotate: [0, 360] }}
        transition={{ duration: 60, repeat: Infinity, ease: "linear" }}
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[900px] opacity-[0.015]"
        style={{
          background:
            "conic-gradient(from 0deg, #00d4ff, #a855f7, #00ff88, #00d4ff)",
          borderRadius: "40%",
          filter: "blur(80px)",
        }}
      />

      {/* Horizontal scan lines */}
      <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[rgba(0,212,255,0.3)] to-transparent" />
      <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[rgba(0,212,255,0.2)] to-transparent" />

      {/* Corner marks */}
      <div className="absolute top-5 left-5 w-10 h-10 border-l-[1.5px] border-t-[1.5px] border-[rgba(0,212,255,0.25)] rounded-tl" />
      <div className="absolute top-5 right-5 w-10 h-10 border-r-[1.5px] border-t-[1.5px] border-[rgba(0,212,255,0.25)] rounded-tr" />
      <div className="absolute bottom-5 left-5 w-10 h-10 border-l-[1.5px] border-b-[1.5px] border-[rgba(0,212,255,0.25)] rounded-bl" />
      <div className="absolute bottom-5 right-5 w-10 h-10 border-r-[1.5px] border-b-[1.5px] border-[rgba(0,212,255,0.25)] rounded-br" />

      {/* Sparkle */}
      <motion.div
        animate={{ opacity: [0.2, 0.6, 0.2] }}
        transition={{ duration: 3, repeat: Infinity }}
        className="absolute bottom-10 right-10 text-[rgba(0,212,255,0.35)] text-2xl select-none"
      >
        ✦
      </motion.div>
      <motion.div
        animate={{ opacity: [0.15, 0.5, 0.15] }}
        transition={{ duration: 4, repeat: Infinity, delay: 1.5 }}
        className="absolute top-16 right-24 text-[rgba(168,85,247,0.3)] text-lg select-none"
      >
        ✦
      </motion.div>
    </div>
  );
}
