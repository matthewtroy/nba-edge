import type { PickLeg, Market } from "./types.js";
import { normalizePlayerName } from "./player-names.js";
import { legOddsLookupKey } from "./odds.js";
import {
  probMarketOver,
  probDoubleDouble,
  probTripleDouble,
  probComboRebAst,
} from "./distributions.js";
import { q1Share } from "./baseline.js";
import type { ProjectedStats } from "./baseline.js";
import type { PlayerGameLog } from "./types.js";
import {
  blendProbability,
  borrowMarketImplied,
  CHECK_NEWS_PP,
  impliedFromDecimalPrice,
  type PricedRung,
} from "./market-blend.js";
import { lastFiveVsLine, q1HitRateLast10 } from "./leg-history.js";
import { applyMatchupToModelP, matchupDeltaFromRank } from "./matchup-adjust.js";
import {
  buildLegSignals,
  confluenceFromSignals,
  reasonLineFromSignals,
} from "./signals.js";
import type { DefenseRatingsBundle } from "./defense-ratings.js";
import { defenseRankFor } from "./defense-ratings.js";

export const Q1_HIT_RATE_GAP_PP = 0.2;

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
    flags: Partial<PickLeg> & {
      projectedMinutes?: number;
      starterEligible?: boolean;
    };
    bestOdds?: Map<string, { price: number; bookie: string }>;
    allOdds?: Map<string, Record<string, number>>;
    oddsPulledAt?: string;
    minEdge: number;
    q1Exclusions?: string[];
    defense?: DefenseRatingsBundle;
    defendingTeamId?: string;
    playerPosition?: string;
    seasonMinutes?: number;
    injuryAngle?: boolean;
    matchupSignalsEnabled?: boolean;
    matchupLog?: { name: string; market: string; line: number; deltaPp: number }[];
  }
): PickLeg[] {
  const legs: PickLeg[] = [];
  const means = ctx.stats;

  const pricedByMarket = new Map<string, PricedRung[]>();
  if (ctx.bestOdds) {
    for (const [key, val] of ctx.bestOdds) {
      const parts = key.split("|");
      if (parts.length < 3) continue;
      const [name, mkt, lineStr] = parts;
      if (normalizePlayerName(name) !== normalizePlayerName(ctx.playerName)) continue;
      const line = Number(lineStr);
      if (!Number.isFinite(line)) continue;
      const arr = pricedByMarket.get(mkt) ?? [];
      arr.push({ line, price: val.price });
      pricedByMarket.set(mkt, arr);
    }
  }

  const addLeg = (market: Market, line: number, rawModelP: number) => {
    let modelP = rawModelP;
    const mRank =
      ctx.matchupSignalsEnabled !== false && ctx.defense && ctx.defendingTeamId
        ? defenseRankFor(ctx.defense, ctx.defendingTeamId, ctx.playerPosition, market)
        : undefined;
    const delta = ctx.matchupSignalsEnabled === false ? 0 : matchupDeltaFromRank(mRank);
    if (delta !== 0) {
      modelP = applyMatchupToModelP(modelP, delta);
      ctx.matchupLog?.push({
        name: ctx.playerName,
        market,
        line,
        deltaPp: Math.round(delta * 1000) / 10,
      });
    }
    if (modelP < 0.05 || modelP > 0.95) return;
    if (market.startsWith("q1")) {
      const hr = q1HitRateLast10(
        ctx.logs,
        market as "q1pts" | "q1reb" | "q1ast",
        line
      );
      if (hr != null && modelP - hr > Q1_HIT_RATE_GAP_PP) {
        ctx.q1Exclusions?.push(
          `${ctx.playerName} ${market} ${line}+: last-10 Q1 ${(hr * 100).toFixed(0)}% vs model ${(modelP * 100).toFixed(0)}%`
        );
        return;
      }
    }
    const oddKey = legOddsLookupKey(ctx.playerName, market, line);
    const displayKey = `${ctx.playerName}|${market}|${line}`;
    const book =
      ctx.bestOdds?.get(oddKey) ??
      ctx.bestOdds?.get(displayKey);

    let marketP: number | undefined;
    if (book) {
      marketP = impliedFromDecimalPrice(book.price);
    } else {
      marketP = borrowMarketImplied(line, pricedByMarket.get(market) ?? []);
    }

    const finalP =
      marketP != null ? blendProbability(modelP, marketP) : modelP;
    if (finalP < 0.05 || finalP > 0.95) return;

    const { fair, takeAt } = fairAndTakeAt(finalP, ctx.minEdge);
    const id = `${ctx.playerId}-${market}-${line}`;
    const tags: string[] = [];
    if (finalP >= 0.72) tags.push("High probability");
    if (ctx.flags.boardsShared && market === "reb") tags.push("boards shared");
    if (book) {
      if (book.price > fair * 1.6) tags.push("Check prices");
      if (book.price >= takeAt) {
        const implied = impliedFromDecimalPrice(book.price);
        if (finalP - implied > CHECK_NEWS_PP) tags.push("Check news");
        else tags.push("Value");
      }
    }

    let bookiePrices =
      ctx.allOdds?.get(oddKey) ?? ctx.allOdds?.get(displayKey);
    if (
      book &&
      (!bookiePrices || !Object.keys(bookiePrices).length)
    ) {
      bookiePrices = { [book.bookie]: book.price };
    }

    const injury = ctx.reasons.filter((r) => /out:/i.test(r));
    const other = ctx.reasons.filter((r) => !/out:/i.test(r));
    const reasons = [...injury, ...other].slice(0, 5);
    const leg: PickLeg = {
      id,
      gameId: ctx.gameId,
      team: ctx.team,
      opponent: ctx.opponent,
      playerId: ctx.playerId,
      playerName: ctx.playerName,
      headshotUrl: ctx.headshotUrl,
      market,
      line,
      probability: Math.round(finalP * 1000) / 1000,
      modelProbability: Math.round(modelP * 1000) / 1000,
      preBlendModelProbability: Math.round(modelP * 1000) / 1000,
      matchupDeltaPp: delta !== 0 ? Math.round(delta * 1000) / 10 : undefined,
      marketProbability:
        marketP != null ? Math.round(marketP * 1000) / 1000 : undefined,
      fairPrice: fair,
      takeAt,
      bestPrice: book?.price,
      bestBookie: book?.bookie,
      bookiePrices,
      oddsPulledAt: ctx.oddsPulledAt,
      tags,
      reasons,
      recentVsLine: lastFiveVsLine(ctx.logs, market, line),
      ...(market.startsWith("q1")
        ? {
            q1Last10HitRate: q1HitRateLast10(
              ctx.logs,
              market as "q1pts" | "q1reb" | "q1ast",
              line
            ) ?? undefined,
          }
        : {}),
      ...ctx.flags,
    };
    const signals = buildLegSignals({
      leg,
      logs: ctx.logs,
      seasonMinutes: ctx.seasonMinutes ?? ctx.flags.projectedMinutes ?? 0,
      defendingTeamId: ctx.defendingTeamId,
      playerPosition: ctx.playerPosition,
      defense: ctx.defense,
      matchupSignalsEnabled: ctx.matchupSignalsEnabled,
      injuryAngle:
        ctx.injuryAngle ??
        ctx.reasons.some((r) => /\+\d|benefit|redistrib/i.test(r)),
    });
    leg.signals = signals;
    leg.confluence = confluenceFromSignals(signals);
    leg.reasonLine = reasonLineFromSignals(signals);
    legs.push(leg);
  };

  for (const market of ["pts", "reb", "ast", "3pm"] as const) {
    const mean = market === "3pm" ? means.threes : means[market];
    for (const line of RUNGS[market === "3pm" ? "3pm" : market]) {
      const p = probMarketOver(market, mean, line);
      addLeg(market === "3pm" ? "3pm" : market, line, p);
    }
  }

  const starterQ1 =
    ctx.flags.starterEligible === true &&
    (ctx.flags.projectedMinutes ?? 0) >= 24;

  if (starterQ1) {
    const q1p = means.pts * q1Share(ctx.logs, "pts");
    const q1r = means.reb * q1Share(ctx.logs, "reb");
    const q1a = means.ast * q1Share(ctx.logs, "ast");

    for (const line of RUNGS.q1pts) addLeg("q1pts", line, probMarketOver("q1pts", q1p, line));
    for (const line of RUNGS.q1reb) addLeg("q1reb", line, probMarketOver("q1reb", q1r, line));
    for (const line of RUNGS.q1ast) addLeg("q1ast", line, probMarketOver("q1ast", q1a, line));
  }

  const comboMeans = { pts: means.pts, reb: means.reb, ast: means.ast };
  const pDd = probDoubleDouble(comboMeans);
  const pTd = probTripleDouble(comboMeans);
  const pCombo = probComboRebAst(comboMeans);
  if (pDd >= 0.03) addLeg("dd", 1, pDd);
  if (pTd >= 0.03) addLeg("td", 1, pTd);
  if (pCombo >= 0.03) addLeg("combo", 7, pCombo);

  return legs;
}