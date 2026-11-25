import type { MultiBet, PickLeg } from "./types.js";
import {
  NO_SINGLE_BOOKIE_NOTE,
  assertNoMixedBookieCopy,
  formatLegLineAtBookie,
  formatMultiBookieLine,
} from "./multi-display.js";

export const FORBIDDEN_TODAY_STRINGS = [
  "~1 in",
  "Stake",
  "My (",
  "legs @",
  "Bookie:",
  "Best mix",
  "Copy betslip",
  "cross-book",
  "Best across books",
] as const;

export function formatMultiHeadline(multi: MultiBet): string {
  return `Take at $${multi.combinedTakeAt.toFixed(2)}+ once (Fair $${multi.combinedFairPrice.toFixed(2)})`;
}

/** @deprecated use formatLegLineAtBookie */
export function formatLegLine(leg: PickLeg, bookie?: string): string {
  return formatLegLineAtBookie(leg, bookie);
}

export function renderMultiCardCopyText(
  multi: MultiBet,
  legs: PickLeg[],
  bookie?: string
): string {
  const title = multi.variant ? `${multi.label} (${multi.variant})` : multi.label;
  const lines = [title, formatMultiHeadline(multi)];
  const bookieLine = formatMultiBookieLine(multi, legs, bookie);
  if (bookieLine) lines.push(bookieLine);
  else lines.push(NO_SINGLE_BOOKIE_NOTE);
  const rowBook = multi.bestBookie ?? bookie;
  for (const leg of legs) lines.push(formatLegLineAtBookie(leg, rowBook));
  const text = lines.join("\n");
  assertNoMixedBookieCopy(text);
  return text;
}

export function renderMultiCardText(multi: MultiBet, legs: PickLeg[]): string {
  return renderMultiCardCopyText(multi, legs);
}

export function assertNoForbiddenStrings(text: string, extraForbidden: string[] = []): void {
  const bad = [...FORBIDDEN_TODAY_STRINGS, ...extraForbidden];
  for (const s of bad) {
    if (text.includes(s)) throw new Error(`Forbidden string in Today proof: ${s}`);
  }
  assertNoMixedBookieCopy(text);
  if (/Small slate\n[\s\S]*Small slate/.test(text)) {
    throw new Error("Small slate appears more than once in Today proof");
  }
}