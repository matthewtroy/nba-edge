import type { MultiBet, PickLeg } from "./types.js";
import {
  combinedFairAndTakeAt,
  DEFAULT_MIN_EDGE,
  multiCardTitle,
  type MultiCardTitleOptions,
} from "./multi-combined.js";
import { assertNoMixedBookieCopy } from "./multi-display.js";
import { formatLegCardLine } from "./leg-card-odds.js";

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
  "Best multi odds",
  "take at",
  "Take at",
  "@ —",
  "best:",
  "Not offered",
] as const;

export function formatMultiHeadline(multi: MultiBet, legs: PickLeg[]): string {
  const { headline, subline } = multiCardTitle(multi, legs, DEFAULT_MIN_EDGE);
  return `${headline}\n${subline}`;
}

export function renderMultiCardCopyText(
  multi: MultiBet,
  legs: PickLeg[],
  _bookie?: string,
  titleOpts?: MultiCardTitleOptions
): string {
  const opts: MultiCardTitleOptions = titleOpts ?? { minEdgeFraction: DEFAULT_MIN_EDGE };
  const { headline, subline, cardBookie, fairOnly } = multiCardTitle(multi, legs, opts);
  const lines = [headline, subline];
  for (const leg of legs) {
  if (fairOnly) {
    lines.push(
      `${leg.playerName} · Fair $${leg.fairPrice.toFixed(2)}`
    );
  } else {
    lines.push(formatLegCardLine(leg, cardBookie).trimStart());
  }
  }
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
    if (text.toLowerCase().includes(s.toLowerCase())) {
      throw new Error(`Forbidden string in Today proof: ${s}`);
    }
  }
  assertNoMixedBookieCopy(text);
  if (/Small slate\n[\s\S]*Small slate/.test(text)) {
    throw new Error("Small slate appears more than once in Today proof");
  }
}

export function verifyTakeAtIsFairEdge(multi: MultiBet, legs: PickLeg[]): void {
  const { fair, takeAt } = combinedFairAndTakeAt(legs, DEFAULT_MIN_EDGE);
  if (Math.abs(multi.combinedTakeAt - takeAt) > 0.02) {
    throw new Error(
      `Multi take-at ${multi.combinedTakeAt} ≠ fair×1.08 ${takeAt} (fair ${fair})`
    );
  }
}
