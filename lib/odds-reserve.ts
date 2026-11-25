/** Flat credit reserve held back from odds pulls (not a % of monthly budget). */

export const DEFAULT_ODDS_RESERVE_CREDITS = 20;

export function oddsReserveCredits(): number {
  const raw = process.env.ODDS_RESERVE_CREDITS;
  if (raw == null || raw.trim() === "") return DEFAULT_ODDS_RESERVE_CREDITS;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : DEFAULT_ODDS_RESERVE_CREDITS;
}