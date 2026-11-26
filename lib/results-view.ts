import type { OfficialBetRow } from "./official-bet-settle.js";
import type { ResultsSlice } from "./results-types.js";
import type { MultiType } from "./types.js";
import { marketLabel } from "./market-label.js";
import type { GamesSgmBetRow } from "./games-sgm-freeze.js";
import { GAMES_SGM_PRESETS } from "./games-sgm-presets.js";

export type ResultsBetKind = MultiType | "gamesSgm";

export interface BetTypeSummary {
  kind: ResultsBetKind;
  label: string;
  won: number;
  lost: number;
  void: number;
  hitRate: number | null;
  avgOdds: number | null;
  staked: number;
  profit: number;
  roi: number | null;
  bets: OfficialBetRow[];
}

/** Compact Results table rows under Main Play, in display order. */
export const OTHER_BET_ROWS: { kind: ResultsBetKind; label: string }[] = [
  { kind: "doubleUp", label: "Double Up" },
  { kind: "boostSgm", label: "Best SGM" },
  { kind: "crossGameSgm", label: "Cross" },
  { kind: "booster", label: "Booster" },
  { kind: "longshot", label: "Longshot" },
  { kind: "q1Multi", label: "Q1" },
];

function round(n: number, dp = 4): number {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
}

interface SettledRow {
  slateDate: string;
  result: string;
  profitUnits: number | null;
  stakeUnits: number;
  publishedCombinedPrice?: number;
}

type RowStats = Omit<BetTypeSummary, "kind" | "label" | "bets">;

function rowStats(rows: SettledRow[]): RowStats {
  let won = 0;
  let lost = 0;
  let voided = 0;
  let staked = 0;
  let profit = 0;
  let oddsSum = 0;
  let oddsN = 0;
  for (const b of rows) {
    if (b.result === "pending") continue;
    if (b.result === "won") won += 1;
    else if (b.result === "lost") lost += 1;
    else voided += 1;
    if (b.profitUnits != null) {
      staked += b.stakeUnits;
      profit += b.profitUnits;
    }
    if (b.publishedCombinedPrice != null && b.publishedCombinedPrice > 1) {
      oddsSum += b.publishedCombinedPrice;
      oddsN += 1;
    }
  }
  const decided = won + lost;
  staked = round(staked);
  profit = round(profit);
  return {
    won,
    lost,
    void: voided,
    hitRate: decided ? won / decided : null,
    avgOdds: oddsN ? round(oddsSum / oddsN, 2) : null,
    staked,
    profit,
    roi: staked > 0 ? profit / staked : null,
  };
}

function newestFirst<T extends { slateDate: string }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => b.slateDate.localeCompare(a.slateDate));
}

export function summarizeBets(
  bets: OfficialBetRow[],
  kind: ResultsBetKind,
  label: string
): BetTypeSummary {
  const mine = newestFirst(bets.filter((b) => b.betType === kind));
  return { kind, label, ...rowStats(mine), bets: mine };
}

export interface GamesSgmFilterSummary extends RowStats {
  filter: string;
  bets: GamesSgmBetRow[];
}

/** All Games-tab SGMs as one Other bets row. */
export function summarizeGamesSgmTotal(bets: GamesSgmBetRow[]): RowStats & { bets: GamesSgmBetRow[] } {
  const mine = newestFirst(bets);
  return { ...rowStats(mine), bets: mine };
}

/** Games-tab SGM results per price filter, in filter order. */
export function summarizeGamesSgms(bets: GamesSgmBetRow[]): GamesSgmFilterSummary[] {
  return GAMES_SGM_PRESETS.map(({ label }) => {
    const mine = newestFirst(bets.filter((b) => b.filter === label));
    return { filter: label, ...rowStats(mine), bets: mine };
  });
}

export interface ResultLegLine {
  text: string;
  result?: string;
}

/** Human leg lines for an expanded bet row (catalog ids or stored descriptions). */
export function betLegLines(
  bet: Pick<OfficialBetRow, "legIds" | "legLabels">,
  results: ResultsSlice
): ResultLegLine[] {
  if (bet.legLabels?.length) return bet.legLabels.map((text) => ({ text }));
  const byId = new Map<string, { playerName: string; market: string; line: number; result: string }>();
  for (const g of results.gradedLegs) byId.set(g.id, g);
  for (const l of results.official.legs) byId.set(l.id, l);
  return bet.legIds.map((id) => {
    const leg = byId.get(id);
    if (!leg) return { text: id };
    return { text: `${leg.playerName} ${marketLabel(leg.market, leg.line)}`, result: leg.result };
  });
}
