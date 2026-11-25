import { applyMatchupToModelP, matchupDeltaFromRank } from "./matchup-adjust.js";

const SHADOW_CAP_PP = 0.04;

/** Shadow matchup tweak (±4pp cap); does not affect live cards when MATCHUP_ENABLED=false. */
export function matchupShadowDelta(rank: number | undefined): number {
  const raw = matchupDeltaFromRank(rank);
  return Math.max(-SHADOW_CAP_PP, Math.min(SHADOW_CAP_PP, raw));
}

export function probabilityWithMatchupShadow(modelP: number, rank: number | undefined): number {
  const delta = matchupShadowDelta(rank);
  if (delta === 0) return Math.round(modelP * 1000) / 1000;
  return applyMatchupToModelP(modelP, delta);
}