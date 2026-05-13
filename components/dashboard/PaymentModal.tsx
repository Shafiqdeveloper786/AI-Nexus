"use client";

import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, CreditCard, Lock, CheckCircle, Sparkles, Shield } from "lucide-react";

function formatCardNumber(val: string) {
  return val.replace(/\D/g, "").slice(0, 16).replace(/(.{4})/g, "$1 ").trim();
}
function formatExpiry(val: string) {
  const digits = val.replace(/\D/g, "").slice(0, 4);
  if (digits.length >= 3) return digits.slice(0, 2) + "/" + digits.slice(2);
  return digits;
}

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  plan?: { name: string; price: string };
}

export default function PaymentModal({
  isOpen, onClose, plan = { name: "PRO PLAN", price: "$29" },
}: PaymentModalProps) {
  const [cardNumber, setCardNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvv, setCvv] = useState("");
  const [name, setName] = useState("");
  const [focused, setFocused] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handlePay = () => {
    setLoading(true);
    setTimeout(() => { setLoading(false); setSuccess(true); }, 1800);
  };

  const isComplete = cardNumber.replace(/\s/g, "").length === 16
    && expiry.length === 5 && cvv.length >= 3 && name.trim().length > 1;

  /* ── Detect card brand from number ─────────────────── */
  const cardBrand = (() => {
    const n = cardNumber.replace(/\s/g, "");
    if (n.startsWith("4")) return "VISA";
    if (n.startsWith("5")) return "MASTERCARD";
    if (n.startsWith("3")) return "AMEX";
    return "CARD";
  })();

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/80 backdrop-blur-lg"
            onClick={onClose}
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.93, y: 28 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.93, y: 28 }}
            transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-md rounded-2xl overflow-hidden"
            style={{
              background: "linear-gradient(160deg, rgba(8,22,46,0.98), rgba(3,11,26,0.99))",
              border: "1px solid rgba(168,85,247,0.22)",
              boxShadow: "0 32px 80px rgba(0,0,0,0.85), 0 0 80px rgba(168,85,247,0.07)",
            }}
          >
            <div className="h-[1px] bg-gradient-to-r from-transparent via-[rgba(168,85,247,0.55)] to-transparent" />

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-[rgba(255,255,255,0.05)]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                  style={{ background: "linear-gradient(135deg, rgba(168,85,247,0.2), rgba(0,212,255,0.15))", border: "1px solid rgba(168,85,247,0.3)" }}>
                  <CreditCard className="w-4 h-4 text-[#a855f7]" />
                </div>
                <div>
                  <p className="font-['Orbitron'] text-xs font-bold text-white tracking-wider">SECURE PAYMENT</p>
                  <p className="text-[10px] text-[rgba(148,163,184,0.4)] font-['Rajdhani']">256-bit SSL encrypted</p>
                </div>
              </div>
              <motion.button whileHover={{ rotate: 90 }} transition={{ duration: 0.2 }}
                onClick={onClose}
                className="w-8 h-8 rounded-xl flex items-center justify-center text-[rgba(148,163,184,0.4)] hover:text-white hover:bg-[rgba(255,255,255,0.08)] transition-all">
                <X className="w-4 h-4" />
              </motion.button>
            </div>

            <div className="px-5 py-5">
              <AnimatePresence mode="wait">
                {success ? (
                  <motion.div
                    key="success"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex flex-col items-center justify-center py-8 text-center"
                  >
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", stiffness: 300, delay: 0.1 }}
                      className="w-16 h-16 rounded-full flex items-center justify-center mb-4"
                      style={{ background: "rgba(0,255,136,0.12)", border: "2px solid rgba(0,255,136,0.4)", boxShadow: "0 0 32px rgba(0,255,136,0.2)" }}
                    >
                      <CheckCircle className="w-8 h-8 text-[#00ff88]" />
                    </motion.div>
                    <p className="font-['Orbitron'] text-base font-bold text-white mb-1">Payment Successful!</p>
                    <p className="text-sm text-[rgba(148,163,184,0.6)] font-['Rajdhani']">Welcome to {plan.name}. Your AI toolkit is now unlocked.</p>
                    <motion.button
                      whileHover={{ y: -2 }} whileTap={{ scale: 0.97 }}
                      onClick={onClose}
                      className="mt-6 px-8 py-2.5 rounded-xl font-['Orbitron'] text-xs font-bold tracking-widest text-white"
                      style={{ background: "linear-gradient(135deg, #00ff88, #00d4ff)" }}
                    >
                      GET STARTED
                    </motion.button>
                  </motion.div>
                ) : (
                  <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    {/* Plan summary */}
                    <div className="flex items-center justify-between mb-5 px-4 py-3 rounded-xl"
                      style={{ background: "linear-gradient(135deg, rgba(168,85,247,0.1), rgba(0,212,255,0.06))", border: "1px solid rgba(168,85,247,0.2)" }}>
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-[#a855f7]" />
                        <span className="font-['Orbitron'] text-xs font-bold text-white">{plan.name}</span>
                      </div>
                      <span className="font-['Orbitron'] text-lg font-black text-white">{plan.price}<span className="text-xs font-normal text-[rgba(148,163,184,0.4)]">/mo</span></span>
                    </div>

                    {/* Animated card preview */}
                    <div className="relative h-36 rounded-2xl mb-5 overflow-hidden select-none"
                      style={{
                        background: "linear-gradient(135deg, #0f2a4a 0%, #1a0a3d 50%, #0a1a3d 100%)",
                        border: "1px solid rgba(168,85,247,0.25)",
                        boxShadow: "0 8px 32px rgba(0,0,0,0.5), 0 0 40px rgba(168,85,247,0.08)",
                      }}>
                      {/* Holographic overlay */}
                      <div className="absolute inset-0 opacity-20"
                        style={{ background: "linear-gradient(135deg, rgba(0,212,255,0.3) 0%, transparent 40%, rgba(168,85,247,0.3) 100%)" }} />
                      {/* Circuit lines */}
                      <div className="absolute top-3 left-3 w-8 h-8 rounded border border-[rgba(0,212,255,0.3)]" />
                      <div className="absolute top-4 left-4 w-4 h-4 rounded-sm border border-[rgba(0,212,255,0.2)]" />

                      <div className="absolute top-4 right-4 text-right">
                        <p className="font-['Orbitron'] text-[10px] text-[rgba(255,255,255,0.4)] tracking-widest">AI NEXUS</p>
                        <p className="font-['Orbitron'] text-xs font-bold text-[rgba(168,85,247,0.8)] mt-0.5">{cardBrand}</p>
                      </div>

                      <div className="absolute bottom-3 left-4 right-4">
                        <p className="font-mono text-sm font-bold tracking-[0.25em] text-white/80 mb-1.5">
                          {cardNumber || "•••• •••• •••• ••••"}
                        </p>
                        <div className="flex justify-between items-end">
                          <div>
                            <p className="text-[8px] text-[rgba(255,255,255,0.3)] tracking-wider mb-0.5">CARD HOLDER</p>
                            <p className="text-xs font-['Rajdhani'] font-bold text-white/70 uppercase tracking-wider truncate max-w-[140px]">{name || "YOUR NAME"}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-[8px] text-[rgba(255,255,255,0.3)] tracking-wider mb-0.5">EXPIRES</p>
                            <p className="text-xs font-mono text-white/70">{expiry || "MM/YY"}</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Form fields */}
                    <div className="space-y-3">
                      {/* Card number */}
                      <div>
                        <label className="block text-[9px] font-['Orbitron'] tracking-widest text-[rgba(148,163,184,0.45)] mb-1.5 uppercase">Card Number</label>
                        <div className="relative">
                          <CreditCard className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[rgba(0,212,255,0.4)]" />
                          <input
                            value={cardNumber}
                            onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
                            onFocus={() => setFocused("card")} onBlur={() => setFocused(null)}
                            placeholder="1234 5678 9012 3456"
                            className="w-full pl-10 pr-4 py-3 rounded-xl text-sm font-mono text-[rgba(226,232,240,0.9)] placeholder:text-[rgba(148,163,184,0.25)] outline-none transition-all duration-200"
                            style={{
                              background: "rgba(3,11,26,0.8)",
                              border: `1px solid ${focused === "card" ? "rgba(0,212,255,0.4)" : "rgba(0,212,255,0.1)"}`,
                              boxShadow: focused === "card" ? "0 0 0 3px rgba(0,212,255,0.08)" : "none",
                            }}
                          />
                        </div>
                      </div>

                      {/* Expiry + CVV */}
                      <div className="grid grid-cols-2 gap-3">
                        {[
                          { id: "exp", label: "Expiry (MM/YY)", val: expiry, set: (v: string) => setExpiry(formatExpiry(v)), ph: "MM/YY", mono: true },
                          { id: "cvv", label: "CVV", val: cvv, set: (v: string) => setCvv(v.replace(/\D/g, "").slice(0, 4)), ph: "•••", mono: true },
                        ].map(({ id, label, val, set, ph, mono }) => (
                          <div key={id}>
                            <label className="block text-[9px] font-['Orbitron'] tracking-widest text-[rgba(148,163,184,0.45)] mb-1.5 uppercase">{label}</label>
                            <input
                              value={val} onChange={(e) => set(e.target.value)}
                              onFocus={() => setFocused(id)} onBlur={() => setFocused(null)}
                              placeholder={ph}
                              className={`w-full px-4 py-3 rounded-xl text-sm text-[rgba(226,232,240,0.9)] placeholder:text-[rgba(148,163,184,0.25)] outline-none transition-all duration-200 ${mono ? "font-mono" : ""}`}
                              style={{
                                background: "rgba(3,11,26,0.8)",
                                border: `1px solid ${focused === id ? "rgba(0,212,255,0.4)" : "rgba(0,212,255,0.1)"}`,
                                boxShadow: focused === id ? "0 0 0 3px rgba(0,212,255,0.08)" : "none",
                              }}
                            />
                          </div>
                        ))}
                      </div>

                      {/* Name on card */}
                      <div>
                        <label className="block text-[9px] font-['Orbitron'] tracking-widest text-[rgba(148,163,184,0.45)] mb-1.5 uppercase">Name on Card</label>
                        <input
                          value={name} onChange={(e) => setName(e.target.value)}
                          onFocus={() => setFocused("name")} onBlur={() => setFocused(null)}
                          placeholder="Shafiq Chohan"
                          className="w-full px-4 py-3 rounded-xl text-sm font-['Rajdhani'] font-semibold text-[rgba(226,232,240,0.9)] placeholder:text-[rgba(148,163,184,0.25)] outline-none transition-all duration-200 uppercase"
                          style={{
                            background: "rgba(3,11,26,0.8)",
                            border: `1px solid ${focused === "name" ? "rgba(0,212,255,0.4)" : "rgba(0,212,255,0.1)"}`,
                            boxShadow: focused === "name" ? "0 0 0 3px rgba(0,212,255,0.08)" : "none",
                          }}
                        />
                      </div>
                    </div>

                    {/* Security notice */}
                    <div className="flex items-center gap-2 mt-4 mb-5 px-3 py-2 rounded-lg"
                      style={{ background: "rgba(0,255,136,0.04)", border: "1px solid rgba(0,255,136,0.1)" }}>
                      <Shield className="w-3.5 h-3.5 text-[rgba(0,255,136,0.55)] flex-shrink-0" />
                      <p className="text-[10px] font-['Rajdhani'] text-[rgba(0,255,136,0.5)]">
                        Your card data never touches our servers — processed by Stripe.
                      </p>
                    </div>

                    {/* Pay button */}
                    <motion.button
                      onClick={handlePay}
                      disabled={!isComplete || loading}
                      whileHover={isComplete && !loading ? {
                        y: -2,
                        boxShadow: "0 0 40px rgba(168,85,247,0.5), 0 0 80px rgba(168,85,247,0.2)",
                      } : {}}
                      whileTap={isComplete && !loading ? { scale: 0.97 } : {}}
                      transition={{ duration: 0.2 }}
                      className="w-full py-4 rounded-xl font-['Orbitron'] text-sm font-bold tracking-widest text-white flex items-center justify-center gap-2.5 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                      style={{ background: "linear-gradient(135deg, #7c3aed 0%, #a855f7 50%, #00d4ff 100%)" }}
                    >
                      {loading ? (
                        <>
                          <motion.span
                            animate={{ rotate: 360 }}
                            transition={{ duration: 0.9, repeat: Infinity, ease: "linear" }}
                            className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full"
                          />
                          PROCESSING...
                        </>
                      ) : (
                        <>
                          <Lock className="w-4 h-4" />
                          PAY {plan.price} NOW
                        </>
                      )}
                    </motion.button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="h-[1px] bg-gradient-to-r from-transparent via-[rgba(0,212,255,0.2)] to-transparent" />
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
