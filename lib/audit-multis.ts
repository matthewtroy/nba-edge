import type { MetaJson, MultiBet, PickLeg } from "./types.js";
import { assertNoMixedBookieCopy } from "./multi-display.js";
import { bestFeedMultiQuote } from "./card-bookie.js";

/** Small bettor-facing audit (not full builder gate). */
export function auditMultisForToday(input: {
  multis: MultiBet[];
  picksById: Map<string, PickLeg>;
  meta: MetaJson;
}): string[] {
  const issues: string[] = [];
  const odds = input.meta.sources?.odds ?? "";
  if (String(odds).includes("tip lock")) {
    issues.push("Odds: tip lock — kept cached prices after tip-off");
  }

  for (const multi of input.multis) {
    const label = multi.variant ? `${multi.label} (${multi.variant})` : multi.label;
    const legs = multi.legs
      .map((id) => input.picksById.get(id))
      .filter(Boolean) as PickLeg[];

    const blob = JSON.stringify(multi);
    try {
      assertNoMixedBookieCopy(blob);
    } catch {
      issues.push(`${label}: mixed-bookie odds fields present`);
    }

    for (const leg of legs) {
      if (leg.tags.includes("Check news")) {
        issues.push(`${label}: ${leg.playerName} has Check news`);
      }
    }

    const feed = bestFeedMultiQuote(legs);
    if (!multi.bestBookie || multi.bestBookieTotal == null || !feed) {
      issues.push(`${label}: no single AU bookie prices every leg`);
    } else if (feed.bookie !== multi.bestBookie || feed.total !== multi.bestBookieTotal) {
      issues.push(`${label}: ${multi.bestBookie} multi total mismatch`);
    }
  }

  return issues;
}