"use client";

import { useState, useEffect, useCallback, useRef } from "react";

export interface UserProfileData {
  email: string;
  name: string;
  image: string | null;
  credits: number;
  subscription: "free" | "pro" | "enterprise";
  subscriptionEndsAt: string | null;
  totalChats: number;
  totalTokens: number;
  dailyImageCount: number;
}

/* ── Custom events for cross-instance synchronisation ────────────────────────
   SYNC_EVENT       — triggers a full refetch in every mounted hook instance
                      (used after name/image updates)
   DECREMENT_EVENT  — pushes an optimistic credit decrement to every instance
                      instantly, without an API round-trip
                      (used after each AI action so Sidebar + TopNav update
                       the credit counter the moment the request is sent)
   ─────────────────────────────────────────────────────────────────────────── */
const SYNC_EVENT      = "ai-nexus:profile-updated";
const DECREMENT_EVENT = "ai-nexus:credits-decremented";

export function useUserProfile(initialData?: UserProfileData | null) {
  /* Stable ID so a hook instance can ignore events it dispatched itself */
  const instanceId = useRef(`up-${Math.random().toString(36).slice(2, 9)}`);

  const [profile, setProfile] = useState<UserProfileData | null>(initialData ?? null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  const fetchProfile = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/user/profile");
      if (res.status === 401) { setProfile(null); return; }
      if (!res.ok) throw new Error(`Profile fetch failed (${res.status})`);
      setProfile(await res.json() as UserProfileData);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      console.error("[useUserProfile]", msg);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfile();

    /* Full-refetch when another instance saves profile changes (e.g. name edit) */
    const syncHandler = () => fetchProfile();
    window.addEventListener(SYNC_EVENT, syncHandler);

    /* Instant optimistic decrement from any other hook instance */
    const decrementHandler = (e: Event) => {
      const { amount, from } = (e as CustomEvent<{ amount: number; from: string }>).detail;
      if (from === instanceId.current) return; // skip own event
      setProfile((prev) =>
        prev ? { ...prev, credits: Math.max(0, prev.credits - amount) } : prev
      );
    };
    window.addEventListener(DECREMENT_EVENT, decrementHandler);

    return () => {
      window.removeEventListener(SYNC_EVENT, syncHandler);
      window.removeEventListener(DECREMENT_EVENT, decrementHandler);
    };
  }, [fetchProfile]);

  /**
   * Immediately deducts `amount` credits in this instance's state AND
   * broadcasts the same deduction to every other mounted instance so that
   * Sidebar and TopNav counters update without any network round-trip.
   */
  const decrementCredits = useCallback((amount = 1) => {
    setProfile((prev) =>
      prev ? { ...prev, credits: Math.max(0, prev.credits - amount) } : prev
    );
    window.dispatchEvent(
      new CustomEvent(DECREMENT_EVENT, {
        detail: { amount, from: instanceId.current },
      })
    );
  }, []);

  const updateProfile = useCallback(
    async (updates: { name?: string; image?: string }) => {
      const res = await fetch("/api/user/profile", {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(updates),
      });
      if (!res.ok) throw new Error("Update failed");
      await fetchProfile();
      window.dispatchEvent(new CustomEvent(SYNC_EVENT));
    },
    [fetchProfile]
  );

  return { profile, loading, error, refetch: fetchProfile, updateProfile, decrementCredits };
}
