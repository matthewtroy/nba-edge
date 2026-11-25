/** Single source for blend weights and feature gates (NBA Edge pricing). */

/** Main Play bookie combined total (decimal product at chosen AU bookie). */
export const MAIN_PLAY_COMBINED_MIN = 5;
export const MAIN_PLAY_COMBINED_MAX = 20;

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