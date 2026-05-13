"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { FileText, Wand2, Copy, Check, Download, AlertTriangle, ChevronDown, ChevronUp, ThumbsUp, ThumbsDown } from "lucide-react";
import { pushNotif } from "@/lib/notifications";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import NoCreditsModal from "./NoCreditsModal";
import LimitReachedModal from "./LimitReachedModal";
import { useUserProfile } from "@/hooks/useUserProfile";
import { CREDITS } from "@/lib/credits";

/* ── Markdown styling for the resume preview ──────────────────────────────── */
const resumeMd: React.ComponentProps<typeof ReactMarkdown>["components"] = {
  h1: ({ children }) => (
    <h1 className="font-['Orbitron'] font-black text-lg text-white tracking-wide mt-0 mb-1"
      style={{ textShadow: "0 0 14px rgba(0,212,255,0.3)" }}>
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="font-['Orbitron'] font-bold text-sm mt-4 mb-1 pb-1"
      style={{ color: "#00d4ff", borderBottom: "1px solid rgba(0,212,255,0.25)" }}>
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="font-['Rajdhani'] font-bold text-sm mt-2.5 mb-0.5" style={{ color: "rgba(226,232,240,0.95)" }}>
      {children}
    </h3>
  ),
  p: ({ children }) => (
    <p className="font-['Rajdhani'] text-sm mb-1.5 leading-relaxed" style={{ color: "rgba(226,232,240,0.78)" }}>
      {children}
    </p>
  ),
  ul: ({ children }) => <ul className="space-y-0.5 mb-2" style={{ listStyle: "none" }}>{children}</ul>,
  li: ({ children }) => (
    <li className="flex items-start gap-2 text-sm font-['Rajdhani']" style={{ color: "rgba(226,232,240,0.78)" }}>
      <span className="mt-2 flex-shrink-0 rounded-full" style={{ width: "4px", height: "4px", background: "#00d4ff" }} />
      <span>{children}</span>
    </li>
  ),
  strong: ({ children }) => <strong style={{ color: "white", fontWeight: 700 }}>{children}</strong>,
  hr: () => <hr className="my-3" style={{ borderColor: "rgba(0,212,255,0.18)" }} />,
};

const FIELD_STYLES = {
  input: {
    base: "w-full px-4 py-2.5 rounded-xl text-sm font-['Rajdhani'] outline-none transition-all",
    style: {
      background: "rgba(3,11,26,0.85)",
      border:     "1px solid rgba(0,212,255,0.15)",
      color:      "rgba(226,232,240,0.9)",
      caretColor: "#00d4ff",
    } as React.CSSProperties,
  },
  textarea: (rows = 4) => ({
    rows,
    className: "w-full px-4 py-3 rounded-xl text-sm font-['Rajdhani'] resize-none outline-none transition-all",
    style: {
      background: "rgba(3,11,26,0.85)",
      border:     "1px solid rgba(0,212,255,0.15)",
      color:      "rgba(226,232,240,0.9)",
      caretColor: "#00d4ff",
    } as React.CSSProperties,
  }),
};

interface FormData {
  fullName:   string;
  jobTitle:   string;
  email:      string;
  phone:      string;
  linkedin:   string;
  summary:    string;
  experience: string;
  skills:     string;
  education:  string;
}

const EMPTY: FormData = {
  fullName: "", jobTitle: "", email: "", phone: "", linkedin: "",
  summary: "", experience: "", skills: "", education: "",
};

