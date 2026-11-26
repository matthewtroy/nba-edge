import type { CalibrationBucket } from "./types.js";
import type { SettledLegRow } from "./settle-core.js";
import type { GradedProjectionLeg } from "./graded-leg.js";
import type { OfficialBetRow } from "./official-bet-settle.js";
import type { ValueLegRow } from "./value-leg-track.js";
import type { GamesSgmBetRow } from "./games-sgm-freeze.js";

export interface StatRow {
  won: number;
  lost: number;
  void: number;
  staked: number;
  profit: number;
  roi: number | null;
}

export interface ResultsSlice {
  updatedAt: string;
  official: {
    record: StatRow & { bets: number };
    byBetType: Record<string, StatRow & { bets: number }>;
    last14d: { date: string; bets: OfficialBetRow[] }[];
    bets: OfficialBetRow[];
    legs: SettledLegRow[];
  };
  valueLegs: {
    record: StatRow & {
      legs: number;
      hitRate: number | null;
      avgPrice: number | null;
      beatMarket: number | null;
    };
    byMarket: Record<string, StatRow & { legs: number }>;
    byEdgeBand: Record<string, StatRow & { legs: number }>;
    legs: ValueLegRow[];
  };
  model: {
    calibration: CalibrationBucket[];
    brierLive: number | null;
    brierShadow: number | null;
    tagHitRates: Record<string, { hits: number; total: number }>;
  };
  gradedLegs: GradedProjectionLeg[];
  /** Games-tab SGMs frozen at publish, settled per price filter. */
  gamesSgm?: { bets: GamesSgmBetRow[] };
}

/** Root aggregate written to public/data/results.json */
export type ResultsJson = ResultsSlice;