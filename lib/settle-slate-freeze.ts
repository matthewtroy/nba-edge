import type { ResultsSlice } from "./results-types.js";

const TERMINAL = new Set(["won", "lost", "void"]);

export function isTerminalLegResult(r: string): boolean {
  return TERMINAL.has(r);
}

export function slateResultsFrozen(slice: ResultsSlice | null): boolean {
  if (!slice) return false;
  if (slice.official.bets.some((b) => b.result === "pending")) return false;
  if (slice.official.legs.some((l) => l.result === "pending")) return false;
  if (slice.gradedLegs.some((g) => g.result === "pending")) return false;
  return slice.official.bets.length > 0 || slice.gradedLegs.length > 0 || slice.official.legs.length > 0;
}

export function pendingSlateDates(slates: ResultsSlice[]): string[] {
  const out = new Set<string>();
  for (const slice of slates) {
    const d =
      slice.official.legs[0]?.slateDate ??
      slice.official.bets[0]?.slateDate ??
      slice.gradedLegs[0]?.slateDate;
    if (!d) continue;
    if (!slateResultsFrozen(slice)) out.add(d);
  }
  return [...out];
}