/* ── Professional PDF export — fixed A4 layout, no clipping ─────────────── */
async function exportResumePDF(markdownContent: string, fullName: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const jspdfMod: any = await import("jspdf");
  const JsPDF = jspdfMod.jsPDF ?? jspdfMod.default;
  const doc = new JsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  const PW = 210, PH = 297;
  const ML = 18, MR = 18, MT = 24, MB = 22;
  const CW = PW - ML - MR;   // usable content width = 174 mm

  let y = MT;

  /* ── Helpers ────────────────────────────────────────── */
  const newPage = () => { doc.addPage(); y = MT; };

  /* Draw each wrapped line individually so we can paginate between them */
  const drawLines = (
    text: string,
    fontSize: number,
    fontStyle: "normal" | "bold",
    rgb: [number,number,number],
    indent = 0,
    extraGap = 0,
  ) => {
    doc.setFontSize(fontSize);
    doc.setFont("helvetica", fontStyle);
    doc.setTextColor(rgb[0], rgb[1], rgb[2]);
    /* Line height: point → mm × leading factor */
    const lh = fontSize * 0.3528 * 1.28;
    const wrapped = doc.splitTextToSize(text, CW - indent);
    for (const wLine of wrapped) {
      if (y + lh > PH - MB) newPage();
      doc.text(wLine, ML + indent, y);
      y += lh;
    }
    y += extraGap;
  };

  /* ── Render markdown ────────────────────────────────── */
  const clean = (s: string) =>
    s.replace(/\*\*(.+?)\*\*/g, "$1")
     .replace(/\*(.+?)\*/g, "$1")
     .replace(/`(.+?)`/g, "$1")
     .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");

  for (const raw of markdownContent.split("\n")) {
    const line = raw.trim();

    if (line.startsWith("# ")) {
      /* Name — large header */
      if (y > MT + 2) y += 2;
      if (y + 12 > PH - MB) newPage();
      doc.setFontSize(22);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(10, 36, 99);
      doc.text(line.slice(2), ML, y);
      y += 10;

    } else if (line.startsWith("## ")) {
      /* Section header + rule */
      y += 4;
      if (y + 10 > PH - MB) newPage();
      doc.setFontSize(10.5);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(37, 99, 235);
      doc.text(line.slice(3).toUpperCase(), ML, y);
      y += 1.5;
      if (y + 1 > PH - MB) newPage();
      doc.setDrawColor(37, 99, 235);
      doc.setLineWidth(0.35);
      doc.line(ML, y + 1, PW - MR, y + 1);
      y += 5.5;

    } else if (line.startsWith("### ")) {
      /* Role / company */
      y += 1;
      drawLines(clean(line.slice(4)), 10, "bold", [30, 41, 59], 0, 1);

    } else if (line.startsWith("- ") || line.startsWith("• ")) {
      /* Bullet point */
      const txt = clean(line.replace(/^[-•]\s/, ""));
      doc.setFontSize(9.5);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(55, 65, 80);
      const lh = 9.5 * 0.3528 * 1.28;
      const wrapped = doc.splitTextToSize(txt, CW - 6);
      for (let i = 0; i < wrapped.length; i++) {
        if (y + lh > PH - MB) newPage();
        if (i === 0) {
          /* Draw filled circle bullet */
          doc.setFillColor(37, 99, 235);
          doc.circle(ML + 1.8, y - 1.4, 0.75, "F");
        }
        doc.text(wrapped[i], ML + 5, y);
        y += lh;
      }
      y += 0.5;

    } else if (line.match(/^---+$/) || line.match(/^___+$/)) {
      /* Horizontal rule */
      y += 2;
      if (y + 2 > PH - MB) newPage();
      doc.setDrawColor(200, 212, 225);
      doc.setLineWidth(0.25);
      doc.line(ML, y, PW - MR, y);
      y += 3;

    } else if (line.length > 0) {
      /* Regular paragraph — handles long contact-info lines correctly */
      drawLines(clean(line), 9.5, "normal", [55, 65, 80], 0, 1);

    } else {
      /* Empty line — small gap */
      y += 2;
    }
  }

  /* ── Page footer ─────────────────────────────────────── */
  const total = doc.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(148, 163, 184);
    doc.text(
      `Generated by AI Nexus  ·  Page ${p} of ${total}`,
      PW / 2, PH - 10,
      { align: "center" }
    );
  }

  doc.save(`${fullName.replace(/\s+/g, "_") || "resume"}.pdf`);
}

