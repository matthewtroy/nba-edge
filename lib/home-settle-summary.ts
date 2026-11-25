import type { ResultsJson } from "./results-types.js";

/** One-line official bet W–L for Home / Today header. */
export function formatHomeSettleSummary(results: ResultsJson | null | undefined): string | null {
  if (!results?.official?.record) return null;
  const rec = results.official.record;
  if ((rec.bets ?? 0) === 0) return null;
  const wl = `${rec.won}–${rec.lost}`;
  const voidSuffix = rec.void ? ` (${rec.void} void)` : "";
  const profit =
    rec.profit >= 0 ? `+${rec.profit.toFixed(1)}u` : `${rec.profit.toFixed(1)}u`;
  return `Official ${wl}${voidSuffix} · ${rec.bets} settled · ${profit}`;
}