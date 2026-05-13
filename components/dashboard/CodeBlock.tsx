"use client";

import { useState } from "react";
import { Copy, Check, Terminal } from "lucide-react";

interface CodeBlockProps {
  language: string;
  snippet: string;
}

function highlight(code: string): React.ReactNode[] {
  const keywords = /\b(import|export|default|from|const|let|var|function|return|if|else|useState|useEffect|async|await|class|interface|type|extends|new|typeof|=>)\b/g;
  const strings = /(["'`])((?:\\\1|(?!\1)[\s\S])*?)\1/g;
  const comments = /(\/\/[^\n]*)/g;
  const jsxTags = /(<\/?[A-Za-z][A-Za-z0-9.]*\s*\/??>?)/g;
  const numbers = /\b(\d+)\b/g;

  const lines = code.split("\n");

  return lines.map((line, li) => {
    const parts: React.ReactNode[] = [];
    const remaining = line;
    let key = 0;

    const safeAdd = (text: string) => {
      if (!text) return;
      // Try comments first
      const cIdx = text.indexOf("//");
      if (cIdx !== -1) {
        const before = text.slice(0, cIdx);
        const comment = text.slice(cIdx);
        if (before) safeAddInline(before, parts, key++);
        parts.push(<span key={key++} className="text-[rgba(148,163,184,0.45)] italic">{comment}</span>);
        return;
      }
      safeAddInline(text, parts, key++);
    };

    const safeAddInline = (text: string, target: React.ReactNode[], k: number) => {
      target.push(
        <span key={k} dangerouslySetInnerHTML={{ __html: text
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(keywords, '<span style="color:#c792ea;font-weight:600">$1</span>')
          .replace(strings, '<span style="color:#c3e88d">$&</span>')
          .replace(numbers, '<span style="color:#f78c6c">$1</span>')
        }} />
      );
    };

    safeAdd(remaining);

    return (
      <div key={li} className="flex">
        <span className="select-none w-8 text-right text-[rgba(148,163,184,0.2)] text-xs mr-3 flex-shrink-0 leading-6">
          {li + 1}
        </span>
        <span className="flex-1 leading-6 text-[#cdd6f4] break-all whitespace-pre-wrap">{parts}</span>
      </div>
    );
  });
}

export default function CodeBlock({ language, snippet }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(snippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className="mt-3 rounded-xl overflow-hidden"
      style={{
        background: "rgba(2,8,18,0.9)",
        border: "1px solid rgba(0,212,255,0.18)",
        boxShadow: "0 0 30px rgba(0,212,255,0.05)",
      }}
    >
      {/* Header bar */}
      <div
        className="flex items-center justify-between px-4 py-2"
        style={{ borderBottom: "1px solid rgba(0,212,255,0.1)", background: "rgba(0,212,255,0.04)" }}
      >
        <div className="flex items-center gap-2">
          <Terminal className="w-3.5 h-3.5 text-[#00d4ff]" />
          <span className="text-[10px] font-['Orbitron'] text-[rgba(0,212,255,0.7)] tracking-widest uppercase">
            {language}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-[rgba(239,68,68,0.5)]" />
            <div className="w-2.5 h-2.5 rounded-full bg-[rgba(234,179,8,0.5)]" />
            <div className="w-2.5 h-2.5 rounded-full bg-[rgba(34,197,94,0.5)]" />
          </div>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 text-[10px] font-['Rajdhani'] tracking-wider text-[rgba(148,163,184,0.5)] hover:text-[#00d4ff] transition-colors px-2 py-1 rounded-md hover:bg-[rgba(0,212,255,0.08)]"
          >
            {copied ? (
              <><Check className="w-3 h-3 text-[#00ff88]" /><span className="text-[#00ff88]">COPIED</span></>
            ) : (
              <><Copy className="w-3 h-3" /><span>COPY</span></>
            )}
          </button>
        </div>
      </div>

      {/* Code body */}
      <div className="overflow-x-auto px-3 py-3">
        <pre className="font-mono text-xs leading-6 min-w-0">
          {highlight(snippet)}
        </pre>
      </div>
    </div>
  );
}
