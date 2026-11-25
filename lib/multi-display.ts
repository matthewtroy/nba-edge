import type { MultiBet, PickLeg } from "./types.js";
import { AU_BOOKMAKERS } from "./types.js";
import {
  combinedPriceForBookie,
  legPriceAtBookie,
} from "./single-bookie.js";
import { marketLabel } from "./market-label.js";
import { isFeedBookie } from "./card-bookie.js";
import { formatLegCardLine } from "./leg-card-odds.js";

export { NO_AU_MULTI_REASON as NO_SINGLE_BOOKIE_NOTE } from "./card-bookie.js";

export const FORBIDDEN_MULTI_ODDS_WORDS = [
  "cross-book",
  "Best across books",
  "Best mix",
] as const;

export function assertNoMixedBookieCopy(text: string): void {
  for (const w of FORBIDDEN_MULTI_ODDS_WORDS) {
    if (text.includes(w)) throw new Error(`Forbidden odds copy: ${w}`);
  }
}

export function pickDefaultBookie(
  multi: MultiBet,
  legs: PickLeg[],
  preferred?: string
): string | undefined {
  if (isFeedBookie(multi.bestBookie)) return multi.bestBookie;
  if (preferred) {
    const total = combinedPriceForBookie(legs, preferred);
    if (total != null) return preferred;
  }
  for (const book of AU_BOOKMAKERS) {
    if (book === "bet365") continue;
    if (combinedPriceForBookie(legs, book) != null) return book;
  }
  return undefined;
}

export function formatLegLineAtBookie(leg: PickLeg, bookie?: string): string {
  if (!bookie) return `${leg.playerName} ${marketLabel(leg.market, leg.line)}`;
  return formatLegCardLine(leg, bookie).trimStart();
}

export function formatMultiBookieLine(
  multi: MultiBet,
  legs: PickLeg[],
  bookie?: string
): string | null {
  const resolved = bookie ?? multi.bestBookie;
  if (multi.bestBookie && multi.bestBookieTotal != null) {
    return `Best multi odds: ${multi.bestBookie} $${multi.bestBookieTotal.toFixed(2)}+`;
  }
  if (resolved) {
    const total = combinedPriceForBookie(legs, resolved);
    if (total != null && total >= multi.combinedTakeAt) {
      return `Best multi odds: ${resolved} $${total.toFixed(2)}+`;
    }
  }
  return null;
}