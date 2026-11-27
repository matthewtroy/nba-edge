import type { OfficialCardFile } from "./official-card-time.js";

export const REPUBLISH_CARD_LOCK_MS = 30 * 60 * 1000;

/** When locked, republish_card is a no-op (exit 0, no file writes). */
export function republishCardIsLocked(
  existing: OfficialCardFile | null,
  now: Date,
  forceRepublish: boolean
): boolean {
  if (forceRepublish) return false;
  const publishedAt = existing?.publishedAt ?? existing?.lockedAt;
  if (!publishedAt) return false;
  const ageMs = now.getTime() - new Date(publishedAt).getTime();
  return ageMs >= 0 && ageMs < REPUBLISH_CARD_LOCK_MS;
}