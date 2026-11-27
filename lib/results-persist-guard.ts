import type { ResultsSlice } from "./results-types.js";
import { BET_LABELS } from "./official-bet-settle.js";

export interface ResultsPersistTotals {
  mainPlayBets: number;
  otherBetsByType: Record<string, number>;
  gamesSgmBets: number;
  singlesLegs: number;
}

export function resultsPersistTotals(slice: ResultsSlice | null): ResultsPersistTotals | null {
  if (!slice) return null;
  const mainPlayBets = slice.official.byBetType[BET_LABELS.mainPlay]?.bets ?? 0;
  const otherBetsByType: Record<string, number> = {};
  for (const [label, row] of Object.entries(slice.official.byBetType)) {
    if (label === BET_LABELS.mainPlay) continue;
    otherBetsByType[label] = row.bets;
  }
  return {
    mainPlayBets,
    otherBetsByType,
    gamesSgmBets: slice.gamesSgm?.bets?.length ?? 0,
    singlesLegs: slice.valueLegs.record.legs,
  };
}

/** Block persist when aggregate results shrink vs origin/data (cumulative record must be monotonic). */
export function resultsPersistShrinkReason(
  prior: ResultsSlice | null,
  next: ResultsSlice | null
): string | null {
  const p = resultsPersistTotals(prior);
  const n = resultsPersistTotals(next);
  if (!p || !n) return null;

  if (n.mainPlayBets < p.mainPlayBets) {
    return `results.json Main Play bets ${n.mainPlayBets} < data branch ${p.mainPlayBets}`;
  }

  for (const [type, priorCount] of Object.entries(p.otherBetsByType)) {
    const nextCount = n.otherBetsByType[type] ?? 0;
    if (nextCount < priorCount) {
      return `results.json Other bets "${type}" ${nextCount} < data branch ${priorCount}`;
    }
  }

  if (n.gamesSgmBets < p.gamesSgmBets) {
    return `results.json Games SGM bets ${n.gamesSgmBets} < data branch ${p.gamesSgmBets}`;
  }

  if (n.singlesLegs < p.singlesLegs) {
    return `results.json Singles legs ${n.singlesLegs} < data branch ${p.singlesLegs}`;
  }

  return null;
}