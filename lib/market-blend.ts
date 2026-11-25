import type { PickLeg } from "./types.js";

/** Canonical blend: P_final = clamp(0.6×P_market + 0.4×P_model). Unpriced legs stay model-only. */

export const MARKET_BLEND_WEIGHT = 0.6;
export const MODEL_BLEND_WEIGHT = 0.4;
/** @deprecated use MARKET_BLEND_WEIGHT / MODEL_BLEND_WEIGHT */
export const MODEL_WEIGHT = MODEL_BLEND_WEIGHT;
/** @deprecated use MARKET_BLEND_WEIGHT */
export const MARKET_WEIGHT = MARKET_BLEND_WEIGHT;
/** Model prob minus implied prob above this → Check news */
export const CHECK_NEWS_PP = 0.15;

export function clampProbability(p: number): number {
  return Math.min(0.95, Math.max(0.05, p));
}

export function blendProbability(modelP: number, marketP: number): number {
  return clampProbability(MARKET_BLEND_WEIGHT * marketP + MODEL_BLEND_WEIGHT * modelP);
}

/** Prior bug (model-heavy 60/40) — for migration logging only. */
export function priorInvertedBlend(modelP: number, marketP: number): number {
  return clampProbability(0.6 * modelP + 0.4 * marketP);
}

export function logMarketBlendSample(picks: PickLeg[]): void {
  const priced = picks.filter(
    (p) =>
      p.modelProbability != null &&
      p.marketProbability != null &&
      p.bestPrice != null &&
      p.bestPrice > 1
  );
  let shifted = 0;
  for (const p of priced) {
    const oldP = priorInvertedBlend(p.modelProbability!, p.marketProbability!);
    if (Math.abs(p.probability - oldP) > 0.03) shifted += 1;
  }
  if (priced.length) {
    console.log(
      `market blend: ${shifted}/${priced.length} priced legs moved >3pp vs prior model-heavy blend`
    );
  }
  for (const p of priced.slice(0, 5)) {
    const oldP = priorInvertedBlend(p.modelProbability!, p.marketProbability!);
    console.log(
      `market blend sample: ${p.playerName} ${p.market} ${p.line}+ ` +
        `model=${(p.modelProbability! * 100).toFixed(1)}% ` +
        `market=${(p.marketProbability! * 100).toFixed(1)}% ` +
        `was=${(oldP * 100).toFixed(1)}% final=${(p.probability * 100).toFixed(1)}%`
    );
  }
}

export function impliedFromDecimalPrice(price: number): number {
  if (price <= 1) return 0.5;
  return 1 / price;
}

export interface PricedRung {
  line: number;
  price: number;
}

/** Use nearest priced rung on same player/market when this line has no quote */
export function borrowMarketImplied(line: number, priced: PricedRung[]): number | undefined {
  if (!priced.length) return undefined;
  const hit = priced.find((r) => r.line === line);
  if (hit) return impliedFromDecimalPrice(hit.price);
  const sorted = [...priced].sort(
    (a, b) => Math.abs(a.line - line) - Math.abs(b.line - line)
  );
  const nearest = sorted[0];
  const dist = Math.abs(nearest.line - line);
  const base = impliedFromDecimalPrice(nearest.price);
  const shift = line > nearest.line ? -0.04 * dist : 0.04 * dist;
  return Math.min(0.95, Math.max(0.05, base + shift));
}