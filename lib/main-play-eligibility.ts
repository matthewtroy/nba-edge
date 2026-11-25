import type { Market, PickLeg } from "./types.js";
import { isMainPlayStatLine } from "./starter-eligibility.js";
import { passesFormGuard } from "./form-guard.js";

function isCoreMarket(market: string): boolean {
  return market === "pts" || market === "reb" || market === "ast";
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
  if (market === "3pm") return line >= 4;
  return false;
}

/** Gate: non-Q1 multis (and longshot full-game legs). */
export function gateLineViolation(
  leg: PickLeg,
  allowQ1: boolean
): string | null {
  if (!leg.starterEligible) {
    return `${leg.playerName}: not a starter (24+ min, 3/5 starts)`;
  }
  if (allowQ1) {
    if (!isQ1Market(leg.market)) return `${leg.playerName}: Q1 Multi requires Q1 market`;
    return null;
  }
  if (isQ1Market(leg.market)) {
    return `${leg.playerName}: Q1 leg only in Q1 Multi`;
  }
  if (leg.market === "3pm" && leg.line < 4) {
    return `${leg.playerName}: forbidden ${leg.line}+ 3PM (need 4+)`;
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

function mainPlayBaseOk(leg: PickLeg): boolean {
  return (
    leg.starterEligible === true &&
    isMainPlayStatLine(leg.market, leg.line) &&
    isCoreMarket(leg.market) &&
    leg.probability >= 0.6 &&
    leg.fairPrice >= 1.4 &&
    leg.fairPrice <= 2.5 &&
    !leg.ageB2B &&
    !hasCheckNews(leg)
  );
}

export function qualifiesMainPlayLeg(leg: PickLeg): boolean {
  return mainPlayBaseOk(leg) && passesFormGuard(leg);
}

export function qualifiesMainPlayLegRelaxed(leg: PickLeg): boolean {
  return mainPlayBaseOk(leg) && passesFormGuard(leg);
}

export function qualifiesCrossBoostLeg(leg: PickLeg): boolean {
  return (
    leg.starterEligible === true &&
    isSgmMainLine(leg.market, leg.line) &&
    !isQ1Market(leg.market) &&
    leg.fairPrice >= 1.35 &&
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
    leg.market === "combo" ||
    (leg.market === "pts" && leg.line >= 30);
  if (special) return !isQ1Market(leg.market);
  return false;
}

/** @deprecated use qualifiesCrossBoostLeg */
export function qualifiesBoostSgmLeg(leg: PickLeg): boolean {
  return qualifiesCrossBoostLeg(leg);
}