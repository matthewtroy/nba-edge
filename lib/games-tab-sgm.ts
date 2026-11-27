import type { PickLeg } from "./types.js";
import { sameGameSgmHasClash } from "./clash.js";
import { pickSameGameLegSubsetResolved } from "./same-game-leg-resolve.js";
import { combinedPriceForBookieWithCatalog } from "./single-bookie.js";
import { legMeetsBookieEdge, asBookieLeg } from "./bookie-edge-pool.js";
import {
  isSgmMainLine,
  qualifiesCrossBoostLeg,
} from "./main-play-eligibility.js";
import { passesFormGuard } from "./form-guard.js";
import { hasValueAtBookie } from "./value-at-bookie.js";
import { legEdgeDecimal } from "./same-game-sgm-search.js";
import {
  ROUGHIE_LEG_MAX,
  ROUGHIE_LEG_MIN,
  ROUGHIE_MAX_LEGS,
  ROUGHIE_MAX_ROUGHIE_LEGS,
  ROUGHIE_MIN_LEGS,
  ROUGHIE_NORMAL_MAX,
  ROUGHIE_NORMAL_MIN,
  bookieHighProbMeetsFair,
} from "./pricing-config.js";
import { legHasSupportiveReason } from "./picks-supportive-filter.js";

export const GAMES_TAB_MIN_LEG_PRICE = 1.3;
export const GAMES_TAB_MIN_LEGS = 2;
export const GAMES_TAB_MAX_LEGS = 6;

export interface GamesTabSgmLegRules {
  minLegPrice: number;
  maxLegPrice?: number;
  minLegs: number;
  maxLegs: number;
  roughie?: boolean;
  maxRoughieLegs?: number;
  normalMin?: number;
  normalMax?: number;
}

export const GAMES_TAB_SGM_RULES: GamesTabSgmLegRules = {
  minLegPrice: GAMES_TAB_MIN_LEG_PRICE,
  minLegs: GAMES_TAB_MIN_LEGS,
  maxLegs: GAMES_TAB_MAX_LEGS,
};

export const ROUGHIE_SGM_RULES: GamesTabSgmLegRules = {
  minLegPrice: ROUGHIE_NORMAL_MIN,
  minLegs: ROUGHIE_MIN_LEGS,
  maxLegs: ROUGHIE_MAX_LEGS,
  maxRoughieLegs: ROUGHIE_MAX_ROUGHIE_LEGS,
  normalMin: ROUGHIE_NORMAL_MIN,
  normalMax: ROUGHIE_NORMAL_MAX,
  roughie: true,
};
function combinedProb(legs: PickLeg[]): number {
  return legs.reduce((acc, l) => acc * l.probability, 1);
}

function totalInBand(total: number, min: number, max: number): boolean {
  if (!Number.isFinite(max)) return total >= min;
  return total >= min && total <= max;
}

function legHasRealReasons(leg: PickLeg): boolean {
  return leg.market.startsWith("q1") || legHasSupportiveReason(leg);
}

function legBookiePrice(
  leg: PickLeg,
  bookie: string,
  catalog: PickLeg[]
): number | null {
  const priced = asBookieLeg(leg, bookie, catalog);
  const price = priced?.bestPrice;
  return price != null && price > 0 ? price : null;
}

function roughieLegBand(price: number): "roughie" | "normal" | null {
  if (price >= ROUGHIE_LEG_MIN && price <= ROUGHIE_LEG_MAX) return "roughie";
  if (price >= ROUGHIE_NORMAL_MIN && price < ROUGHIE_LEG_MIN) return "normal";
  return null;
}

function roughieMixedComboValid(
  chosen: PickLeg[],
  bookie: string,
  catalog: PickLeg[],
  rules: GamesTabSgmLegRules
): boolean {
  if (!rules.roughie) return true;
  let roughieCount = 0;
  for (const leg of chosen) {
    const price = legBookiePrice(leg, bookie, catalog);
    if (price == null) return false;
    const band = roughieLegBand(price);
    if (!band) return false;
    if (band === "roughie") roughieCount += 1;
  }
  const maxRough = rules.maxRoughieLegs ?? ROUGHIE_MAX_ROUGHIE_LEGS;
  const normalCount = chosen.length - roughieCount;
  return (
    roughieCount >= 1 &&
    roughieCount <= maxRough &&
    normalCount >= 1
  );
}

function roughieLegPriceQualifies(
  price: number,
  rules: GamesTabSgmLegRules
): boolean {
  if (price < (rules.normalMin ?? ROUGHIE_NORMAL_MIN)) return false;
  if (price > ROUGHIE_LEG_MAX) return false;
  if (price >= ROUGHIE_LEG_MIN) return true;
  const normalMax = rules.normalMax ?? ROUGHIE_NORMAL_MAX;
  return price <= normalMax;
}

export function qualifiesGamesTabStructure(
  leg: PickLeg,
  bookie: string,
  roughie: boolean
): boolean {
  if (!passesFormGuard(leg)) return false;
  if (!leg.starterEligible) return false;
  if (!isSgmMainLine(leg.market, leg.line)) return false;
  if (roughie) return true;
  return qualifiesCrossBoostLeg(leg, bookie);
}

