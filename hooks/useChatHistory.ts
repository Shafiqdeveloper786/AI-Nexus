"use client";

import { useState, useEffect, useCallback } from "react";

export interface ChatSession {
  id:      string;
  kind:    "chat" | "code" | "image";  // for icon + routing
  title:   string;
  tool:    string;
  model:   string;
  preview: string;
  time:    string;
}

export function useChatHistory(refreshKey = 0) {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [loading,  setLoading]  = useState(true);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/history");
      if (!res.ok) return;
      const data = await res.json();
      setSessions(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("[useChatHistory]", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchHistory(); }, [fetchHistory, refreshKey]);

  const prependSession = useCallback((session: ChatSession) => {
    setSessions((prev) => [session, ...prev.filter((s) => s.id !== session.id)]);
  }, []);

  const deleteChat = useCallback(async (id: string, kind: ChatSession["kind"] = "chat") => {
    setSessions((prev) => prev.filter((s) => s.id !== id));
    const type = kind === "image" ? "asset" : "chat";
    await fetch(`/api/history?id=${id}&type=${type}`, { method: "DELETE" }).catch(() => {});
  }, []);

  return { sessions, loading, refetch: fetchHistory, prependSession, deleteChat };
}
