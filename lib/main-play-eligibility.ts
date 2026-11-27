import type { Market, PickLeg } from "./types.js";
import { isMainPlayStatLine } from "./starter-eligibility.js";
import { passesFormGuard } from "./form-guard.js";
import { legBookiePriceInBand } from "./leg-bookie-band.js";
import { legPriceAtBookie } from "./single-bookie.js";
import { mainPlayReasonBeyondRankAvg } from "./leg-display.js";
import { hasValueAtBookie } from "./value-at-bookie.js";
import {
  MAIN_PLAY_HIGH_PROB_P,
  MAIN_PLAY_L10_GAP_PP,
  MAIN_PLAY_LEG_FAIR_MIN,
  MAIN_PLAY_LEG_FAIR_MAX,
} from "./pricing-config.js";
import { legHasNegativeRoleRisk } from "./role-risk.js";
import { edgeFairPrice } from "./leg-edge-fair.js";

export function isMainPlayCoreMarket(market: string): boolean {
  return market === "pts" || market === "reb" || market === "ast" || market === "3pm";
}

function hasCheckNews(leg: PickLeg): boolean {
  return leg.tags.includes("Check news");
}

function isQ1Market(market: string): boolean {
  return market.startsWith("q1");
}

/** Cross / Best SGM main lines — no micro threes, no sub-5 reb/ast. */
export function isSgmMainLine(market: Market, line: number): boolean {
  if (isQ1Market(market)) return false;
  if (market === "pts") return line >= 10;
  if (market === "reb") return line >= 5;
  if (market === "ast") return line >= 5;
  if (market === "3pm") return line >= 1;
  return false;
}

/** Gate: non-Q1 multis (and longshot full-game legs). */
export function gateLineViolation(
  leg: PickLeg,
  allowQ1: boolean,
  opts?: { mainPlay?: boolean }
): string | null {
  if (opts?.mainPlay) {
    if (leg.starter !== true || leg.starterEligible !== true) {
      if (leg.starter === undefined || leg.starterEligible === undefined) {
        return `${leg.playerName}: starter unknown (fail closed)`;
      }
      return `${leg.playerName}: not a starter (24+ min, 4/5 ESPN starts)`;
    }
  } else if (!leg.starterEligible) {
    return `${leg.playerName}: not a starter (24+ min, 4/5 ESPN starts)`;
  }
  if (allowQ1) {
    if (!isQ1Market(leg.market)) return `${leg.playerName}: Q1 Multi requires Q1 market`;
    return null;
  }
  if (isQ1Market(leg.market)) {
    return `${leg.playerName}: Q1 leg only in Q1 Multi`;
  }
  if (leg.market === "3pm") {
    if (leg.line < 1) {
      return `${leg.playerName}: forbidden ${leg.line}+ 3PM (need 1+)`;
    }
  }
  if (leg.market === "reb" && leg.line < 5) {
    return `${leg.playerName}: forbidden ${leg.line}+ reb (need 5+)`;
  }
  if (leg.market === "ast" && leg.line < 5) {
    return `${leg.playerName}: forbidden ${leg.line}+ ast (need 5+)`;
  }
  if (leg.market === "pts" && leg.line < 10) {
    return `${leg.playerName}: forbidden ${leg.line}+ pts (need 10+)`;
  }
  return null;
}

export function mainPlayStructuralOk(leg: PickLeg): boolean {
  return (
    leg.starter === true &&
    leg.starterEligible === true &&
    isMainPlayStatLine(leg.market, leg.line) &&
    isMainPlayCoreMarket(leg.market) &&
    leg.probability >= 0.6 &&
    !leg.ageB2B &&
    !hasCheckNews(leg) &&
    !legHasNegativeRoleRisk(leg)
  );
}

export {
  MAIN_PLAY_HIGH_PROB_P,
  MAIN_PLAY_L10_GAP_PP,
  MAIN_PLAY_LEG_FAIR_MIN,
  MAIN_PLAY_LEG_FAIR_MAX,
} from "./pricing-config.js";

function lastTenHits(leg: PickLeg): number | null {
  const ticks = leg.recentTenVsLine;
  if (ticks?.length === 10) {
    return ticks.filter((t) => t === "hit").length;
  }
  return null;
}

export function mainPlayL10Within10pp(leg: PickLeg): boolean {
  const hits = lastTenHits(leg);
  if (hits == null) return true;
  const hr = hits / 10;
  return leg.probability - hr <= MAIN_PLAY_L10_GAP_PP + 1e-9;
}

/** Shared Value / High probability thresholds with picks tags & display. */
export function mainPlayHasValueOrHighProb(leg: PickLeg, bookie?: string): boolean {
  if (bookie && hasValueAtBookie(leg, bookie)) return true;
  const price = bookie != null ? legPriceAtBookie(leg, bookie) : leg.bestPrice;
  const edgeFair = edgeFairPrice(leg);
  const high =
    leg.probability >= MAIN_PLAY_HIGH_PROB_P || leg.tags.includes("High probability");
  if (high && price != null && price >= edgeFair - 1e-9) return true;
  if (!bookie) {
    if (leg.tags.includes("Value")) return true;
    if (high && leg.bestPrice != null && leg.bestPrice >= edgeFair - 1e-9) return true;
  }
  return false;
}

export function mainPlayQualifiersOk(leg: PickLeg, bookie?: string): boolean {
  return (
    mainPlayStructuralOk(leg) &&
    passesFormGuard(leg) &&
    mainPlayHasValueOrHighProb(leg, bookie) &&
    mainPlayL10Within10pp(leg) &&
    mainPlayReasonBeyondRankAvg(leg)
  );
}

export function qualifiesMainPlayLeg(leg: PickLeg, bookie?: string): boolean {
  return (
    mainPlayQualifiersOk(leg, bookie) &&
    legBookiePriceInBand(leg, bookie, MAIN_PLAY_LEG_FAIR_MIN, MAIN_PLAY_LEG_FAIR_MAX)
  );
}

export function qualifiesMainPlayLegRelaxed(leg: PickLeg, bookie?: string): boolean {
  return qualifiesMainPlayLeg(leg, bookie);
}

export function qualifiesCrossBoostLeg(leg: PickLeg, bookie?: string): boolean {
  return (
    leg.starterEligible === true &&
    isSgmMainLine(leg.market, leg.line) &&
    !isQ1Market(leg.market) &&
    legBookiePriceInBand(leg, bookie, 1.35, 2.5) &&
    passesFormGuard(leg)
  );
}

export function qualifiesQ1MultiLeg(leg: PickLeg): boolean {
  return leg.starterEligible === true && isQ1Market(leg.market);
}

export function qualifiesLongshotLeg(leg: PickLeg): boolean {
  if (!leg.starterEligible) return false;
  if ((leg.projectedMinutes ?? 0) < 24) return false;
  const special =
    leg.market === "dd" ||
    leg.market === "td" ||
    (leg.market === "pts" && leg.line >= 30);
  if (special) return !isQ1Market(leg.market);
  return false;
}

/** @deprecated use qualifiesCrossBoostLeg */
export function qualifiesBoostSgmLeg(leg: PickLeg): boolean {
  return qualifiesCrossBoostLeg(leg);
}