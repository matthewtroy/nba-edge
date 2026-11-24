import type { PickLeg, Market } from "./types.js";
import { normalizePlayerName } from "./player-names.js";
import {
  probMarketOver,
  probDoubleDouble,
  probTripleDouble,
  probComboRebAst,
} from "./distributions.js";
import { q1Share } from "./baseline.js";
import type { ProjectedStats } from "./baseline.js";
import type { PlayerGameLog } from "./types.js";

export const RUNGS: Record<string, number[]> = {
  pts: [5, 10, 15, 20, 25, 30, 35, 40, 45, 50],
  reb: [3, 5, 7, 10, 13, 15],
  ast: [3, 5, 7, 10, 13],
  "3pm": [1, 2, 3, 4, 5],
  q1pts: [3, 5, 7, 10],
  q1reb: [2, 3, 5],
  q1ast: [2, 3, 5],
};

export function fairAndTakeAt(p: number, minEdge = 1.08): { fair: number; takeAt: number; oneInX: number } {
  const fair = Math.round((1 / p) * 100) / 100;
  const takeAt = Math.round(fair * minEdge * 100) / 100;
  const oneInX = Math.round(1 / p);
  return { fair, takeAt, oneInX };
}

export function buildLegsForPlayer(
  ctx: {
    gameId: string;
    team: string;
    opponent: string;
    playerId: string;
    playerName: string;
    headshotUrl: string;
    stats: ProjectedStats;
    logs: PlayerGameLog[];
    reasons: string[];
    tags: string[];
    flags: Partial<PickLeg>;
    bestOdds?: Map<string, { price: number; bookie: string }>;
    oddsPulledAt?: string;
    minEdge: number;
  }
): PickLeg[] {
  const legs: PickLeg[] = [];
  const means = ctx.stats;

  const addLeg = (market: Market, line: number, p: number) => {
    if (p < 0.05 || p > 0.95) return;
    const { fair, takeAt } = fairAndTakeAt(p, ctx.minEdge);
    const id = `${ctx.playerId}-${market}-${line}`;
    const oddKey = `${ctx.playerName}|${market}|${line}`;
    const book =
      ctx.bestOdds?.get(oddKey) ??
      ctx.bestOdds?.get(`${normalizePlayerName(ctx.playerName)}|${market}|${line}`);
    const tags: string[] = [];
    if (p >= 0.72) tags.push("High probability");
    if (book) {
      if (book.price >= takeAt) {
        const implied = 1 / book.price;
        if (p - implied > 0.35) tags.push("Check news");
        else tags.push("Value");
      }
    }

    const reasons = ctx.reasons.slice(0, 3);
    legs.push({
      id,
      gameId: ctx.gameId,
      team: ctx.team,
      opponent: ctx.opponent,
      playerId: ctx.playerId,
      playerName: ctx.playerName,
      headshotUrl: ctx.headshotUrl,
      market,
      line,
      probability: Math.round(p * 1000) / 1000,
      fairPrice: fair,
      takeAt,
      bestPrice: book?.price,
      bestBookie: book?.bookie,
      oddsPulledAt: ctx.oddsPulledAt,
      tags,
      reasons,
      ...ctx.flags,
    });
  };

  for (const market of ["pts", "reb", "ast", "3pm"] as const) {
    const mean = market === "3pm" ? means.threes : means[market];
    for (const line of RUNGS[market === "3pm" ? "3pm" : market]) {
      const p = probMarketOver(market, mean, line);
      addLeg(market === "3pm" ? "3pm" : market, line, p);
    }
  }

  const q1p = means.pts * q1Share(ctx.logs, "pts");
  const q1r = means.reb * q1Share(ctx.logs, "reb");
  const q1a = means.ast * q1Share(ctx.logs, "ast");

  for (const line of RUNGS.q1pts) addLeg("q1pts", line, probMarketOver("q1pts", q1p, line));
  for (const line of RUNGS.q1reb) addLeg("q1reb", line, probMarketOver("q1reb", q1r, line));
  for (const line of RUNGS.q1ast) addLeg("q1ast", line, probMarketOver("q1ast", q1a, line));

  const comboMeans = { pts: means.pts, reb: means.reb, ast: means.ast };
  const pDd = probDoubleDouble(comboMeans);
  const pTd = probTripleDouble(comboMeans);
  const pCombo = probComboRebAst(comboMeans);
  if (pDd >= 0.03) addLeg("dd", 1, pDd);
  if (pTd >= 0.03) addLeg("td", 1, pTd);
  if (pCombo >= 0.03) addLeg("combo", 7, pCombo);

  return legs;
}