import type { PickLeg } from "./types.js";
import { passesFormGuard } from "./form-guard.js";
import { legHasSupportiveReason } from "./picks-supportive-filter.js";
import { MAIN_PLAY_HIGH_PROB_P } from "./pricing-config.js";
import { asBookieLeg } from "./bookie-edge-pool.js";

export function crossGameLegIsHighProb(leg: PickLeg): boolean {
  return leg.probability >= MAIN_PLAY_HIGH_PROB_P || leg.tags.includes("High probability");
}

/** Cross-Game SGM leg: high prob, priced ≥ fair at bookie, supportive reason, no Check news. */
export function qualifiesCrossGameSgmLeg(
  leg: PickLeg,
  bookie: string,
  catalog: PickLeg[]
): boolean {
  if (!passesFormGuard(leg)) return false;
  if (leg.tags.includes("Check news")) return false;
  if (!legHasSupportiveReason(leg)) return false;
  if (!crossGameLegIsHighProb(leg)) return false;

  const priced = asBookieLeg(leg, bookie, catalog);
  if (!priced) return false;
  const price = priced.bestPrice ?? 0;
  if (price < leg.fairPrice - 1e-9) return false;
  return true;
}