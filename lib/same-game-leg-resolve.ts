import type { PickLeg } from "./types.js";
import { sameGameSgmHasClash, sameGameSgmLegsClash } from "./clash.js";
import { legEdgeDecimal } from "./same-game-sgm-search.js";

function sortPool(pool: PickLeg[]): PickLeg[] {
  return [...pool].sort((a, b) => {
    const dp = b.probability - a.probability;
    if (Math.abs(dp) > 1e-12) return dp;
    return legEdgeDecimal(b) - legEdgeDecimal(a);
  });
}

/** On clash, drop the lower-p leg and try next ranked candidate from pool. */
export function resolveClashKeepHigherProb(
  chosen: PickLeg[],
  pool: PickLeg[],
  maxLegs: number
): PickLeg[] {
  let set = [...chosen];
  const sorted = sortPool(pool);
  let guard = 0;
  while (sameGameSgmHasClash(set) && guard++ < 64) {
    let drop = -1;
    for (let i = 0; i < set.length; i++) {
      for (let j = i + 1; j < set.length; j++) {
        if (sameGameSgmLegsClash(set[i], set[j])) {
          drop = set[i].probability >= set[j].probability ? j : i;
          break;
        }
      }
      if (drop >= 0) break;
    }
    if (drop < 0) break;
    set = set.filter((_, i) => i !== drop);
    let added = false;
    for (const leg of sorted) {
      if (set.some((s) => s.id === leg.id)) continue;
      const trial = [...set, leg];
      if (trial.length > maxLegs) continue;
      if (!sameGameSgmHasClash(trial)) {
        set = trial;
        added = true;
        break;
      }
    }
    if (!added) break;
  }
  return set;
}

/**
 * Greedy same-game subset: prefer high p, resolve clashes by replacing lower-p legs.
 */
export function pickSameGameLegSubsetResolved(
  pool: PickLeg[],
  minLegs: number,
  maxLegs: number,
  minLegPrice = 1.3
): PickLeg[] | null {
  const sorted = sortPool(
    pool.filter((l) => (l.bestPrice ?? l.bookiePrices?.Sportsbet ?? 0) >= minLegPrice)
  );
  if (sorted.length < minLegs) return null;

  for (let target = maxLegs; target >= minLegs; target--) {
    let chosen: PickLeg[] = [];
    for (const leg of sorted) {
      if (chosen.length >= target) break;
      const trial = [...chosen, leg];
      if (sameGameSgmHasClash(trial)) continue;
      chosen.push(leg);
    }
    chosen = resolveClashKeepHigherProb(chosen, sorted, target);
    if (chosen.length >= minLegs && !sameGameSgmHasClash(chosen)) {
      return chosen.slice(0, maxLegs);
    }
  }
  return null;
}