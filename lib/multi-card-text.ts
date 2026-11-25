import type { MultiBet, PickLeg } from "./types.js";
import { marketLabel } from "./market-label.js";

export const FORBIDDEN_TODAY_STRINGS = [
  "~1 in",
  "Stake",
  "My (",
  "legs @",
  "Bookie:",
  "Best mix",
  "Copy betslip",
] as const;

export function formatMultiHeadline(multi: MultiBet): string {
  return `Take at $${multi.combinedTakeAt.toFixed(2)}+ (Fair $${multi.combinedFairPrice.toFixed(2)})`;
}

export function formatLegLine(leg: PickLeg): string {
  return `${leg.playerName} ${marketLabel(leg.market, leg.line)} · Take at $${leg.takeAt.toFixed(2)}+`;
}

export function renderMultiCardText(multi: MultiBet, legs: PickLeg[]): string {
  const title = multi.variant ? `${multi.label} (${multi.variant})` : multi.label;
  const lines = [title, formatMultiHeadline(multi)];
  if (multi.combinedBestPrice != null && multi.combinedBestBookie) {
    lines.push(
      `Best multi odds: ${multi.combinedBestBookie} $${multi.combinedBestPrice.toFixed(2)}+`
    );
  }
  for (const leg of legs) lines.push(formatLegLine(leg));
  lines.push("Copy for Discord");
  return lines.join("\n");
}

export function assertNoForbiddenStrings(text: string, extraForbidden: string[] = []): void {
  const bad = [...FORBIDDEN_TODAY_STRINGS, ...extraForbidden];
  for (const s of bad) {
    if (text.includes(s)) throw new Error(`Forbidden string in Today proof: ${s}`);
  }
  if (/Small slate\n[\s\S]*Small slate/.test(text)) {
    throw new Error("Small slate appears more than once in Today proof");
  }
}