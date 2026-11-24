/** Model vs market probability blend for priced / borrowed rungs */

export const MODEL_WEIGHT = 0.6;
export const MARKET_WEIGHT = 0.4;
/** Model prob minus implied prob above this → Check news */
export const CHECK_NEWS_PP = 0.15;

export function blendProbability(modelP: number, marketP: number): number {
  const p = MODEL_WEIGHT * modelP + MARKET_WEIGHT * marketP;
  return Math.min(0.95, Math.max(0.05, p));
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