export default function ResumeBuilder({ onOpenSubscription }: { onOpenSubscription?: () => void }) {
  const [form,        setForm]        = useState<FormData>(EMPTY);
  const [loading,     setLoading]     = useState(false);
  const [resume,      setResume]      = useState("");
  const [error,       setError]       = useState<string | null>(null);
  const [copied,      setCopied]      = useState(false);
  const [pdfLoading,  setPdfLoading]  = useState(false);
  const [noCreditsOpen, setNoCreditsOpen] = useState(false);
  const [limitOpen,     setLimitOpen]     = useState(false);
  const [limitHours,    setLimitHours]    = useState(24);
  const [limitUsed,     setLimitUsed]     = useState(3);
  const [formOpen,    setFormOpen]    = useState(true);
  const [toast,       setToast]       = useState<string | null>(null);
  const [mounted,     setMounted]     = useState(false);
  const { profile, refetch: refetchProfile } = useUserProfile();

  useEffect(() => { setMounted(true); }, []);

  const showToast = (text: string) => { setToast(text); setTimeout(() => setToast(null), 3500); };

  const set = (key: keyof FormData) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleGenerate = async () => {
    if (!form.fullName.trim() || !form.experience.trim() || loading) return;

    /* Resume uses daily limits — no credit deduction */
    setLoading(true);
    setError(null);
    setResume("");
    setFormOpen(false);

    try {
      const res = await fetch("/api/generate-resume", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(form),
      });

      if (res.status === 403) {
        setNoCreditsOpen(true);
        pushNotif({ title: "Credits Exhausted", sub: "No credits left for Resume Builder.", type: "error" });
        return;
      }
      if (res.status === 429) {
        const d = await res.json().catch(() => ({}));
        setLimitHours(d.resetInHours ?? 24);
        setLimitUsed(d.used ?? CREDITS.DAILY_RESUME_LIMIT);
        setLimitOpen(true);
        pushNotif({ title: "Daily Resume Limit Reached", sub: `${CREDITS.DAILY_RESUME_LIMIT} resumes/day — resets in ${d.resetInHours ?? 24}h`, type: "warning" });
        return;
      }

      if (!res.ok || !res.body) {
        const d = await res.json().catch(() => ({}));
        setError(d.message ?? d.error ?? `Error ${res.status}`);
        return;
      }

      /* Stream the resume token-by-token */
      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      let   buf     = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        setResume(buf);
      }

      if (!buf.trim()) setError("Empty response — please try again.");
      await refetchProfile();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(resume);
    setCopied(true);
    showToast("Resume copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadMd = () => {
    const blob = new Blob([resume], { type: "text/markdown" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `${form.fullName.replace(/\s+/g, "_") || "resume"}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadPDF = async () => {
    if (!resume || pdfLoading) return;
    setPdfLoading(true);
    try {
      await exportResumePDF(resume, form.fullName);
      showToast("PDF downloaded successfully!");
    } catch (err) {
      showToast("PDF export failed — please try again.");
      console.error("[PDF export]", err);
    } finally {
      setPdfLoading(false);
    }
  };

  const fieldLabel = (text: string) => (
    <label className="block text-[9px] font-['Orbitron'] tracking-widest text-[rgba(148,163,184,0.45)] mb-1.5 uppercase">
      {text}
    </label>
  );

  return (
    <>
      <NoCreditsModal isOpen={noCreditsOpen} onClose={() => setNoCreditsOpen(false)}
        required={CREDITS.DAILY_RESUME_LIMIT} current={profile?.credits}
        onUpgrade={onOpenSubscription} />
      <LimitReachedModal isOpen={limitOpen} onClose={() => setLimitOpen(false)}
        type="resume" resetInHours={limitHours} used={limitUsed} limit={CREDITS.DAILY_RESUME_LIMIT} />

      {/* Feedback toast portal */}
      {mounted && createPortal(
        <AnimatePresence>
          {toast && (
            <motion.div key="resume-toast"
              initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 24 }} transition={{ duration: 0.22 }}
              className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[999] flex items-center gap-2.5 px-5 py-3 rounded-2xl pointer-events-none"
              style={{ background: "rgba(6,18,36,0.97)", border: "1px solid rgba(0,212,255,0.22)", boxShadow: "0 8px 40px rgba(0,0,0,0.7)" }}>
              <span className="w-1.5 h-1.5 rounded-full bg-[#00d4ff]" style={{ boxShadow: "0 0 6px rgba(0,212,255,0.8)" }} />
              <span className="text-sm font-['Rajdhani'] font-semibold text-[rgba(226,232,240,0.9)] whitespace-nowrap">{toast}</span>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}

      <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
        {/* ── Header ─────────────────────────────────────────── */}
        <div
          className="flex items-center justify-between px-5 py-3 flex-shrink-0"
          style={{ borderBottom: "1px solid rgba(0,212,255,0.07)" }}
        >
          <div>
            <h2 className="font-['Orbitron'] text-sm font-bold text-white tracking-wide">Resume Builder</h2>
            <p className="text-[10px] text-[rgba(0,212,255,0.5)] font-['Rajdhani'] tracking-widest mt-0.5">
              ATS-optimised · Llama-3 70B · 2 credits
            </p>
          </div>
          {profile && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full"
              style={{ border: "1px solid rgba(0,212,255,0.2)", background: "rgba(0,212,255,0.05)" }}>
              <span className="text-[10px] font-['Orbitron'] font-bold text-[#00d4ff]">
                {profile.credits} credits
              </span>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
          {/* ── Collapsible form ─────────────────────────────── */}
          <div className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(0,212,255,0.15)" }}>
            <button
              onClick={() => setFormOpen((v) => !v)}
              className="w-full flex items-center justify-between px-4 py-3 text-xs font-['Orbitron'] font-bold tracking-widest text-[#00d4ff] transition-colors"
              style={{ background: "rgba(0,212,255,0.05)" }}
            >
              <div className="flex items-center gap-2">
                <FileText className="w-3.5 h-3.5" />
                FILL IN YOUR DETAILS
              </div>
              {formOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>

            <AnimatePresence initial={false}>
              {formOpen && (
                <motion.div
                  key="form"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.22 }}
                  className="overflow-hidden"
                >
                  <div className="px-4 pb-4 pt-3 space-y-3"
                    style={{ background: "rgba(3,11,26,0.6)", borderTop: "1px solid rgba(0,212,255,0.08)" }}>

                    {/* Row: name + title */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        {fieldLabel("Full Name *")}
                        <input {...FIELD_STYLES.input} value={form.fullName} onChange={set("fullName")} placeholder="Jane Doe" />
                      </div>
                      <div>
                        {fieldLabel("Job Title *")}
                        <input {...FIELD_STYLES.input} value={form.jobTitle} onChange={set("jobTitle")} placeholder="Senior Full-Stack Engineer" />
                      </div>
                    </div>

                    {/* Row: email + phone */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        {fieldLabel("Email")}
                        <input {...FIELD_STYLES.input} type="email" value={form.email} onChange={set("email")} placeholder="jane@example.com" />
                      </div>
                      <div>
                        {fieldLabel("Phone")}
                        <input {...FIELD_STYLES.input} value={form.phone} onChange={set("phone")} placeholder="+1 555-0100" />
                      </div>
                    </div>

                    {/* LinkedIn */}
                    <div>
                      {fieldLabel("LinkedIn / Portfolio")}
                      <input {...FIELD_STYLES.input} value={form.linkedin} onChange={set("linkedin")} placeholder="linkedin.com/in/janedoe" />
                    </div>

                    {/* Summary */}
                    <div>
                      {fieldLabel("Professional Summary")}
                      <textarea {...FIELD_STYLES.textarea(2)} value={form.summary} onChange={set("summary")}
                        placeholder="Results-driven engineer with 6 years of experience building scalable SaaS products…" />
                    </div>

                    {/* Experience */}
                    <div>
                      {fieldLabel("Work Experience *")}
                      <textarea {...FIELD_STYLES.textarea(5)} value={form.experience} onChange={set("experience")}
                        placeholder={"Senior Engineer @ Acme Corp (2021–Present)\n• Led migration to microservices, reducing latency by 40%\n• Mentored 3 junior developers\n\nEngineer @ StartupXYZ (2019–2021)\n• Built React dashboard used by 10K users"} />
                    </div>

                    {/* Skills */}
                    <div>
                      {fieldLabel("Skills")}
                      <input {...FIELD_STYLES.input} value={form.skills} onChange={set("skills")}
                        placeholder="TypeScript, React, Node.js, PostgreSQL, Docker, AWS" />
                    </div>

                    {/* Education */}
                    <div>
                      {fieldLabel("Education")}
                      <textarea {...FIELD_STYLES.textarea(2)} value={form.education} onChange={set("education")}
                        placeholder="B.Sc. Computer Science · MIT · 2019" />
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* ── Generate button ───────────────────────────────── */}
          <motion.button
            onClick={handleGenerate}
            disabled={loading || !form.fullName.trim() || !form.experience.trim()}
            whileHover={!loading ? { y: -2, boxShadow: "0 0 28px rgba(0,212,255,0.35)" } : {}}
            whileTap={!loading ? { scale: 0.97 } : {}}
            className="w-full py-3.5 rounded-xl font-['Orbitron'] text-sm font-bold tracking-widest text-white flex items-center justify-center gap-2.5 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            style={{
              background: loading
                ? "rgba(0,212,255,0.2)"
                : "linear-gradient(135deg, #00d4ff 0%, #0284c7 50%, #7c3aed 100%)",
            }}
          >
            {loading ? (
              <>
                <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full" />
                Crafting your resume…
              </>
            ) : (
              <>
                <Wand2 className="w-4 h-4" />
                Generate Resume · Free ({CREDITS.DAILY_RESUME_LIMIT}/day)
              </>
            )}
          </motion.button>

          {/* Error */}
          <AnimatePresence>
            {error && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="flex items-start gap-3 px-4 py-3 rounded-xl"
                style={{ background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.22)" }}>
                <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-400 font-['Rajdhani']">{error}</p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Resume preview ────────────────────────────────── */}
          <AnimatePresence>
            {resume && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-2xl overflow-hidden"
                style={{
                  background: "linear-gradient(160deg, rgba(8,22,46,0.97), rgba(3,11,26,0.99))",
                  border:     "1px solid rgba(0,212,255,0.18)",
                  boxShadow:  "0 8px 40px rgba(0,0,0,0.5), 0 0 60px rgba(0,212,255,0.04)",
                }}
              >
                {/* Toolbar */}
                <div className="flex items-center justify-between px-4 py-3 flex-wrap gap-2"
                  style={{ borderBottom: "1px solid rgba(0,212,255,0.1)", background: "rgba(0,212,255,0.03)" }}>

                  {/* Left: title + spinner */}
                  <div className="flex items-center gap-2">
                    <FileText className="w-3.5 h-3.5 text-[#00d4ff]" />
                    <span className="text-[10px] font-['Orbitron'] text-[rgba(0,212,255,0.7)] tracking-widest">
                      GENERATED RESUME
                    </span>
                    {loading && (
                      <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                        className="w-3 h-3 border border-[rgba(0,212,255,0.3)] border-t-[#00d4ff] rounded-full" />
                    )}
                  </div>

                  {/* Right: feedback + actions */}
                  <div className="flex items-center gap-1">
                    {/* Feedback */}
                    <motion.button whileHover={{ scale: 1.15 }} whileTap={{ scale: 0.9 }}
                      onClick={() => showToast("Thanks! Glad the resume looks good.")}
                      title="Good result"
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-[rgba(148,163,184,0.35)] hover:text-[#00ff88] transition-colors">
                      <ThumbsUp className="w-3.5 h-3.5" />
                    </motion.button>
                    <motion.button whileHover={{ scale: 1.15 }} whileTap={{ scale: 0.9 }}
                      onClick={() => showToast("Sorry! Try adding more details to the form.")}
                      title="Poor result"
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-[rgba(148,163,184,0.35)] hover:text-red-400 transition-colors">
                      <ThumbsDown className="w-3.5 h-3.5" />
                    </motion.button>

                    <div className="w-px h-4 bg-[rgba(255,255,255,0.07)] mx-1" />

                    {/* Copy */}
                    <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                      onClick={handleCopy}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-['Rajdhani'] font-bold tracking-wider transition-colors"
                      style={{ color: copied ? "#00ff88" : "rgba(148,163,184,0.6)", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
                      {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      {copied ? "COPIED" : "COPY"}
                    </motion.button>

                    {/* MD download */}
                    <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                      onClick={handleDownloadMd}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-['Rajdhani'] font-bold tracking-wider"
                      style={{ color: "rgba(148,163,184,0.6)", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
                      <Download className="w-3 h-3" /> .MD
                    </motion.button>

                    {/* PDF export */}
                    <motion.button
                      whileHover={!pdfLoading ? { scale: 1.05, boxShadow: "0 0 14px rgba(0,212,255,0.3)" } : {}}
                      whileTap={!pdfLoading ? { scale: 0.95 } : {}}
                      onClick={handleDownloadPDF}
                      disabled={pdfLoading || loading}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-['Rajdhani'] font-bold tracking-wider disabled:opacity-50 transition-all"
                      style={{ color: "#00d4ff", background: "rgba(0,212,255,0.08)", border: "1px solid rgba(0,212,255,0.25)" }}>
                      {pdfLoading ? (
                        <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                          className="w-3 h-3 border border-[rgba(0,212,255,0.3)] border-t-[#00d4ff] rounded-full" />
                      ) : (
                        <Download className="w-3 h-3" />
                      )}
                      {pdfLoading ? "Exporting…" : "PDF"}
                    </motion.button>
                  </div>
                </div>

                {/* Rendered preview */}
                <div className="px-6 py-5">
                  <ReactMarkdown remarkPlugins={[remarkGfm]} components={resumeMd}>
                    {resume}
                  </ReactMarkdown>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </>
  );
}
