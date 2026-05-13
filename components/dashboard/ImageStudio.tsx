"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Wand2, Download, AlertTriangle, ImageIcon, Sparkles, RefreshCw, ThumbsUp, ThumbsDown } from "lucide-react";
import { pushNotif } from "@/lib/notifications";
import NoCreditsModal from "./NoCreditsModal";
import { useUserProfile } from "@/hooks/useUserProfile";
import { CREDITS } from "@/lib/credits";

const MODELS = [
  {
    id:    "flux",
    label: "FLUX Schnell",
    badge: "Fast · Free",
    color: "#a855f7",
    desc:  "black-forest-labs/FLUX.1-schnell",
  },
  {
    id:    "flux_dev",
    label: "FLUX Dev",
    badge: "High Quality",
    color: "#00d4ff",
    desc:  "black-forest-labs/FLUX.1-dev",
  },
  {
    id:    "sd2",
    label: "Stable Diffusion 2.1",
    badge: "Classic",
    color: "#00ff88",
    desc:  "stabilityai/stable-diffusion-2-1",
  },
];

const EXAMPLE_PROMPTS = [
  "Cyberpunk city at night, neon rain, cinematic 8K ultra-detailed",
  "A futuristic AI robot with glowing blue eyes, dark background, studio lighting",
  "Abstract digital art, purple and cyan gradients, geometric shapes, 4K",
  "Deep space nebula with swirling colors, photorealistic, NASA style",
];

