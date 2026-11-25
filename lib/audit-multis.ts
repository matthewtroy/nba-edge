import type { MetaJson, MultiBet, PickLeg } from "./types.js";
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

    const bestBook = multi.bestBookie ?? multi.combinedBestBookie;
    const bestTotal = multi.bestBookieTotal ?? multi.combinedBestPrice;
    if (bestBook === "Best across books") {
      issues.push(`${label}: no single bookie — cross-book reference only`);
    } else if (bestBook && bestTotal != null) {
      if (bestTotal < multi.combinedTakeAt) {
        issues.push(
          `${label}: ${bestBook} $${bestTotal.toFixed(2)} below take-at $${multi.combinedTakeAt.toFixed(2)}`
        );
      }
      const quote = bestSingleBookieQuote(legs, multi.combinedTakeAt);
      if (!quote || quote.bookie !== bestBook) {
        issues.push(`${label}: ${bestBook} does not price every leg at one bookie`);
      }
    }
  }

  return issues;
}