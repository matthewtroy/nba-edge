/** ±3pp cap: top3 full +3pp, ranks 4–8 half, bottom 8 negative full. */
export function matchupDeltaFromRank(rank: number | undefined): number {
  if (rank == null || !Number.isFinite(rank)) return 0;
  if (rank <= 3) return 0.03;
  if (rank <= 8) return 0.015;
  if (rank >= 23) return -0.03;
  if (rank >= 16) return -0.015;
  return 0;
}

export function applyMatchupToModelP(modelP: number, delta: number): number {
  const next = modelP + delta;
  return Math.max(0.05, Math.min(0.95, next));
}