export function qualifiesGamesTabSgmLeg(
  leg: PickLeg,
  bookie: string,
  minEdgeFraction: number,
  catalog?: PickLeg[],
  rules: GamesTabSgmLegRules = GAMES_TAB_SGM_RULES
): boolean {
  if (!qualifiesGamesTabStructure(leg, bookie, rules.roughie === true)) return false;
  const pool = catalog ?? [leg];
  const priced = asBookieLeg(leg, bookie, pool);
  if (!priced) return false;
  const price = priced.bestPrice ?? 0;
  if (rules.roughie) {
    if (!roughieLegPriceQualifies(price, rules)) return false;
    if (!legHasRealReasons(leg)) return false;
    return hasValueAtBookie(leg, bookie);
  }
  if (price < rules.minLegPrice) return false;
  if (rules.maxLegPrice != null && price > rules.maxLegPrice) return false;
  if (legMeetsBookieEdge(leg, bookie, minEdgeFraction)) return true;
  return bookieHighProbMeetsFair(price, leg.fairPrice, leg.probability);
}

export function pickBestGamesTabSgmCombo(
  pool: PickLeg[],
  bookie: string,
  catalog: PickLeg[],
  oddsMin: number,
  oddsMax: number,
  rules: GamesTabSgmLegRules = GAMES_TAB_SGM_RULES
): { legs: PickLeg[]; p: number; total: number; edge: number; valueCount: number } | null {
  if (pool.length < rules.minLegs) return null;

  let best: {
    legs: PickLeg[];
    p: number;
    total: number;
    edge: number;
    valueCount: number;
  } | null = null;

  function dfs(start: number, chosen: PickLeg[]) {
    if (chosen.length >= rules.minLegs && chosen.length <= rules.maxLegs) {
      const total =
        combinedPriceForBookieWithCatalog(chosen, bookie, catalog) ?? 0;
      if (
        totalInBand(total, oddsMin, oddsMax) &&
        !sameGameSgmHasClash(chosen) &&
        roughieMixedComboValid(chosen, bookie, catalog, rules)
      ) {
        const p = combinedProb(chosen);
        const edge = chosen.reduce((s, l) => s + legEdgeDecimal(l), 0);
        const valueCount = chosen.filter((l) =>
          hasValueAtBookie(l, bookie)
        ).length;
        if (
          !best ||
          p > best.p ||
          (Math.abs(p - best.p) < 1e-9 && valueCount > best.valueCount) ||
          (Math.abs(p - best.p) < 1e-9 &&
            valueCount === best.valueCount &&
            edge > best.edge) ||
          (Math.abs(p - best.p) < 1e-9 &&
            valueCount === best.valueCount &&
            Math.abs(edge - best.edge) < 1e-9 &&
            total > best.total)
        ) {
          best = { legs: [...chosen], p, total, edge, valueCount };
        }
      }
    }
    if (chosen.length >= rules.maxLegs) return;
    for (let i = start; i < pool.length; i++) {
      const next = [...chosen, pool[i]];
      if (sameGameSgmHasClash(next)) continue;
      dfs(i + 1, next);
    }
  }
  dfs(0, []);

  if (!best && pool.length >= rules.minLegs) {
    const resolved = pickSameGameLegSubsetResolved(
      pool,
      rules.minLegs,
      rules.maxLegs,
      rules.minLegPrice
    );
    if (resolved) {
      const total =
        combinedPriceForBookieWithCatalog(resolved, bookie, catalog) ?? 0;
      if (
        totalInBand(total, oddsMin, oddsMax) &&
        roughieMixedComboValid(resolved, bookie, catalog, rules)
      ) {
        const p = combinedProb(resolved);
        const edge = resolved.reduce((s, l) => s + legEdgeDecimal(l), 0);
        const valueCount = resolved.filter((l) => hasValueAtBookie(l, bookie))
          .length;
        best = { legs: resolved, p, total, edge, valueCount };
      }
    }
  }

  return best;
}

export function plainEnglishGamesSgmReason(
  gameLabel: string,
  bandLabel: string,
  eligibleCount: number,
  inBandAttempts: number,
  rules: GamesTabSgmLegRules = GAMES_TAB_SGM_RULES
): string {
  if (eligibleCount < rules.minLegs) {
    const legBand = rules.roughie
      ? `Roughie mix (normal $${rules.normalMin ?? ROUGHIE_NORMAL_MIN}–$${rules.normalMax ?? ROUGHIE_NORMAL_MAX}, up to ${rules.maxRoughieLegs ?? ROUGHIE_MAX_ROUGHIE_LEGS} legs $${ROUGHIE_LEG_MIN}–$${ROUGHIE_LEG_MAX})`
      : "this bookie band";
    return `${gameLabel}: not enough starter legs priced for ${legBand}.`;
  }
  if (inBandAttempts === 0) {
    return `${gameLabel}: nothing fits ${bandLabel} after form and clash rules.`;
  }
  return `${gameLabel}: no ${rules.minLegs}–${rules.maxLegs}-leg combo in ${bandLabel}.`;
}

export function crossGameExcludedReason(
  gameLabel: string,
  bookie: string,
  eligible: number
): string {
  if (eligible < 2) {
    return `${gameLabel}: need 2 high-prob legs @ ${bookie} priced ≥ fair (found ${eligible}).`;
  }
  return `${gameLabel}: no clash-free 2-leg pair @ ${bookie}.`;
}