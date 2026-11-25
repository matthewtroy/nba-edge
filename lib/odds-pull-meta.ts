import type { PickLeg } from "./types.js";
import { latestOddsPullIso } from "./official-card-time.js";

/**
 * Odds display time: prefer the session pull timestamp (not later pipeline writes on legs).
 */
export function resolveOddsLastPulled(
  picks: PickLeg[],
  sessionPullAt?: string,
  priorMeta?: string
): string | undefined {
  if (sessionPullAt) return sessionPullAt;
  if (priorMeta) return priorMeta;
  const legTimes = picks.map((p) => p.oddsPulledAt);
  return latestOddsPullIso(...legTimes);
}