export default function ImageStudio({ onOpenSubscription }: { onOpenSubscription?: () => void }) {
  const [prompt,        setPrompt]        = useState("");
  const [negPrompt,     setNegPrompt]     = useState("");
  const [selectedModel, setSelectedModel] = useState("flux");
  const [loading,       setLoading]       = useState(false);
  const [imageUrl,      setImageUrl]      = useState<string | null>(null);
  const [error,         setError]         = useState<string | null>(null);
  const [noCreditsOpen,  setNoCreditsOpen]  = useState(false);
  const [toast,         setToast]         = useState<string | null>(null);
  const [mounted,       setMounted]       = useState(false);
  const { profile, refetch: refetchProfile, decrementCredits } = useUserProfile();

  useEffect(() => { setMounted(true); }, []);

  const showToast = (text: string) => { setToast(text); setTimeout(() => setToast(null), 3500); };

  const handleGenerate = async () => {
    const trimmed = prompt.trim();
    if (!trimmed || loading) return;

    /* ── STEP 1: Daily limit pre-flight (no API call if already at limit) ── */
    if (profile && profile.subscription === "free" && profile.dailyImageCount >= CREDITS.DAILY_IMAGE_LIMIT) {
      pushNotif({
        title: "Daily Image Limit Reached",
        sub:   `You've used all ${CREDITS.DAILY_IMAGE_LIMIT} free images today. Upgrade for unlimited access.`,
        type:  "warning",
      });
      onOpenSubscription?.();
      return;
    }

    /* ── STEP 1b: Zero-credit gate ───────────────────────────────────────── */
    if (profile && profile.credits <= 0 && profile.subscription === "free") {
      pushNotif({
        title: "No Credits Left",
        sub:   "Upgrade to Pro for unlimited AI generations.",
        type:  "error",
      });
      onOpenSubscription?.();
      return;
    }

    /* Credit gate — 12 credits per image (non-zero but not enough) */
    if (profile && profile.credits < CREDITS.IMAGE && profile.subscription === "free") {
      setNoCreditsOpen(true);
      pushNotif({ title: "Credits Exhausted", sub: `Image generation costs ${CREDITS.IMAGE} credits.`, type: "error" });
      return;
    }

    /* Optimistic deduction so header counter updates immediately */
    decrementCredits(CREDITS.IMAGE);

    setLoading(true);
    setError(null);
    setImageUrl(null);

    try {
      const res = await fetch("/api/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt:  trimmed + (negPrompt.trim() ? ` | negative: ${negPrompt.trim()}` : ""),
          model:   selectedModel,
        }),
      });

      const data = await res.json();

      if (res.status === 403) {
        /* Server-side credit check failed (edge case — optimistic was wrong) */
        pushNotif({ title: "Credits Exhausted", sub: "Upgrade to Pro for unlimited access.", type: "error" });
        onOpenSubscription?.();
        return;
      }

      /* ── STEP 2 fail: all providers failed → High Traffic alert ────────── */
      if (res.status === 429) {
        /* Server confirmed limit exceeded — redirect to subscription */
        pushNotif({
          title: "Daily Image Limit Reached",
          sub:   `${CREDITS.DAILY_IMAGE_LIMIT} free images/day. Resets in ${data.resetInHours ?? 24}h.`,
          type:  "warning",
        });
        onOpenSubscription?.();
        return;
      }

      /* ── STEP 3: High Traffic — all providers returned errors ───────────── */
      if (res.status === 503) {
        setError(data.message ?? "High Traffic Alert: All AI providers are currently unavailable. Please try again in a few minutes.");
        return;
      }

      if (!res.ok) {
        setError(data.message ?? data.error ?? `Generation failed (${res.status})`);
        return;
      }

      setImageUrl(data.imageUrl);
      await refetchProfile();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error — please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    if (!imageUrl) return;
    const a = document.createElement("a");
    a.href     = imageUrl;
    a.download = `ai-nexus-${Date.now()}.png`;
    a.click();
  };

  return (
    <>
      <NoCreditsModal
        isOpen={noCreditsOpen}
        onClose={() => setNoCreditsOpen(false)}
        required={CREDITS.DAILY_IMAGE_LIMIT}
        current={profile?.credits}
        onUpgrade={onOpenSubscription}
      />
      <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
        {/* ── Header ─────────────────────────────────────────── */}
        <div
          className="flex items-center justify-between px-5 py-3 flex-shrink-0"
          style={{ borderBottom: "1px solid rgba(0,212,255,0.07)" }}
        >
          <div>
            <h2 className="font-['Orbitron'] text-sm font-bold text-white tracking-wide">Image Studio</h2>
            <p className="text-[10px] text-[rgba(0,212,255,0.5)] font-['Rajdhani'] tracking-widest mt-0.5">
              FLUX · SD 2.1 · {CREDITS.DAILY_IMAGE_LIMIT} images / day
            </p>
          </div>
          {profile && (
            <div
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full"
              style={{ border: "1px solid rgba(0,212,255,0.2)", background: "rgba(0,212,255,0.05)" }}
            >
              <Sparkles className="w-3 h-3 text-[#00d4ff]" />
              <span className="text-[10px] font-['Orbitron'] font-bold text-[#00d4ff]">
                {profile.credits} credits
              </span>
            </div>
          )}
        </div>

        {/* ── Scrollable body ────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">

          {/* Model cards */}
          <div className="grid grid-cols-3 gap-2">
            {MODELS.map((m) => {
              const active = selectedModel === m.id;
              return (
                <motion.button
                  key={m.id}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setSelectedModel(m.id)}
                  className="py-3 px-4 rounded-xl text-left transition-all"
                  style={
                    active
                      ? {
                          background:  `${m.color}10`,
                          border:      `1px solid ${m.color}45`,
                          boxShadow:   `0 0 18px ${m.color}12`,
                        }
                      : {
                          background: "rgba(255,255,255,0.025)",
                          border:     "1px solid rgba(255,255,255,0.07)",
                        }
                  }
                >
                  <div className="flex items-center justify-between mb-0.5">
                    <span
                      className="text-xs font-['Rajdhani'] font-bold"
                      style={{ color: active ? m.color : "rgba(226,232,240,0.7)" }}
                    >
                      {m.label}
                    </span>
                    <span
                      className="text-[9px] font-['Orbitron'] px-1.5 py-0.5 rounded-full"
                      style={
                        active
                          ? { color: m.color, background: `${m.color}15`, border: `1px solid ${m.color}30` }
                          : { color: "rgba(148,163,184,0.4)", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }
                      }
                    >
                      {m.badge}
                    </span>
                  </div>
                  <p className="text-[9px] font-['Rajdhani'] truncate" style={{ color: "rgba(148,163,184,0.35)" }}>
                    {m.desc}
                  </p>
                </motion.button>
              );
            })}
          </div>

          {/* Prompt */}
          <div>
            <label className="block text-[9px] font-['Orbitron'] tracking-widest text-[rgba(148,163,184,0.45)] mb-2 uppercase">
              Prompt
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={3}
              placeholder="A cyberpunk city at night, neon rain, cinematic 8K ultra-detailed…"
              className="w-full px-4 py-3 rounded-xl text-sm font-['Rajdhani'] resize-none outline-none transition-all"
              style={{
                background:    "rgba(3,11,26,0.85)",
                border:        `1px solid ${prompt.trim() ? "rgba(0,212,255,0.3)" : "rgba(0,212,255,0.12)"}`,
                color:         "rgba(226,232,240,0.9)",
                caretColor:    "#00d4ff",
              }}
              onFocus={(e) => { (e.target.style.border = "1px solid rgba(0,212,255,0.45)"); (e.target.style.boxShadow = "0 0 0 3px rgba(0,212,255,0.07)"); }}
              onBlur={(e)  => { (e.target.style.border = `1px solid ${prompt.trim() ? "rgba(0,212,255,0.3)" : "rgba(0,212,255,0.12)"}`); (e.target.style.boxShadow = "none"); }}
            />

            {/* Example prompts */}
            <div className="flex flex-wrap gap-1.5 mt-2">
              {EXAMPLE_PROMPTS.map((ex) => (
                <button
                  key={ex}
                  onClick={() => setPrompt(ex)}
                  className="text-[9px] font-['Rajdhani'] px-2 py-1 rounded-lg transition-all hover:border-[rgba(0,212,255,0.3)] hover:text-[#00d4ff]"
                  style={{
                    background: "rgba(0,212,255,0.04)",
                    border:     "1px solid rgba(0,212,255,0.1)",
                    color:      "rgba(148,163,184,0.5)",
                  }}
                >
                  {ex.slice(0, 32)}…
                </button>
              ))}
            </div>
          </div>

          {/* Negative prompt */}
          <div>
            <label className="block text-[9px] font-['Orbitron'] tracking-widest text-[rgba(148,163,184,0.45)] mb-2 uppercase">
              Negative Prompt <span className="normal-case font-['Rajdhani'] text-[rgba(148,163,184,0.3)]">(optional)</span>
            </label>
            <input
              value={negPrompt}
              onChange={(e) => setNegPrompt(e.target.value)}
              placeholder="blurry, low quality, watermark, bad anatomy…"
              className="w-full px-4 py-2.5 rounded-xl text-sm font-['Rajdhani'] outline-none"
              style={{
                background: "rgba(3,11,26,0.6)",
                border:     "1px solid rgba(255,255,255,0.07)",
                color:      "rgba(226,232,240,0.7)",
              }}
            />
          </div>

          {/* Generate button */}
          <motion.button
            onClick={handleGenerate}
            disabled={loading || !prompt.trim()}
            whileHover={!loading && prompt.trim() ? { y: -2, boxShadow: "0 0 32px rgba(168,85,247,0.45)" } : {}}
            whileTap={!loading && prompt.trim() ? { scale: 0.97 } : {}}
            className="w-full py-3.5 rounded-xl font-['Orbitron'] text-sm font-bold tracking-widest text-white flex items-center justify-center gap-2.5 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              background: loading
                ? "rgba(168,85,247,0.25)"
                : "linear-gradient(135deg, #7c3aed 0%, #a855f7 50%, #00d4ff 100%)",
            }}
          >
            {loading ? (
              <>
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full"
                />
                Generating your masterpiece…
              </>
            ) : (
              <>
                <Wand2 className="w-4 h-4" />
                Generate Image · Free ({CREDITS.DAILY_IMAGE_LIMIT}/day)
              </>
            )}
          </motion.button>

          {/* Error */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex items-start gap-3 px-4 py-3 rounded-xl"
                style={{ background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.22)" }}
              >
                <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm text-red-400 font-['Rajdhani'] font-semibold">{error}</p>
                  {error.includes("loading") && (
                    <p className="text-[10px] text-[rgba(148,163,184,0.5)] font-['Rajdhani'] mt-0.5">
                      Model is warming up — wait 20 s and try again.
                    </p>
                  )}
                </div>
                <button
                  onClick={() => setError(null)}
                  className="ml-auto text-[rgba(148,163,184,0.4)] hover:text-red-400 transition-colors"
                >
                  ×
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Result image */}
          <AnimatePresence>
            {imageUrl && (
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0  }}
                className="rounded-2xl overflow-hidden"
                style={{
                  border:    "1px solid rgba(168,85,247,0.3)",
                  boxShadow: "0 0 40px rgba(168,85,247,0.1), 0 8px 32px rgba(0,0,0,0.5)",
                }}
              >
                {/* Image — medium, centred, max 480px */}
                <div className="flex justify-center bg-[rgba(3,9,20,0.7)] p-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={imageUrl}
                    alt="AI generated artwork"
                    className="rounded-xl"
                    style={{ maxWidth: "480px", width: "100%", display: "block" }}
                  />
                </div>

                {/* Action bar — always visible */}
                <div className="flex items-center justify-between px-4 py-3"
                  style={{ background: "rgba(6,18,36,0.97)", borderTop: "1px solid rgba(168,85,247,0.15)" }}>

                  {/* Stamp */}
                  <div className="flex items-center gap-1.5">
                    <ImageIcon className="w-3 h-3 text-[#a855f7]" />
                    <span className="text-[9px] font-['Orbitron'] text-[rgba(168,85,247,0.75)] tracking-widest">
                      AI GENERATED
                    </span>
                  </div>

                  {/* Feedback + actions */}
                  <div className="flex items-center gap-1.5">
                    <motion.button whileHover={{ scale: 1.15 }} whileTap={{ scale: 0.9 }}
                      onClick={() => showToast("Thanks! We're glad you liked the result.")}
                      title="Good result"
                      className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors text-[rgba(148,163,184,0.35)] hover:text-[#00ff88]">
                      <ThumbsUp className="w-3.5 h-3.5" />
                    </motion.button>
                    <motion.button whileHover={{ scale: 1.15 }} whileTap={{ scale: 0.9 }}
                      onClick={() => showToast("Sorry to hear that. Try adjusting your prompt!")}
                      title="Poor result"
                      className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors text-[rgba(148,163,184,0.35)] hover:text-red-400">
                      <ThumbsDown className="w-3.5 h-3.5" />
                    </motion.button>

                    <div className="w-px h-4 bg-[rgba(255,255,255,0.07)] mx-1" />

                    <motion.button whileHover={{ scale: 1.05, boxShadow: "0 0 14px rgba(0,212,255,0.3)" }}
                      whileTap={{ scale: 0.95 }}
                      onClick={handleGenerate}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-['Rajdhani'] font-bold tracking-wider text-[#00d4ff] transition-all"
                      style={{ background: "rgba(0,212,255,0.07)", border: "1px solid rgba(0,212,255,0.2)" }}>
                      <RefreshCw className="w-3 h-3" /> Regenerate
                    </motion.button>
                    <motion.button whileHover={{ scale: 1.05, boxShadow: "0 0 14px rgba(168,85,247,0.3)" }}
                      whileTap={{ scale: 0.95 }}
                      onClick={handleDownload}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-['Rajdhani'] font-bold tracking-wider text-white transition-all"
                      style={{ background: "linear-gradient(135deg, rgba(168,85,247,0.3), rgba(0,212,255,0.2))", border: "1px solid rgba(168,85,247,0.35)" }}>
                      <Download className="w-3 h-3" /> Download
                    </motion.button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Feedback toast portal */}
      {mounted && createPortal(
        <AnimatePresence>
          {toast && (
            <motion.div
              key="img-toast"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0  }}
              exit={{ opacity: 0,  y: 24 }}
              transition={{ duration: 0.22 }}
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
    </>
  );
}
