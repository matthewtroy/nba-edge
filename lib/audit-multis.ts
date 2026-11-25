import type { MetaJson, MultiBet, PickLeg } from "./types.js";
import { assertNoMixedBookieCopy } from "./multi-display.js";
import { bestSingleBookieQuote } from "./single-bookie.js";

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
      if (leg.bestPrice != null && leg.bestPrice < leg.takeAt) {
        issues.push(
          `${label}: ${leg.playerName} best $${leg.bestPrice.toFixed(2)} below take-at $${leg.takeAt.toFixed(2)}`
        );
      }
    }

    if (!multi.bestBookie || multi.bestBookieTotal == null) {
      issues.push(`${label}: no single bookie at take-at (check bet365)`);
    } else if (multi.bestBookieTotal < multi.combinedTakeAt) {
      issues.push(
        `${label}: ${multi.bestBookie} $${multi.bestBookieTotal.toFixed(2)} below take-at $${multi.combinedTakeAt.toFixed(2)}`
      );
    } else {
      const quote = bestSingleBookieQuote(legs, multi.combinedTakeAt);
      if (!quote || quote.bookie !== multi.bestBookie) {
        issues.push(`${label}: ${multi.bestBookie} does not price every leg at one bookie`);
      }
    }
  }

  return issues;
}