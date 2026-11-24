import type { PickLeg, MultiBet } from "./types.js";

/** Player may appear in at most 2 multis unless leg p >= 0.80 */
export function exposureViolation(
  multis: MultiBet[],
  picksById: Map<string, PickLeg>
): { ok: boolean; playerId?: string; count?: number } {
  const counts = new Map<string, number>();

  for (const multi of multis) {
    const seenInMulti = new Set<string>();
    for (const legId of multi.legs) {
      const leg = picksById.get(legId);
      if (!leg) continue;
      if (seenInMulti.has(leg.playerId)) continue;
      seenInMulti.add(leg.playerId);
      if (leg.probability >= 0.8) continue;
      const c = (counts.get(leg.playerId) ?? 0) + 1;
      counts.set(leg.playerId, c);
      if (c > 2) {
        return { ok: false, playerId: leg.playerId, count: c };
      }
    }
  }
  return { ok: true };
}

export function enforceExposureCap(multis: MultiBet[], picksById: Map<string, PickLeg>): MultiBet[] {
  const result: MultiBet[] = [];
  const counts = new Map<string, number>();

  for (const multi of multis) {
    let skip = false;
    const seen = new Set<string>();
    for (const legId of multi.legs) {
      const leg = picksById.get(legId);
      if (!leg) continue;
      if (seen.has(leg.playerId)) continue;
      seen.add(leg.playerId);
      if (leg.probability >= 0.8) continue;
      const next = (counts.get(leg.playerId) ?? 0) + 1;
      if (next > 2) {
        skip = true;
        break;
      }
    }
    if (skip) continue;

    for (const legId of multi.legs) {
      const leg = picksById.get(legId);
      if (!leg || leg.probability >= 0.8) continue;
      if (!seen.has(leg.playerId)) continue;
      counts.set(leg.playerId, (counts.get(leg.playerId) ?? 0) + 1);
    }
    result.push(multi);
  }
  return result;
}