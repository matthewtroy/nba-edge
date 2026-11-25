import type { MultiType, PickLeg } from "./types.js";
import { MIN_LEG_FAIR, sortLegsForSelection } from "./multis.js";
import { qualifiesCrossBoostLeg } from "./main-play-eligibility.js";

/** Swap leg to a different player (same game + market rules). */
export function swapPlayerCandidates(
  anchor: PickLeg,
  picks: PickLeg[],
  multiType?: MultiType
): PickLeg[] {
  const pool = picks.filter((p) => {
    if (p.playerId === anchor.playerId) return false;
    if (p.gameId !== anchor.gameId) return false;
    if (p.market !== anchor.market) return false;
    if (!p.starterEligible) return false;
    if (p.fairPrice < MIN_LEG_FAIR) return false;
    if (multiType === "crossGameSgm" || multiType === "boostSgm") {
      if (!qualifiesCrossBoostLeg(p)) return false;
    }
    return true;
  });
  const withAnchor = [anchor, ...pool].sort(sortLegsForSelection);
  return withAnchor;
}