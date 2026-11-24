import type { PickLeg } from "./types.js";
import { isMainPlayStatLine } from "./starter-eligibility.js";

function isCoreMarket(market: string): boolean {
  return market === "pts" || market === "reb" || market === "ast";
}

function hasCheckNews(leg: PickLeg): boolean {
  return leg.tags.includes("Check news");
}

export function qualifiesMainPlayLeg(leg: PickLeg): boolean {
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

export function qualifiesBoostSgmLeg(leg: PickLeg): boolean {
  return (
    leg.starterEligible === true &&
    isMainPlayStatLine(leg.market, leg.line) &&
    !leg.market.startsWith("q1")
  );
}