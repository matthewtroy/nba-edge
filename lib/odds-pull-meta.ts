import type { PickLeg } from "./types.js";
import { latestOddsPullIso } from "./official-card-time.js";

export function resolveOddsLastPulled(
  picks: PickLeg[],
  cacheLast?: string,
  modelLast?: string
): string | undefined {
  const legTimes = picks.map((p) => p.oddsPulledAt);
  return latestOddsPullIso(cacheLast, modelLast, ...legTimes);
}