/* ── AI Nexus credit & limit system ────────────────────────────────────────
   Single source of truth — import in both API routes and UI components.
   ─────────────────────────────────────────────────────────────────────────── */

export const CREDITS = {
  /** Starting balance for every new free-tier user */
  WELCOME: 40_000,

  /** Cost per text action */
  CHAT: 1,
  CODE: 6,   // code generation + SQL
  IMAGE: 12, // image generation

  /** Daily count caps — enforced independently of the credit balance */
  DAILY_IMAGE_LIMIT:  3,
  DAILY_RESUME_LIMIT: 3,
} as const;

/** Credit cost for a given chat tool slug */
export function toolCost(tool: string): number {
  if (tool === "code")  return CREDITS.CODE;
  if (tool === "sql")   return CREDITS.CODE;  // SQL also costs 6
  if (tool === "image") return CREDITS.IMAGE;
  return CREDITS.CHAT; // chat | history
}

/** Hours before the daily count resets */
export const DAILY_RESET_HOURS = 24;
