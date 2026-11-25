import type { PickLeg } from "./types.js";
import { MIN_LEG_FAIR, sortLegsForSelection } from "./multis.js";

/** Next qualifying rung/line for the same player+market (confluence order). */
export function swapCandidatesForLeg(leg: PickLeg, picks: PickLeg[]): PickLeg[] {
  const pool = picks.filter(
    (p) =>
      p.playerId === leg.playerId &&
      p.market === leg.market &&
      p.id !== leg.id &&
      p.starterEligible &&
      p.fairPrice >= MIN_LEG_FAIR
  );
  return [...pool].sort(sortLegsForSelection);
}

export function pickSwapCycle(candidates: PickLeg[], currentId: string, step: number): PickLeg | null {
  if (!candidates.length) return null;
  const idx = candidates.findIndex((c) => c.id === currentId);
  const next = (idx + 1 + step) % candidates.length;
  return candidates[next];
}