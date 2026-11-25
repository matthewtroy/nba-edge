import type { Market, PickLeg, PlayerGameLog } from "./types.js";
import { lastFiveVsLine } from "./leg-history.js";
import { pickPrimaryInjuryReason } from "./injury-reason.js";

/** Tags shown on leg rows / sheets (model-only tags stay internal). */
export function visibleLegTags(tags: string[]): string[] {
  return tags.filter((t) => t !== "boards shared");
}

export function visibleLegReasons(reasons: string[]): string[] {
  return reasons.filter((r) => r.toLowerCase() !== "boards shared");
}

function hitCountL10(logs: PlayerGameLog[], market: Market, line: number): number | null {
  const sorted = [...logs].sort((a, b) => b.date.localeCompare(a.date));
  let hits = 0;
  let n = 0;
  for (const g of sorted.slice(0, 10)) {
    let v: number | null = null;
    if (market === "3pm") v = g.threes;
    else if (market === "pts" || market === "reb" || market === "ast") v = g[market];
    else if (market.startsWith("q1")) {
      if (market === "q1pts") v = g.q1Pts ?? null;
      else if (market === "q1reb") v = g.q1Reb ?? null;
      else v = g.q1Ast ?? null;
    }
    if (v == null) continue;
    n += 1;
    if (v >= line) hits += 1;
  }
  if (n < 3) return null;
  return hits;
}

/** One short betting reason: injury first; form only if 7+/10 or 5/5 at line. */
export function buildShortLegReason(leg: PickLeg, logs: PlayerGameLog[]): string | undefined {
  const injury = pickPrimaryInjuryReason(leg.reasons);
  if (injury) return injury.slice(0, 72);
  const hits = hitCountL10(logs, leg.market, leg.line);
  if (hits != null && hits >= 7) {
    return `Hit ${hits} of last 10 at this line`;
  }
  const l5 = lastFiveVsLine(logs, leg.market, leg.line).filter((t) => t !== "na");
  if (l5.length === 5 && l5.every((t) => t === "hit")) {
    return "Hit 5 of last 5 at this line";
  }
  return undefined;
}

export function countLegsWithInjuryReason(picks: PickLeg[]): number {
  return picks.filter((l) => pickPrimaryInjuryReason(l.reasons) != null).length;
}