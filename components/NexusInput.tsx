"use client";

import { useState } from "react";
import { motion } from "framer-motion";

interface NexusInputProps {
  label: string;
  id: string;
  type?: string;
  placeholder?: string;
  value: string;
  onChange: (val: string) => void;
  icon: React.ReactNode;
  required?: boolean;
  autoComplete?: string;
}

export default function NexusInput({
  label, id, type = "text", value, onChange,
  icon, required, autoComplete,
}: NexusInputProps) {
  const [focused, setFocused] = useState(false);
  const isFloated = focused || value.length > 0;

  return (
    <div className="relative mb-5">
      {/* Glow ring — only when focused */}
      <div
        className="absolute -inset-px rounded-xl pointer-events-none transition-opacity duration-200"
        style={{
          opacity: focused ? 1 : 0,
          background: "linear-gradient(135deg, rgba(0,212,255,0.25), rgba(168,85,247,0.15))",
          filter: "blur(4px)",
        }}
      />

      {/* Input container */}
      <div
        className="relative rounded-xl overflow-hidden transition-all duration-200"
        style={{
          background: "rgba(3,11,26,0.8)",
          border: `1px solid ${focused ? "rgba(0,212,255,0.45)" : isFloated ? "rgba(0,212,255,0.22)" : "rgba(0,212,255,0.1)"}`,
        }}
      >
        {/* Floating label — sits on the border when floated */}
        <motion.label
          htmlFor={id}
          animate={{
            y: isFloated ? -12 : 0,
            scale: isFloated ? 0.73 : 1,
            color: focused
              ? "#00d4ff"
              : isFloated
              ? "rgba(148,163,184,0.55)"
              : "rgba(148,163,184,0.38)",
          }}
          transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
          className="absolute left-9 top-[14px] origin-left font-['Rajdhani'] font-semibold text-sm tracking-wider pointer-events-none z-10"
          style={{
            background: isFloated ? "rgba(3,11,26,0.95)" : "transparent",
            paddingLeft: isFloated ? 4 : 0,
            paddingRight: isFloated ? 4 : 0,
            borderRadius: 2,
            whiteSpace: "nowrap",
          }}
        >
          {label}
        </motion.label>

        {/* Left icon */}
        <motion.div
          animate={{ color: focused ? "rgba(0,212,255,0.75)" : "rgba(148,163,184,0.32)" }}
          transition={{ duration: 0.18 }}
          className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
        >
          {icon}
        </motion.div>

        {/* Input */}
        <input
          id={id}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          autoComplete={autoComplete}
          placeholder=""
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          className="w-full pl-10 pr-4 pb-2.5 rounded-xl text-sm font-['Rajdhani'] font-medium text-[rgba(226,232,240,0.92)] outline-none bg-transparent"
          style={{ paddingTop: "22px" }}
        />

        {/* Neon bottom scan line when focused */}
        <motion.div
          animate={{ scaleX: focused ? 1 : 0, opacity: focused ? 1 : 0 }}
          transition={{ duration: 0.25 }}
          className="absolute bottom-0 left-4 right-4 h-[1px] origin-left"
          style={{
            background: "linear-gradient(90deg, #00d4ff, #a855f7)",
            borderRadius: "0 0 1px 1px",
          }}
        />
      </div>
    </div>
  );
}
