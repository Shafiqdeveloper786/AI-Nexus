"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Wand2, Download, AlertTriangle, ImageIcon, Sparkles,
  RefreshCw, ThumbsUp, ThumbsDown, ChevronDown, Paperclip, X,
} from "lucide-react";
import { pushNotif } from "@/lib/notifications";
import NoCreditsModal from "./NoCreditsModal";
import { useUserProfile } from "@/hooks/useUserProfile";
import { CREDITS } from "@/lib/credits";

/* ── Models ──────────────────────────────────────────────────────────────── */
const MODELS = [
  { id: "flux",     label: "FLUX Schnell",         sub: "Fast · 4-step",    color: "#a855f7" },
  { id: "flux_dev", label: "FLUX Dev",              sub: "High Quality",     color: "#00d4ff" },
  { id: "sd2",      label: "Stable Diffusion 2.1",  sub: "Classic",          color: "#00ff88" },
];

const EXAMPLE_PROMPTS = [
  "Cyberpunk city at night, neon rain, cinematic 8K",
  "Futuristic AI robot, glowing blue eyes, studio light",
  "Abstract digital art, purple cyan gradients, 4K",
  "Deep space nebula, photorealistic, NASA style",
];

/* ── Reference image helper ──────────────────────────────────────────────── */
interface RefImage { name: string; dataUrl: string; }

