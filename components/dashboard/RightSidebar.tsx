"use client";

import { motion } from "framer-motion";
import { TrendingUp, Cpu, Activity, Zap, MessageSquare, Clock, BarChart2, RefreshCw } from "lucide-react";
import { useUserProfile } from "@/hooks/useUserProfile";

const MODEL_INFO = {
  name: "Llama-3 70B", provider: "Meta · via Groq",
  context: "128K tokens", latency: "~120ms",
  tasks: ["Code", "Chat", "SQL", "Resume"],
};

function InsightCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl p-4"
      style={{
        background: "linear-gradient(135deg, rgba(10,31,61,0.75) 0%, rgba(6,18,36,0.85) 100%)",
        border: "1px solid rgba(0,212,255,0.1)",
      }}>
      {children}
    </div>
  );
}

function SectionLabel({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <Icon className="w-3.5 h-3.5 text-[#00d4ff]" />
      <span className="text-[9px] font-['Orbitron'] text-[rgba(0,212,255,0.6)] tracking-[0.18em] uppercase">{label}</span>
    </div>
  );
}

function UsageBar({ label, percent, color, sublabel }: { label: string; percent: number; color: string; sublabel: string }) {
  const clamped = Math.min(100, Math.max(0, percent));
  return (
    <div className="mb-4 last:mb-0">
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="text-xs font-['Rajdhani'] font-semibold text-[rgba(226,232,240,0.75)]">{label}</span>
        <span className="font-['Orbitron'] text-xs font-bold" style={{ color }}>{clamped}%</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-[rgba(255,255,255,0.05)] overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${clamped}%` }}
          transition={{ duration: 1.2, delay: 0.3, ease: [0.4, 0, 0.2, 1] }}
          className="h-full rounded-full relative"
          style={{ background: `linear-gradient(90deg, ${color}55, ${color})` }}
        >
          <div className="absolute right-0 top-0 bottom-0 w-2.5 rounded-full blur-[3px]" style={{ background: color }} />
        </motion.div>
      </div>
      <p className="text-[10px] text-[rgba(148,163,184,0.35)] font-['Rajdhani'] mt-1">{sublabel}</p>
    </div>
  );
}

function SkeletonLine({ w = "full" }: { w?: string }) {
  return (
    <motion.div
      animate={{ opacity: [0.3, 0.6, 0.3] }}
      transition={{ duration: 1.5, repeat: Infinity }}
      className={`h-2.5 rounded bg-[rgba(255,255,255,0.06)] w-${w}`}
    />
  );
}

export default function RightSidebar() {
  const { profile, loading, error, refetch } = useUserProfile();

  /* ── Compute usage percentages from real data ──────── */
  const FREE_TOKEN_LIMIT  = 10;   // 10 credits = 10 token calls
  const PRO_TOKEN_LIMIT   = 2000;
  const tokenLimit        = profile?.subscription === "free" ? FREE_TOKEN_LIMIT : PRO_TOKEN_LIMIT;
  const creditsUsed       = profile ? tokenLimit - profile.credits : 0;
  const tokenPercent      = profile ? Math.round(Math.max(0, (creditsUsed / tokenLimit) * 100)) : 0;
  const totalTokensK      = profile ? (profile.totalTokens / 1000).toFixed(1) : "0";

  const sessionStart = typeof window !== "undefined"
    ? (window as any).__sessionStart ?? ((window as any).__sessionStart = Date.now())
    : Date.now();
  const sessionMinutes = Math.floor((Date.now() - sessionStart) / 60_000);

  return (
    <div className="w-[272px] h-full flex flex-col overflow-y-auto no-scrollbar"
      style={{ background: "rgba(3,11,26,0.55)", borderLeft: "1px solid rgba(0,212,255,0.08)" }}>

      <div className="h-[1px] flex-shrink-0 bg-gradient-to-r from-transparent via-[rgba(168,85,247,0.35)] to-transparent" />

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 flex-shrink-0"
        style={{ borderBottom: "1px solid rgba(0,212,255,0.06)" }}>
        <div className="flex items-center gap-2">
          <BarChart2 className="w-3.5 h-3.5 text-[#a855f7]" />
          <span className="text-[10px] font-['Orbitron'] text-[rgba(226,232,240,0.6)] tracking-[0.18em]">SYSTEM INSIGHTS</span>
        </div>
        <div className="flex items-center gap-2">
          {error && (
            <motion.button whileHover={{ rotate: 90 }} transition={{ duration: 0.25 }}
              onClick={() => refetch()}
              className="text-[rgba(239,68,68,0.5)] hover:text-red-400 transition-colors"
              title="Retry">
              <RefreshCw className="w-3.5 h-3.5" />
            </motion.button>
          )}
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#00ff88] animate-pulse" />
            <span className="text-[9px] font-['Rajdhani'] text-[rgba(0,255,136,0.6)] font-semibold tracking-wider">LIVE</span>
          </div>
        </div>
      </div>

      <div className="flex-1 p-3 space-y-3 min-h-0">

        {/* ── Active Model ─────────────────────────────── */}
        <InsightCard>
          <SectionLabel icon={Cpu} label="Active Model" />
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{
                background: "linear-gradient(135deg, rgba(0,212,255,0.15), rgba(168,85,247,0.15))",
                border: "1px solid rgba(0,212,255,0.2)",
                boxShadow: "0 0 16px rgba(0,212,255,0.1)",
              }}>
              <Cpu className="w-5 h-5 text-[#00d4ff]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-['Orbitron'] text-xs font-bold text-white leading-tight">{MODEL_INFO.name}</p>
              <p className="text-[10px] text-[rgba(0,212,255,0.5)] font-['Rajdhani'] mt-0.5">{MODEL_INFO.provider}</p>
              <div className="flex flex-wrap gap-1 mt-2">
                {MODEL_INFO.tasks.map((t) => (
                  <span key={t} className="text-[8px] font-['Orbitron'] px-1.5 py-0.5 rounded text-[rgba(0,212,255,0.7)]"
                    style={{ background: "rgba(0,212,255,0.08)", border: "1px solid rgba(0,212,255,0.12)" }}>{t}</span>
                ))}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 mt-3">
            {[{ label: "Context", value: MODEL_INFO.context }, { label: "Latency", value: MODEL_INFO.latency }]
              .map(({ label, value }) => (
              <div key={label} className="px-2.5 py-2 rounded-lg text-center"
                style={{ background: "rgba(0,212,255,0.04)", border: "1px solid rgba(0,212,255,0.08)" }}>
                <p className="text-[9px] text-[rgba(148,163,184,0.35)] font-['Rajdhani'] uppercase tracking-wider">{label}</p>
                <p className="text-[10px] font-['Orbitron'] text-[rgba(226,232,240,0.8)] font-bold mt-0.5">{value}</p>
              </div>
            ))}
          </div>
        </InsightCard>

        {/* ── Usage Stats (live from MongoDB) ──────────── */}
        <InsightCard>
          <SectionLabel icon={TrendingUp} label="Usage Stats" />
          {loading ? (
            <div className="space-y-3">
              <SkeletonLine /><SkeletonLine w="3/4" /><SkeletonLine />
            </div>
          ) : error ? (
            <p className="text-[10px] text-[rgba(239,68,68,0.5)] font-['Rajdhani']">Could not load stats.</p>
          ) : (
            <>
              <UsageBar
                label="Credits Used"
                percent={tokenPercent}
                color="#00d4ff"
                sublabel={`${profile?.credits ?? 0} credits remaining`}
              />
              <UsageBar
                label="Total Tokens"
                percent={Math.min(100, Math.round((profile?.totalTokens ?? 0) / 50))}
                color="#a855f7"
                sublabel={`${totalTokensK}k tokens generated`}
              />
              <div className="flex items-center justify-between rounded-lg px-3 py-2 mt-1"
                style={{ background: "rgba(0,255,136,0.05)", border: "1px solid rgba(0,255,136,0.1)" }}>
                <div className="flex items-center gap-1.5">
                  <Zap className="w-3 h-3 text-[#00ff88]" />
                  <span className="text-[10px] font-['Rajdhani'] text-[rgba(0,255,136,0.7)]">
                    {profile?.subscription === "pro" ? "Pro Plan active" : "Free Plan"}
                  </span>
                </div>
                <span className="text-[9px] font-['Orbitron'] font-bold"
                  style={{ color: profile?.subscription === "pro" ? "#00ff88" : "#a855f7" }}>
                  {(profile?.subscription ?? "free").toUpperCase()}
                </span>
              </div>
            </>
          )}
        </InsightCard>

        {/* ── Session Info ──────────────────────────────── */}
        <InsightCard>
          <SectionLabel icon={Activity} label="Session" />
          <div className="space-y-2.5">
            {loading ? (
              <><SkeletonLine /><SkeletonLine w="3/4" /><SkeletonLine w="1/2" /></>
            ) : (
              <>
                {[
                  { icon: MessageSquare, label: "Total Chats",   value: String(profile?.totalChats ?? 0) },
                  { icon: Zap,           label: "Tokens Used",   value: `${totalTokensK}k` },
                  { icon: Clock,         label: "Session Time",  value: `${sessionMinutes}m` },
                ].map(({ icon: Icon, label, value }) => (
                  <div key={label} className="flex items-center gap-2.5">
                    <div className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0"
                      style={{ background: "rgba(168,85,247,0.08)", border: "1px solid rgba(168,85,247,0.12)" }}>
                      <Icon className="w-3 h-3 text-[#a855f7]" />
                    </div>
                    <span className="flex-1 text-xs text-[rgba(148,163,184,0.55)] font-['Rajdhani']">{label}</span>
                    <span className="font-['Orbitron'] text-xs font-bold text-[rgba(226,232,240,0.8)]">{value}</span>
                  </div>
                ))}
              </>
            )}
          </div>
        </InsightCard>

      </div>
      <div className="h-3 flex-shrink-0" />
    </div>
  );
}
