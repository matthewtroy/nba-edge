import type { ResultsJson } from "./results-types.js";

/** One-line official bet W–L for Home / Today header. */
export function formatHomeSettleSummary(results: ResultsJson | null | undefined): string | null {
  if (!results?.official?.record) return null;
  const rec = results.official.record;
  if ((rec.bets ?? 0) === 0) return null;
  const wl = `${rec.won}–${rec.lost}`;
  const voidSuffix = rec.void ? ` (${rec.void} void)` : "";
  const net =
    rec.profit >= 0 ? `+${rec.profit.toFixed(2)}u` : `${rec.profit.toFixed(2)}u`;
  const decided = rec.won + rec.lost;
  const strike =
    decided > 0 ? `${Math.round((rec.won / decided) * 1000) / 10}%` : "—";
  return `Official ${wl}${voidSuffix} · ${net} net · strike ${strike}`;
}