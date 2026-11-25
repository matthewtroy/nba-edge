import type { PickLeg, PlayerGameLog } from "./types.js";

const Q1_GAP_PP = 0.2;

function q1HitRateL5(logs: PlayerGameLog[], market: PickLeg["market"], line: number): number | null {
  const sorted = [...logs].sort((a, b) => b.date.localeCompare(a.date));
  let hits = 0;
  let n = 0;
  for (const g of sorted.slice(0, 5)) {
    let v: number | null = null;
    if (market === "q1pts") v = g.q1Pts ?? null;
    else if (market === "q1reb") v = g.q1Reb ?? null;
    else if (market === "q1ast") v = g.q1Ast ?? null;
    if (v == null) continue;
    n += 1;
    if (v >= line) hits += 1;
  }
  if (n < 3) return null;
  return hits / n;
}

/** Q1 multi rank only — does not change leg pricing. */
export function q1MultiBlendP(leg: PickLeg, logs: PlayerGameLog[]): number {
  const model = leg.modelProbability ?? leg.preBlendModelProbability ?? leg.probability;
  const l10 = leg.q1Last10HitRate ?? leg.probability;
  const l5 = q1HitRateL5(logs, leg.market, leg.line) ?? l10;
  return 0.3 * model + 0.4 * l10 + 0.3 * l5;
}

export function passesQ1MultiHitGap(leg: PickLeg): boolean {
  const hr = leg.q1Last10HitRate;
  if (hr == null) return true;
  const model = leg.modelProbability ?? leg.probability;
  return model - hr <= Q1_GAP_PP;
}