export default function ImageStudio({ onOpenSubscription }: { onOpenSubscription?: () => void }) {
  const [prompt,         setPrompt]         = useState("");
  const [selectedModel,  setSelectedModel]  = useState("flux");
  const [modelOpen,      setModelOpen]      = useState(false);
  const [loading,        setLoading]        = useState(false);
  const [imageUrl,       setImageUrl]       = useState<string | null>(null);
  const [error,          setError]          = useState<string | null>(null);
  const [refImage,       setRefImage]       = useState<RefImage | null>(null);
  const [noCreditsOpen,  setNoCreditsOpen]  = useState(false);
  const [toast,          setToast]          = useState<string | null>(null);
  const [mounted,        setMounted]        = useState(false);
  const [modelBtnRect,   setModelBtnRect]   = useState<DOMRect | null>(null);

  const modelBtnRef  = useRef<HTMLButtonElement>(null);
  const refInputRef  = useRef<HTMLInputElement>(null);

  const { profile, refetch: refetchProfile, decrementCredits } = useUserProfile();

  useEffect(() => { setMounted(true); }, []);

  const showToast = (text: string) => { setToast(text); setTimeout(() => setToast(null), 3500); };

  /* Model dropdown positioning */
  const openModelMenu = () => {
    if (modelBtnRef.current) setModelBtnRect(modelBtnRef.current.getBoundingClientRect());
    setModelOpen(true);
  };

  /* Reference image */
  const handleRefImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setRefImage({ name: file.name, dataUrl: ev.target?.result as string });
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const activeModel = MODELS.find((m) => m.id === selectedModel) ?? MODELS[0];

  const handleGenerate = useCallback(async () => {
    const trimmed = prompt.trim();
    if (!trimmed || loading) return;

    /* Daily limit pre-check */
    if (profile?.subscription === "free" && (profile.dailyImageCount ?? 0) >= CREDITS.DAILY_IMAGE_LIMIT) {
      pushNotif({ title: "Daily Limit Reached", sub: `${CREDITS.DAILY_IMAGE_LIMIT} free images/day. Upgrade for unlimited.`, type: "warning" });
      onOpenSubscription?.();
      return;
    }

    /* Zero-credit redirect */
    if (profile && profile.credits <= 0 && profile.subscription === "free") {
      pushNotif({ title: "No Credits Left", sub: "Upgrade to Pro for unlimited generations.", type: "error" });
      onOpenSubscription?.();
      return;
    }

    /* Not enough credits for this action */
    if (profile && profile.credits < CREDITS.IMAGE && profile.subscription === "free") {
      setNoCreditsOpen(true);
      pushNotif({ title: "Credits Exhausted", sub: `Image generation costs ${CREDITS.IMAGE} credits.`, type: "error" });
      return;
    }

    decrementCredits(CREDITS.IMAGE);
    setLoading(true);
    setError(null);
    setImageUrl(null);

    /* If a reference image is attached, append a style note to the prompt */
    const finalPrompt = refImage
      ? `${trimmed}, inspired by reference style of '${refImage.name}'`
      : trimmed;

    try {
      const res = await fetch("/api/generate-image", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ prompt: finalPrompt, model: selectedModel }),
      });

      const data = await res.json();

      if (res.status === 403) {
        pushNotif({ title: "Credits Exhausted", sub: "Upgrade for unlimited access.", type: "error" });
        onOpenSubscription?.();
        return;
      }
      if (res.status === 429) {
        pushNotif({ title: "Daily Limit Reached", sub: `${CREDITS.DAILY_IMAGE_LIMIT}/day. Resets in ${data.resetInHours ?? 24}h.`, type: "warning" });
        onOpenSubscription?.();
        return;
      }
      if (res.status === 503) {
        setError(data.message ?? "High Traffic Alert: All AI providers are currently unavailable. Please try again in a few minutes.");
        return;
      }
      if (!res.ok) { setError(data.message ?? data.error ?? `Error ${res.status}`); return; }

      setImageUrl(data.imageUrl);
      await refetchProfile();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error — please try again.");
    } finally {
      setLoading(false);
    }
  }, [prompt, loading, profile, selectedModel, refImage, decrementCredits, refetchProfile, onOpenSubscription]);

  const handleDownload = () => {
    if (!imageUrl) return;
    const a = document.createElement("a");
    a.href = imageUrl;
    a.download = `ai-nexus-${Date.now()}.png`;
    a.click();
  };

  /* ─────────────────────────────────────────────────────────────── */
  return (
    <>
      <NoCreditsModal isOpen={noCreditsOpen} onClose={() => setNoCreditsOpen(false)}
        required={CREDITS.IMAGE} current={profile?.credits} onUpgrade={onOpenSubscription} />

      {/* Hidden reference image input */}
      <input ref={refInputRef} type="file" accept="image/*" className="hidden" onChange={handleRefImageChange} />

      {/* ── Model dropdown portal ───────────────────────────────── */}
      {mounted && modelOpen && modelBtnRect && createPortal(
        <>
          <div className="fixed inset-0 z-[998]" onClick={() => setModelOpen(false)} />
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.14 }}
            className="fixed z-[999] rounded-2xl overflow-hidden py-1 min-w-[220px]"
            style={{
              top:       modelBtnRect.bottom + 6,
              left:      modelBtnRect.left,
              background: "rgba(4,13,32,0.98)",
              border:     "1px solid rgba(168,85,247,0.25)",
              boxShadow:  "0 12px 40px rgba(0,0,0,0.7), 0 0 0 1px rgba(168,85,247,0.1)",
            }}
          >
            {MODELS.map((m) => {
              const active = m.id === selectedModel;
              return (
                <button key={m.id} onClick={() => { setSelectedModel(m.id); setModelOpen(false); }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-[rgba(168,85,247,0.08)]"
                >
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: active ? m.color : "rgba(255,255,255,0.1)", boxShadow: active ? `0 0 6px ${m.color}` : "none" }} />
                  <div>
                    <p className="text-xs font-['Rajdhani'] font-bold" style={{ color: active ? m.color : "rgba(226,232,240,0.85)" }}>{m.label}</p>
                    <p className="text-[10px] font-['Rajdhani']" style={{ color: "rgba(148,163,184,0.45)" }}>{m.sub}</p>
                  </div>
                </button>
              );
            })}
          </motion.div>
        </>,
        document.body
      )}

      {/* Toast portal */}
      {mounted && createPortal(
        <AnimatePresence>
          {toast && (
            <motion.div key="img-toast"
              initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 24 }} transition={{ duration: 0.22 }}
              className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[999] flex items-center gap-2.5 px-5 py-3 rounded-2xl pointer-events-none"
              style={{ background: "rgba(6,18,36,0.97)", border: "1px solid rgba(168,85,247,0.25)", boxShadow: "0 8px 40px rgba(0,0,0,0.7)" }}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-[#a855f7]" style={{ boxShadow: "0 0 6px rgba(168,85,247,0.8)" }} />
              <span className="text-sm font-['Rajdhani'] font-semibold text-[rgba(226,232,240,0.9)] whitespace-nowrap">{toast}</span>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}

      {/* ── Main layout ────────────────────────────────────────── */}
      <div className="flex flex-col flex-1 min-h-0 overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 flex-shrink-0"
          style={{ borderBottom: "1px solid rgba(168,85,247,0.08)" }}>
          <div>
            <h2 className="font-['Orbitron'] text-sm font-bold text-white tracking-wide">Image Studio</h2>
            <p className="text-[10px] font-['Rajdhani'] tracking-widest mt-0.5" style={{ color: activeModel.color }}>
              {activeModel.label} · {CREDITS.DAILY_IMAGE_LIMIT} images / day
            </p>
          </div>
          <div className="flex items-center gap-2">
            {profile && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full"
                style={{ border: "1px solid rgba(168,85,247,0.2)", background: "rgba(168,85,247,0.05)" }}>
                <Sparkles className="w-3 h-3 text-[#a855f7]" />
                <span className="text-[10px] font-['Orbitron'] font-bold text-[#a855f7]">{profile.credits.toLocaleString()}</span>
              </div>
            )}
          </div>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-4 py-5 space-y-4">

          {/* ── Prompt card ──────────────────────────────────── */}
          <div className="rounded-2xl overflow-hidden"
            style={{
              background:  "linear-gradient(135deg, rgba(6,18,40,0.9) 0%, rgba(3,11,26,0.95) 100%)",
              border:      "1px solid rgba(168,85,247,0.2)",
              boxShadow:   "0 4px 24px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.04)",
            }}>

            {/* Model selector strip */}
            <div className="flex items-center gap-2 px-4 pt-3 pb-2"
              style={{ borderBottom: "1px solid rgba(168,85,247,0.1)" }}>
              <span className="text-[9px] font-['Orbitron'] tracking-widest text-[rgba(148,163,184,0.4)] uppercase">Model</span>
              <button ref={modelBtnRef} onClick={openModelMenu}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition-colors hover:bg-[rgba(168,85,247,0.1)]"
                style={{ border: `1px solid ${activeModel.color}30`, background: `${activeModel.color}08` }}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: activeModel.color, boxShadow: `0 0 5px ${activeModel.color}` }} />
                <span className="text-[11px] font-['Rajdhani'] font-bold" style={{ color: activeModel.color }}>{activeModel.label}</span>
                <ChevronDown className="w-3 h-3" style={{ color: activeModel.color }} />
              </button>
            </div>

            {/* Prompt textarea */}
            <div className="px-4 py-3">
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleGenerate(); }}
                rows={4}
                placeholder="Describe your vision… (⌘↵ to generate)"
                className="w-full bg-transparent resize-none outline-none font-['Rajdhani'] text-sm leading-relaxed"
                style={{ color: "rgba(226,232,240,0.9)", caretColor: "#a855f7" }}
              />
            </div>

            {/* Reference image chip + action row */}
            <div className="flex items-center justify-between px-4 pb-3 gap-3">
              {/* Left: ref image button / chip */}
              <div className="flex items-center gap-2 min-w-0">
                {refImage ? (
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg max-w-[160px]"
                    style={{ background: "rgba(0,212,255,0.07)", border: "1px solid rgba(0,212,255,0.2)" }}>
                    <ImageIcon className="w-3 h-3 text-[#00d4ff] flex-shrink-0" />
                    <span className="text-[10px] font-['Rajdhani'] text-[#00d4ff] truncate">{refImage.name}</span>
                    <button onClick={() => setRefImage(null)} className="flex-shrink-0 text-[rgba(148,163,184,0.4)] hover:text-red-400">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <button onClick={() => refInputRef.current?.click()}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-['Rajdhani'] font-semibold transition-all hover:border-[rgba(0,212,255,0.3)] hover:text-[#00d4ff]"
                    style={{ color: "rgba(148,163,184,0.4)", border: "1px solid rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.02)" }}>
                    <Paperclip className="w-3 h-3" />
                    Reference image
                  </button>
                )}
              </div>

              {/* Right: char count hint */}
              <span className="text-[9px] font-['Rajdhani'] text-[rgba(148,163,184,0.3)] flex-shrink-0">
                {prompt.length} chars
              </span>
            </div>
          </div>

          {/* ── Example prompts ──────────────────────────────── */}
          <div className="flex flex-wrap gap-1.5">
            {EXAMPLE_PROMPTS.map((ex) => (
              <button key={ex} onClick={() => setPrompt(ex)}
                className="text-[9px] font-['Rajdhani'] px-2.5 py-1 rounded-lg transition-all hover:border-[rgba(168,85,247,0.3)] hover:text-[#a855f7]"
                style={{ background: "rgba(168,85,247,0.04)", border: "1px solid rgba(168,85,247,0.1)", color: "rgba(148,163,184,0.5)" }}>
                {ex.slice(0, 35)}…
              </button>
            ))}
          </div>

          {/* ── Glowing generate button ──────────────────────── */}
          <motion.button
            onClick={handleGenerate}
            disabled={loading || !prompt.trim()}
            whileHover={!loading && prompt.trim() ? {
              y: -2,
              boxShadow: "0 0 40px rgba(168,85,247,0.55), 0 0 80px rgba(0,212,255,0.15), 0 8px 32px rgba(0,0,0,0.5)",
            } : {}}
            whileTap={!loading && prompt.trim() ? { scale: 0.97 } : {}}
            className="w-full py-4 rounded-2xl font-['Orbitron'] text-sm font-bold tracking-widest text-white flex items-center justify-center gap-3 transition-all disabled:opacity-35 disabled:cursor-not-allowed relative overflow-hidden"
            style={{
              background: loading
                ? "rgba(168,85,247,0.2)"
                : "linear-gradient(135deg, #7c3aed 0%, #a855f7 45%, #00d4ff 100%)",
              boxShadow: prompt.trim() && !loading
                ? "0 0 24px rgba(168,85,247,0.3), 0 4px 24px rgba(0,0,0,0.4)"
                : "none",
            }}
          >
            {/* Shimmer overlay */}
            {!loading && prompt.trim() && (
              <motion.div
                className="absolute inset-0 opacity-20"
                style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)", transform: "skewX(-20deg)" }}
                animate={{ x: ["-200%", "300%"] }}
                transition={{ duration: 3, repeat: Infinity, ease: "linear", repeatDelay: 1 }}
              />
            )}

            {loading ? (
              <>
                <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full" />
                Generating masterpiece…
              </>
            ) : (
              <>
                <Wand2 className="w-4 h-4" />
                Generate Image
                <span className="text-[10px] opacity-60 font-normal tracking-normal">{CREDITS.IMAGE} credits · {CREDITS.DAILY_IMAGE_LIMIT}/day free</span>
              </>
            )}
          </motion.button>

          {/* ── Error ────────────────────────────────────────── */}
          <AnimatePresence>
            {error && (
              <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="flex items-start gap-3 px-4 py-3 rounded-xl"
                style={{ background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.22)" }}>
                <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-red-400 font-['Rajdhani'] font-semibold">{error}</p>
                </div>
                <button onClick={() => setError(null)} className="text-[rgba(148,163,184,0.4)] hover:text-red-400 flex-shrink-0">
                  <X className="w-3.5 h-3.5" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Output image ─────────────────────────────────── */}
          <AnimatePresence>
            {imageUrl && (
              <motion.div
                initial={{ opacity: 0, scale: 0.97, y: 12 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ duration: 0.35, ease: "easeOut" }}
                className="rounded-2xl overflow-hidden"
                style={{
                  border:    "1px solid rgba(168,85,247,0.25)",
                  boxShadow: "0 0 50px rgba(168,85,247,0.12), 0 12px 40px rgba(0,0,0,0.55)",
                }}
              >
                {/* Image */}
                <div className="bg-[rgba(3,9,20,0.8)] flex justify-center p-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={imageUrl} alt="AI generated artwork" className="rounded-xl w-full" style={{ maxWidth: 520, display: "block" }} />
                </div>

                {/* Action bar */}
                <div className="flex items-center justify-between px-4 py-3 flex-wrap gap-2"
                  style={{ background: "rgba(6,18,36,0.97)", borderTop: "1px solid rgba(168,85,247,0.12)" }}>
                  <div className="flex items-center gap-1.5">
                    <ImageIcon className="w-3 h-3 text-[#a855f7]" />
                    <span className="text-[9px] font-['Orbitron'] text-[rgba(168,85,247,0.7)] tracking-widest">AI GENERATED</span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <motion.button whileHover={{ scale: 1.15 }} whileTap={{ scale: 0.9 }}
                      onClick={() => showToast("Thanks! We're glad you liked the result.")}
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-[rgba(148,163,184,0.35)] hover:text-[#00ff88] transition-colors">
                      <ThumbsUp className="w-3.5 h-3.5" />
                    </motion.button>
                    <motion.button whileHover={{ scale: 1.15 }} whileTap={{ scale: 0.9 }}
                      onClick={() => showToast("Sorry! Try a more descriptive prompt.")}
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-[rgba(148,163,184,0.35)] hover:text-red-400 transition-colors">
                      <ThumbsDown className="w-3.5 h-3.5" />
                    </motion.button>

                    <div className="w-px h-4 bg-[rgba(255,255,255,0.07)] mx-1" />

                    <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={handleGenerate}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-['Rajdhani'] font-bold tracking-wider text-[#00d4ff] transition-all"
                      style={{ background: "rgba(0,212,255,0.07)", border: "1px solid rgba(0,212,255,0.2)" }}>
                      <RefreshCw className="w-3 h-3" /> Regenerate
                    </motion.button>

                    <motion.button
                      whileHover={{ scale: 1.05, boxShadow: "0 0 16px rgba(168,85,247,0.4)" }}
                      whileTap={{ scale: 0.95 }}
                      onClick={handleDownload}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-['Rajdhani'] font-bold tracking-wider text-white transition-all"
                      style={{ background: "linear-gradient(135deg, rgba(168,85,247,0.35), rgba(0,212,255,0.2))", border: "1px solid rgba(168,85,247,0.4)" }}>
                      <Download className="w-3 h-3" /> Download
                    </motion.button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

        </div>
      </div>
    </>
  );
}
