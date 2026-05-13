export type ToolId = "chat" | "code" | "image" | "resume" | "sql";

export interface ChatSession {
  id: string;
  title: string;
  preview: string;
  time: string;
  tool: ToolId;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  isStreaming?: boolean;
  code?: { language: string; snippet: string };
  imageUrl?: string;
  fileAttachment?: { name: string; fileType: "image" | "pdf" | "text"; size: string };
  time: string;
}

export const chatSessions: ChatSession[] = [
  { id: "1", title: "Build Responsive Navbar", preview: "Here is your Next.js component...", time: "2h ago", tool: "code" },
  { id: "2", title: "Project Architecture", preview: "For a scalable SaaS app...", time: "5h ago", tool: "chat" },
  { id: "3", title: "Resume Optimization", preview: "Your CV has been refined...", time: "1d ago", tool: "resume" },
  { id: "4", title: "Portfolio Visuals", preview: "Generated 4 cyberpunk images...", time: "2d ago", tool: "image" },
  { id: "5", title: "User Schema Design", preview: "Here is your SQL schema...", time: "3d ago", tool: "sql" },
  { id: "6", title: "Next.js useEffect Bug", preview: "The issue is in the deps array...", time: "4d ago", tool: "chat" },
];

export const mockMessages: ChatMessage[] = [
  {
    id: "1",
    role: "user",
    content: "Build a responsive navbar in Next.js with glassmorphism styling and mobile menu support.",
    time: "10:24 AM",
  },
  {
    id: "2",
    role: "assistant",
    content: "Here's a responsive glassmorphism Navbar for Next.js. It uses backdrop-blur, smooth toggle transitions, and a mobile hamburger menu:",
    code: {
      language: "tsx",
      snippet: `"use client";
import { useState } from "react";
import Link from "next/link";

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <nav className="fixed top-0 w-full z-50
      backdrop-blur-xl bg-white/5
      border-b border-cyan-500/20">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center
          justify-between h-16">
          <Link href="/" className="font-bold
            text-cyan-400 text-xl tracking-widest">
            AI Nexus
          </Link>
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="md:hidden text-slate-400
              hover:text-cyan-400 transition-colors">
            {isOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>
    </nav>
  );
}`,
    },
    time: "10:24 AM",
  },
  {
    id: "3",
    role: "user",
    content: "Can you add a scroll-aware opacity effect that darkens the navbar background on scroll?",
    time: "10:28 AM",
  },
  {
    id: "4",
    role: "assistant",
    content: "Sure! Add this scroll listener with useEffect. The navbar transitions from transparent to a solid glass background once the user scrolls past 20px:",
    code: {
      language: "tsx",
      snippet: `const [scrolled, setScrolled] = useState(false);

useEffect(() => {
  const onScroll = () =>
    setScrolled(window.scrollY > 20);
  window.addEventListener("scroll", onScroll);
  return () =>
    window.removeEventListener("scroll", onScroll);
}, []);

// In your <nav> className:
// scrolled
//   ? "bg-navy-900/90 shadow-neon-blue"
//   : "bg-transparent"`,
    },
    time: "10:29 AM",
  },
];

export const recentActivityImages = [
  { id: "1", label: "Cyberpunk Cat", gradient: "from-[#00d4ff] to-[#a855f7]" },
  { id: "2", label: "Neon City", gradient: "from-[#a855f7] to-[#f0abfc]" },
  { id: "3", label: "Digital Art", gradient: "from-[#00ff88] to-[#00d4ff]" },
];

export const usageStats = {
  textAI: { label: "Text AI", used: 8600, total: 10000, percent: 86, color: "#00d4ff" },
  imageGen: { label: "Image Gen", used: 7000, total: 10000, percent: 70, color: "#a855f7" },
};

export const premiumTemplates = [
  { id: "1", title: "Minimal Resume", subtitle: "ATS-friendly layout" },
  { id: "2", title: "Dev Portfolio", subtitle: "Dark glassmorphism" },
];
