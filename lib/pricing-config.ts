/** Single source for blend weights and feature gates (NBA Edge pricing). */

/** P_final = MODEL_WEIGHT × P_model + (1 − MODEL_WEIGHT) × P_market */
export const MODEL_WEIGHT = 0.6;
export const MARKET_WEIGHT = 1 - MODEL_WEIGHT;

/** Matchup pp adjustment OFF until explicitly enabled in product */
export const MATCHUP_ENABLED = false;

/** Matchup/pace copy on reasonLine only (no probability adjust) */
export const MATCHUP_REASONS_ENABLED = true;

/** 2026–27 regular season opening window (UTC); backfill counts games from this date only */
export const NBA_SEASON_OPENING_UTC = "2026-10-21";

export function nbaSeasonStartDate(): Date {
  return new Date(`${NBA_SEASON_OPENING_UTC}T12:00:00.000Z`);
}