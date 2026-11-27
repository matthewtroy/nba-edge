import type { PickLeg } from "./types.js";
import { passesFormGuard } from "./form-guard.js";
import { legHasSupportiveReason } from "./picks-supportive-filter.js";
import { MAIN_PLAY_HIGH_PROB_P } from "./pricing-config.js";
import { asBookieLeg } from "./bookie-edge-pool.js";
import { isSgmMainLine } from "./main-play-eligibility.js";
import { edgeFairPrice } from "./leg-edge-fair.js";
import type { CatalogMarketIndex } from "./catalog-index.js";

export function crossGameLegIsHighProb(leg: PickLeg): boolean {
  return leg.probability >= MAIN_PLAY_HIGH_PROB_P || leg.tags.includes("High probability");
}

export function crossGameStructuralLeg(leg: PickLeg): boolean {
  if (!passesFormGuard(leg)) return false;
  if (leg.market.startsWith("q1")) return false;
  if (!isSgmMainLine(leg.market, leg.line)) return false;
  if (leg.tags.includes("Check news")) return false;
  if (!legHasSupportiveReason(leg)) return false;
  return crossGameLegIsHighProb(leg);
}

/** Cross-Game SGM leg: high prob, priced ≥ fair at bookie, supportive reason, no Check news. */
export function qualifiesCrossGameSgmLeg(
  leg: PickLeg,
  bookie: string,
  catalog: PickLeg[],
  index?: CatalogMarketIndex,
  priced?: PickLeg | null
): boolean {
  if (!crossGameStructuralLeg(leg)) return false;

  const atBookie = priced ?? asBookieLeg(leg, bookie, catalog, index);
  if (!atBookie) return false;
  const price = atBookie.bestPrice ?? 0;
  const fairRef = atBookie.id !== leg.id ? atBookie : leg;
  if (price < edgeFairPrice(fairRef) - 1e-9) return false;
  return true;
}

export function priceCrossGameLegAtBookie(
  leg: PickLeg,
  bookie: string,
  catalog: PickLeg[],
  index: CatalogMarketIndex
): PickLeg | null {
  if (!crossGameStructuralLeg(leg)) return null;
  const priced = asBookieLeg(leg, bookie, catalog, index);
  if (!priced) return null;
  if (!qualifiesCrossGameSgmLeg(leg, bookie, catalog, index, priced)) return null;
  return priced;
}