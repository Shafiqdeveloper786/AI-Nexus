/* ── AI Nexus global notification bus ───────────────────────────────────────
   Any component can call pushNotif() to send a live notification to the
   TopNav notification centre — no prop drilling required.
   ─────────────────────────────────────────────────────────────────────────── */

export const NOTIF_EVENT = "ai-nexus:push-notification";

export type NotifType = "info" | "warning" | "error" | "success";

export interface NotifPayload {
  title: string;
  sub:   string;
  type:  NotifType;
}

export function pushNotif(payload: NotifPayload) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(NOTIF_EVENT, { detail: payload }));
}
