import { computeCalibration } from "./grading.js";
import type { HistoryLeg } from "./types.js";
import type { ResultsSlice, StatRow } from "./results-types.js";
import type { SettledLegRow } from "./settle-core.js";
import type { OfficialBetRow } from "./official-bet-settle.js";
import { BET_LABELS as BET_LABEL_MAP } from "./official-bet-settle.js";
import type { GradedProjectionLeg } from "./graded-leg.js";
import type { ValueLegRow } from "./value-leg-track.js";
import { edgeBand } from "./value-leg-track.js";

function emptyStat(): StatRow {
  return { won: 0, lost: 0, void: 0, staked: 0, profit: 0, roi: null };
}

function addBetToStat(row: StatRow & { bets?: number }, bet: OfficialBetRow): void {
  row.bets = (row.bets ?? 0) + 1;
  if (bet.result === "won") row.won += 1;
  else if (bet.result === "lost") row.lost += 1;
  else row.void += 1;
  if (bet.profitUnits != null) {
    row.staked += bet.stakeUnits;
    row.profit += bet.profitUnits;
  }
}

function finishRoi(row: StatRow): void {
  row.roi = row.staked > 0 ? row.profit / row.staked : null;
}

function withinDays(isoDate: string, ref: string, days: number): boolean {
  const a = new Date(isoDate + "T12:00:00Z").getTime();
  const b = new Date(ref + "T12:00:00Z").getTime();
  return Math.abs(a - b) <= days * 86400000;
}

function aggregateValueStats(legs: ValueLegRow[]): ResultsSlice["valueLegs"] {
  const record = {
    ...emptyStat(),
    legs: 0,
    hitRate: null as number | null,
    avgPrice: null as number | null,
    beatMarket: null as number | null,
  };
  const byMarket: ResultsSlice["valueLegs"]["byMarket"] = {};
  const byEdgeBand: ResultsSlice["valueLegs"]["byEdgeBand"] = {};

  let impliedSum = 0;
  let wins = 0;
  let priceSum = 0;

  for (const leg of legs) {
    record.legs += 1;
    if (leg.result === "won") {
      record.won += 1;
      wins += 1;
      record.staked += 1;
      record.profit += leg.price - 1;
    } else if (leg.result === "lost") {
      record.lost += 1;
      record.staked += 1;
      record.profit -= 1;
    }
    priceSum += leg.price;
    impliedSum += 1 / leg.price;

    const mKey = leg.market;
    const mRow = byMarket[mKey] ?? { ...emptyStat(), legs: 0 };
    mRow.legs += 1;
    if (leg.result === "won") {
      mRow.won += 1;
      mRow.staked += 1;
      mRow.profit += leg.price - 1;
    } else if (leg.result === "lost") {
      mRow.lost += 1;
      mRow.staked += 1;
      mRow.profit -= 1;
    }
    finishRoi(mRow);
    byMarket[mKey] = mRow;

    const band = edgeBand(leg.edgeVsFair);
    const bRow = byEdgeBand[band] ?? { ...emptyStat(), legs: 0 };
    bRow.legs += 1;
    if (leg.result === "won") {
      bRow.won += 1;
      bRow.staked += 1;
      bRow.profit += leg.price - 1;
    } else if (leg.result === "lost") {
      bRow.lost += 1;
      bRow.staked += 1;
      bRow.profit -= 1;
    }
    finishRoi(bRow);
    byEdgeBand[band] = bRow;
  }

  finishRoi(record);
  const decided = record.won + record.lost;
  record.hitRate = decided > 0 ? record.won / decided : null;
  record.avgPrice = legs.length ? priceSum / legs.length : null;
  const avgImplied = legs.length ? impliedSum / legs.length : null;
  record.beatMarket =
    avgImplied != null && record.hitRate != null ? record.hitRate - avgImplied : null;

  return { record, byMarket, byEdgeBand, legs };
}

function modelBlock(graded: GradedProjectionLeg[]): ResultsSlice["model"] {
  const resolved = graded.filter((l) => l.result !== "void");
  const historyLegs: HistoryLeg[] = resolved.map((l) => ({
    id: l.id,
    date: l.slateDate,
    probability: l.probability,
    result: l.result === "won" ? "hit" : "miss",
  }));

  let brierLive: number | null = null;
  let brierShadow: number | null = null;
  if (resolved.length) {
    let sumLive = 0;
    let sumShadow = 0;
    let shadowN = 0;
    for (const l of resolved) {
      const y = l.result === "won" ? 1 : 0;
      sumLive += (l.probability - y) ** 2;
      if (l.probabilityMatchupShadow != null) {
        sumShadow += (l.probabilityMatchupShadow - y) ** 2;
        shadowN += 1;
      }
    }
    brierLive = sumLive / resolved.length;
    brierShadow = shadowN ? sumShadow / shadowN : null;
  }

  const tagHitRates: Record<string, { hits: number; total: number }> = {};
  for (const leg of resolved) {
    for (const tag of leg.tags) {
      const row = tagHitRates[tag] ?? { hits: 0, total: 0 };
      row.total += 1;
      if (leg.result === "won") row.hits += 1;
      tagHitRates[tag] = row;
    }
  }

  return {
    calibration: computeCalibration(historyLegs),
    brierLive,
    brierShadow,
    tagHitRates,
  };
}

export function buildResultsSlice(input: {
  officialLegs: SettledLegRow[];
  officialBets: OfficialBetRow[];
  valueLegRows: ValueLegRow[];
  gradedLegs: GradedProjectionLeg[];
  now?: Date;
}): ResultsSlice {
  const now = input.now ?? new Date();
  const ref = now.toISOString().slice(0, 10);

  const record = { ...emptyStat(), bets: 0 };
  const byBetType: ResultsSlice["official"]["byBetType"] = {};

  for (const bet of input.officialBets) {
    addBetToStat(record, bet);
    const key = BET_LABEL_MAP[bet.betType] ?? bet.label;
    const row = byBetType[key] ?? { ...emptyStat(), bets: 0 };
    addBetToStat(row, bet);
    byBetType[key] = row;
  }
  finishRoi(record);
  for (const row of Object.values(byBetType)) finishRoi(row);

  const betsByDate = new Map<string, OfficialBetRow[]>();
  for (const bet of input.officialBets) {
    const list = betsByDate.get(bet.slateDate) ?? [];
    list.push(bet);
    betsByDate.set(bet.slateDate, list);
  }
  const last14d = [...betsByDate.entries()]
    .filter(([d]) => withinDays(d, ref, 14))
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([date, bets]) => ({ date, bets }));

  return {
    updatedAt: now.toISOString(),
    official: {
      record,
      byBetType,
      last14d,
      bets: input.officialBets,
      legs: input.officialLegs,
    },
    valueLegs: aggregateValueStats(input.valueLegRows),
    model: modelBlock(input.gradedLegs),
    gradedLegs: input.gradedLegs,
  };
}