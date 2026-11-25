import type { HistoryJson, MultiType } from "./types.js";
import type { ResultsJson } from "./results-types.js";
import type { SettledLegRow } from "./settle-core.js";

const BET_LABELS: Record<MultiType, string> = {
  mainPlay: "Main Play",
  booster: "Booster",
  q1Multi: "Q1 Multi",
  crossGameSgm: "Cross-Game SGM",
  boostSgm: "Boost SGM",
  longshot: "Longshot",
};

function withinDays(isoDate: string, ref: string, days: number): boolean {
  const a = new Date(isoDate + "T12:00:00Z").getTime();
  const b = new Date(ref + "T12:00:00Z").getTime();
  return Math.abs(a - b) <= days * 86400000;
}

export function buildResultsJson(input: {
  officialLegs: SettledLegRow[];
  history: HistoryJson;
  now?: Date;
}): ResultsJson {
  const now = input.now ?? new Date();
  const ref = now.toISOString().slice(0, 10);
  const official = input.officialLegs.filter((l) => l.result !== "void");
  const wins = official.filter((l) => l.result === "won").length;
  const losses = official.filter((l) => l.result === "lost").length;
  const voids = input.officialLegs.filter((l) => l.result === "void").length;

  const byBetType: ResultsJson["official"]["byBetType"] = {};
  for (const leg of input.officialLegs) {
    const key = BET_LABELS[leg.betType] ?? leg.betType;
    const row = byBetType[key] ?? { won: 0, lost: 0, void: 0, legs: 0 };
    row.legs += 1;
    if (leg.result === "won") row.won += 1;
    else if (leg.result === "lost") row.lost += 1;
    else row.void += 1;
    byBetType[key] = row;
  }

  const last14d = input.officialLegs.filter((l) => withinDays(l.slateDate, ref, 14));

  const tagHitRates: Record<string, { hits: number; total: number }> = {};
  for (const leg of input.officialLegs.filter((l) => l.result !== "void")) {
    for (const tag of leg.tags) {
      const row = tagHitRates[tag] ?? { hits: 0, total: 0 };
      row.total += 1;
      if (leg.result === "won") row.hits += 1;
      tagHitRates[tag] = row;
    }
  }

  const valueLegs = input.officialLegs.filter(
    (l) => l.tags.includes("Value") && l.bestPrice != null && l.result !== "void"
  );
  let valueRoi: number | null = null;
  if (valueLegs.length) {
    let profit = 0;
    for (const l of valueLegs) {
      const stake = 1;
      if (l.result === "won") profit += stake * ((l.bestPrice ?? 1) - 1);
      else if (l.result === "lost") profit -= stake;
    }
    valueRoi = profit / valueLegs.length;
  }

  const shadowLegs = input.officialLegs.filter((l) => l.result !== "void");
  let brierShadow: number | null = null;
  if (shadowLegs.length) {
    let sum = 0;
    for (const l of shadowLegs) {
      const y = l.result === "won" ? 1 : 0;
      const p = l.probability;
      sum += (p - y) ** 2;
    }
    brierShadow = sum / shadowLegs.length;
  }

  return {
    updatedAt: now.toISOString(),
    official: {
      record: {
        won: wins,
        lost: losses,
        void: voids,
        roi:
          wins + losses > 0
            ? (wins - losses) / Math.max(1, wins + losses)
            : 0,
      },
      byBetType,
      last14dLegs: last14d.length,
    },
    model: {
      calibration: input.history.calibration,
      valueRoi,
      brierShadow,
      tagHitRates,
    },
    legs: input.officialLegs,
  };
}