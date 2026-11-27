import type { LegReason, Market } from "./types.js";
import { normalizeLegReasons, reasonTexts } from "./leg-reason-types.js";
import { playerLastName } from "./player-last-name.js";

function asTexts(reasons: LegReason[] | string[]): string[] {
  if (!reasons.length) return [];
  if (typeof reasons[0] === "string") return reasons as string[];
  return reasonTexts(normalizeLegReasons(reasons));
}

/** Matches rotation redistribution strings on legs (not matchup/form copy). */
export function isInjuryRedistributionReason(text: string): boolean {
  return (
    /out\s*(?:→|:)|only big left|missing \d+ big|without .+ →/i.test(text) ||
    /(?:questionable|doubtful|probable)\s*→/i.test(text)
  );
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

/** Display copy: `Holmgren out → +7.2 reb` */
export function formatInjuryReasonLine(reason: string): string {
  let r = reason.replace(/boards shared/gi, "").trim();
  r = r.replace(
    /^(.+?)\s+out:\s*\+\s*([\d.]+)\s*(pts|reb|ast)\b/i,
    (_, name, val, stat) => {
      const last = playerLastName(String(name));
      return `${last} out → +${val} ${stat}`;
    }
  );
  r = r.replace(
    /^(.+?)\s+without\s+(.+?)\s*\(([^)]+)\)\s*→\s*\+([\d.]+)\s*(pts|reb|ast)\b/i,
    (_, team, player, pos, val, stat) =>
      `${team.trim()} without ${player.trim()} (${pos.trim()}) → +${val} ${stat}`
  );
  return r.replace(/\s+/g, " ").trim();
}

/** Injury reason that applies to this leg's market (not pts boost on ast leg). */
export function injuryReasonForMarket(
  reasons: LegReason[] | string[],
  market: Market
): string | undefined {
  const raw = asTexts(reasons)
    .filter(isInjuryRedistributionReason)
    .filter((r) => !/boards shared|voids if out/i.test(r))
    .find((r) => reasonStatMatchesMarket(r, market));
  return raw ? formatInjuryReasonLine(raw) : undefined;
}

/** Teammate injury redistribution that does not apply directly to this leg's stat. */
export function teammateInjuryReasonForLeg(
  reasons: LegReason[] | string[],
  market: Market
): string | undefined {
  const raw = asTexts(reasons)
    .filter(isInjuryRedistributionReason)
    .filter((r) => !/voids if out/i.test(r))
    .find((r) => !reasonStatMatchesMarket(r, market));
  return raw ? formatInjuryReasonLine(raw) : undefined;
}

export function pickPrimaryInjuryReason(
  reasons: LegReason[] | string[],
  market?: Market
): string | undefined {
  if (market) return injuryReasonForMarket(reasons, market);
  return asTexts(reasons).find(isInjuryRedistributionReason);
}