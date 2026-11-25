import type { Market } from "./types.js";

/** Matches rotation redistribution strings on legs (not matchup/form copy). */
export function isInjuryRedistributionReason(text: string): boolean {
  return /out\s*(?:→|:)|only big left|missing \d+ big|opponent missing/i.test(text);
}

function reasonStatMatchesMarket(reason: string, market: Market): boolean {
  if (market === "q1pts" || market === "pts") {
    return /\+[\d.]+\s*pts\b|pts boost/i.test(reason);
  }
  if (market === "q1reb" || market === "reb") {
    return (
      /\+[\d.]+\s*reb\b|only big left|opponent missing|missing \d+ big/i.test(reason)
    );
  }
  if (market === "q1ast" || market === "ast") {
    return /\+[\d.]+\s*ast\b/i.test(reason);
  }
  if (market === "3pm") return false;
  return false;
}

/** Injury reason that applies to this leg's market (not pts boost on ast leg). */
export function injuryReasonForMarket(
  reasons: string[],
  market: Market
): string | undefined {
  return reasons
    .filter(isInjuryRedistributionReason)
    .filter((r) => !/boards shared|voids if out/i.test(r))
    .find((r) => reasonStatMatchesMarket(r, market));
}

export function pickPrimaryInjuryReason(
  reasons: string[],
  market?: Market
): string | undefined {
  if (market) return injuryReasonForMarket(reasons, market);
  return reasons.find(isInjuryRedistributionReason);
}