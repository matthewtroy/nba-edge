import type { HistoryJson } from "./types.js";

/** Reject replacing a non-trivial cache when the next snapshot loses more than 20% of entries. */
export const ESPN_CACHE_MIN_RETAIN_RATIO = 0.8;

export function espnCacheShrinkBlocked(priorCount: number, nextCount: number): boolean {
  if (priorCount <= 0) return false;
  if (nextCount === 0) return true;
  return nextCount < priorCount * ESPN_CACHE_MIN_RETAIN_RATIO;
}

export function recordKeyCount(record: Record<string, unknown> | null | undefined): number {
  return Object.keys(record ?? {}).length;
}

export function historyEntryCount(history: HistoryJson): number {
  return history.legs.length + history.multis.length;
}

export function warnEspnCacheShrinkBlocked(
  label: string,
  priorCount: number,
  nextCount: number
): void {
  console.warn(
    `${label}: blocked >20% shrink ${priorCount}→${nextCount} (ESPN degraded) — keeping prior`
  );
}

export function persistJsonShrinkReason(
  fileLabel: string,
  priorCount: number,
  nextCount: number,
  opts?: { postTipOff?: boolean }
): string | null {
  if (opts?.postTipOff) {
    if (priorCount > 0 && nextCount === 0) {
      return `${fileLabel} would shrink ${priorCount}→0 entries (post-tip empty wipe)`;
    }
    return null;
  }
  if (espnCacheShrinkBlocked(priorCount, nextCount)) {
    return `${fileLabel} would shrink ${priorCount}→${nextCount} entries (>20% loss)`;
  }
  return null;
}