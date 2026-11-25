/** Single source for blend weights and feature gates (NBA Edge pricing). */

/** Main Play bookie combined total (decimal product at chosen AU bookie). */
export const MAIN_PLAY_COMBINED_MIN = 5;
export const MAIN_PLAY_COMBINED_MAX = 20;

/** Prefer combined totals in this band before $5–$20 pool (surplus only within band). */
export const MAIN_PLAY_SWEET_MIN = 6;
export const MAIN_PLAY_SWEET_MAX = 12;

export function mainPlayInSweetSpot(total: number): boolean {
  return total >= MAIN_PLAY_SWEET_MIN && total <= MAIN_PLAY_SWEET_MAX;
}

/** Rank Main Play candidates: sweet band first (no surplus across in/out); then surplus → p → total. */
export function compareMainPlayCandidates(
  a: { total: number; surplus: number; p: number },
  b: { total: number; surplus: number; p: number }
): number {
  const aSweet = mainPlayInSweetSpot(a.total);
  const bSweet = mainPlayInSweetSpot(b.total);
  if (aSweet !== bSweet) return aSweet ? -1 : 1;
  if (Math.abs(b.surplus - a.surplus) > 1e-12) return b.surplus - a.surplus;
  if (Math.abs(b.p - a.p) > 1e-12) return b.p - a.p;
  return b.total - a.total;
}

/**
 * Required bookie edge vs combined fair along Main Play / Best SGM curve.
 * At $5 → 10%; at $20 → 75%; linear beyond for Best SGM.
 */
export const MAIN_PLAY_EDGE_AT_MIN = 0.1;
export const MAIN_PLAY_EDGE_AT_MAX = 0.75;

/** requiredEdge(total) = 0.10 + (total − 5) × (0.65 ÷ 15) */
export function requiredEdge(total: number): number {
  return MAIN_PLAY_EDGE_AT_MIN + (total - MAIN_PLAY_COMBINED_MIN) * (0.65 / 15);
}

/** (bookieTotal / combinedFair) − 1 */
export function actualEdgeFraction(bookieTotal: number, combinedFair: number): number {
  if (combinedFair <= 0) return 0;
  return bookieTotal / combinedFair - 1;
}

/** actualEdge / requiredEdge — higher is better */
export function edgeSurplus(bookieTotal: number, combinedFair: number): number {
  const req = requiredEdge(bookieTotal);
  if (req <= 0) return Number.POSITIVE_INFINITY;
  return actualEdgeFraction(bookieTotal, combinedFair) / req;
}

/** e.g. "$14.20, needs 50% edge, has 38%" */
export function formatEdgeShortfall(
  bookieTotal: number,
  actual: number,
  required: number
): string {
  const needsPct = Math.round(required * 100);
  const hasPct = Math.round(actual * 100);
  return `$${bookieTotal.toFixed(2)}, needs ${needsPct}% edge, has ${hasPct}%`;
}

/** Best Double Up combined bookie total band (~double your stake). */
export const DOUBLE_UP_MIN = 1.8;
export const DOUBLE_UP_MAX = 2.2;
/** Score penalty per leg beyond 2 when ranking Double Up candidates. */
export const DOUBLE_UP_EXTRA_LEG_PP = 0.03;

/** Per-leg fair band for Main Play (@ chosen bookie decimal when priced). */
export const MAIN_PLAY_LEG_FAIR_MIN = 1.4;
export const MAIN_PLAY_LEG_FAIR_MAX = 2.5;

/** Main Play: last-10 hit rate within this gap of model p (68.5% → 6/10). */
export const MAIN_PLAY_L10_GAP_PP = 0.1;

/** Same p threshold as `High probability` tag in `lib/pricing.ts`. */
export const MAIN_PLAY_HIGH_PROB_P = 0.72;

/** P_final = MODEL_WEIGHT × P_model + (1 − MODEL_WEIGHT) × P_market */
export const MODEL_WEIGHT = 0.6;
export const MARKET_WEIGHT = 1 - MODEL_WEIGHT;

/** Matchup pp adjustment OFF until explicitly enabled in product */
export const MATCHUP_ENABLED = false;

/** Shadow matchup probability on picks only (never cards / sort / edges). */
export const MATCHUP_SHADOW_ENABLED = true;

/** Matchup/pace copy on reasonLine only (no probability adjust) */
export const MATCHUP_REASONS_ENABLED = true;

/** 2026–27 regular season opening window (UTC); backfill counts games from this date only */
export const NBA_SEASON_OPENING_UTC = "2026-10-21";

export function nbaSeasonStartDate(): Date {
  return new Date(`${NBA_SEASON_OPENING_UTC}T12:00:00.000Z`);
}