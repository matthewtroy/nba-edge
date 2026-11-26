import type { PickLeg } from "./types.js";
import { legRowReasonLines } from "./leg-row-reasons.js";

export function reasonCountHistogram(picks: PickLeg[]): Record<number, number> {
  const hist: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0 };
  for (const leg of picks) {
    const n = legRowReasonLines(leg).length;
    const bucket = n > 3 ? 3 : n;
    hist[bucket] = (hist[bucket] ?? 0) + 1;
  }
  return hist;
}

export function sampleLegsByMarket(
  picks: PickLeg[],
  perMarket = 3
): Record<string, PickLeg[]> {
  const markets = ["pts", "reb", "ast", "3pm"] as const;
  const out: Record<string, PickLeg[]> = {};
  for (const m of markets) {
    out[m] = picks
      .filter((p) => p.market === m)
      .sort((a, b) => (b.probability ?? 0) - (a.probability ?? 0))
      .slice(0, perMarket);
  }
  return out;
}