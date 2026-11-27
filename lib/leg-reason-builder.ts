import type { Market, PickLeg, PlayerGameLog } from "./types.js";
import type { DefenseRatingsBundle } from "./defense-ratings.js";
import { defenseAllowRow, defenseRankFor, paceRank } from "./defense-ratings.js";
import { MATCHUP_REASONS_ENABLED } from "./pricing-config.js";
import { ordinal, shortTeamName } from "./ordinal.js";
import { positionBucketLabel } from "./position-label.js";
import { positionBucket } from "./position-bucket.js";
import type { PlayerStatRankRow } from "./player-position-rank.js";
import { lastFiveVsLine } from "./leg-history.js";
import {
  type LegReason,
  inferReasonType,
  sortLegReasons,
  reasonsForMarket,
} from "./leg-reason-types.js";
import {
  isInjuryRedistributionReason,
  combineTeammateInjuryReasonForMarket,
} from "./injury-reason.js";
import type { PlayerTrackingDay } from "./player-tracking-cache.js";
import {
  potentialAstReason,
  shotVolumeReason,
  threesVolumeFromLogs,
} from "./player-tracking-fetch.js";
import { houseReasonText } from "./leg-reason-house.js";
import { q1HitRateLast10, q1SeasonHitFraction } from "./leg-history.js";
import { ensureLegReasonMinimum } from "./leg-reason-minimum.js";
import { h2hReasonPhrase } from "./h2h-reason.js";
import { reasonTextHasBannedPhrase } from "./reason-ban.js";
import { gateLegReasons } from "./reason-gate.js";
import {
  formerTeamReasonPhrase,
  seasonCeilingVsOpponentPhrase,
} from "./long-shot-reason.js";

function hitCountL10(
  logs: PlayerGameLog[],
  market: Market,
  line: number
): { hits: number; total: number } | null {
  const sorted = [...logs].sort((a, b) => b.date.localeCompare(a.date));
  let hits = 0;
  let n = 0;
  for (const g of sorted.slice(0, 10)) {
    let v: number | null = null;
    if (market === "3pm") v = g.threes;
    else if (market === "pts" || market === "reb" || market === "ast") v = g[market];
    else if (market.startsWith("q1")) {
      if (market === "q1pts") v = g.q1Pts ?? null;
      else if (market === "q1reb") v = g.q1Reb ?? null;
      else v = g.q1Ast ?? null;
    }
    if (v == null) continue;
    n += 1;
    if (v >= line) hits += 1;
  }
  if (n < 3) return null;
  return { hits, total: n };
}

function matchupPhrase(
  defense: DefenseRatingsBundle | undefined,
  defendingTeamId: string | undefined,
  playerPosition: string | undefined,
  market: Market,
  opponentName?: string
): string | undefined {
  if (!MATCHUP_REASONS_ENABLED || !defense || !defendingTeamId) return undefined;
  const rank = defenseRankFor(defense, defendingTeamId, playerPosition, market);
  if (rank == null || rank > 10) return undefined;
  const row = defenseAllowRow(defense, defendingTeamId, playerPosition, market);
  if (!row) return undefined;
  const opp = shortTeamName(opponentName ?? defendingTeamId);
  const bucket = positionBucket(playerPosition);
  const posLabel = positionBucketLabel(bucket);
  const perGame = Math.round((row.allowedPer48 * 36) / 48 * 10) / 10;
  const statLabel = row.stat === "3pm" ? "3s" : row.stat;
  return `${opp} rank #${rank} in allowing ${statLabel} to ${posLabel} (avg. ${perGame.toFixed(1)})`;
}

function playerRankPhrase(
  market: Market,
  playerId: string | undefined,
  positionRanks: Map<string, Partial<Record<"pts" | "reb" | "ast", PlayerStatRankRow>>> | undefined,
  line: number
): string | undefined {
  if (!playerId || !positionRanks) return undefined;
  const stat =
    market === "reb"
      ? "reb"
      : market === "ast"
        ? "ast"
        : market === "3pm"
          ? undefined
          : "pts";
  if (!stat) return undefined;
  const row = positionRanks.get(playerId)?.[stat];
  if (!row || row.rank > 15 || row.avg < line) return undefined;
  const statWord = stat === "reb" ? "reb" : stat === "ast" ? "ast" : "pts";
  return `Averages ${row.avg.toFixed(1)} ${statWord}, ${ordinal(row.rank)} of ${row.total} ${row.posLabel}`;
}

function pacePhrase(
  defense: DefenseRatingsBundle | undefined,
  teamId: string | undefined,
  defendingTeamId: string | undefined,
  teamName?: string,
  opponentName?: string
): string | undefined {
  if (!MATCHUP_REASONS_ENABLED || !defense || !teamId || !defendingTeamId) return undefined;
  const p1 = paceRank(defense, teamId);
  const p2 = paceRank(defense, defendingTeamId);
  if (p1 == null || p2 == null) return undefined;
  if (p1 <= 10 && p2 <= 10) {
    return "Fast game: both teams top-10 pace";
  }
  return undefined;
}

function formPhrase(logs: PlayerGameLog[], market: Market, line: number): string | undefined {
  const hit = hitCountL10(logs, market, line);
  if (hit != null && hit.hits / hit.total >= 0.6) {
    return `${hit.hits}/${hit.total} at this line`;
  }
  const l5 = lastFiveVsLine(logs, market, line).filter((t) => t !== "na");
  if (l5.length === 5 && l5.every((t) => t === "hit")) return "5/5 at this line";
  return undefined;
}

function avgPhrase(
  logs: PlayerGameLog[],
  market: Market,
  line: number,
  seasonAvg?: { pts: number; reb: number; ast: number; threes: number }
): string | undefined {
  const sorted = [...logs].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 10);
  if (sorted.length < 5) return undefined;
  let sum = 0;
  let n = 0;
  for (const g of sorted) {
    let v: number | null = null;
    if (market === "3pm") v = g.threes;
    else if (market === "pts" || market === "reb" || market === "ast") v = g[market];
    else if (market.startsWith("q1")) {
      if (market === "q1pts") v = g.q1Pts ?? null;
      else if (market === "q1reb") v = g.q1Reb ?? null;
      else v = g.q1Ast ?? null;
    }
    if (v == null) continue;
    sum += v;
    n += 1;
  }
  if (n < 5) return undefined;
  const avg = sum / n;
  if (avg < line) return undefined;
  const statLabel =
    market === "3pm"
      ? "3pm"
      : market === "q1pts"
        ? "Q1 pts"
        : market === "q1reb"
          ? "Q1 reb"
          : market === "q1ast"
            ? "Q1 ast"
            : market;
  const seasonStat =
    market === "3pm"
      ? seasonAvg?.threes
      : market.startsWith("q1")
        ? undefined
        : market === "reb"
          ? seasonAvg?.reb
          : market === "ast"
            ? seasonAvg?.ast
            : seasonAvg?.pts;
  const lastLabel = n === 10 ? "last 10" : `last ${n}`;
  const seasonSuffix =
    seasonStat != null && seasonStat.toFixed(1) !== avg.toFixed(1)
      ? ` (season ${seasonStat.toFixed(1)})`
      : "";
  return `Avg ${avg.toFixed(1)} ${statLabel} ${lastLabel}${seasonSuffix}`;
}

function minutesPhrase(logs: PlayerGameLog[]): string | undefined {
  const sorted = [...logs].sort((a, b) => b.date.localeCompare(a.date));
  if (sorted.length < 10) return undefined;
  const l5 = sorted.slice(0, 5).reduce((s, g) => s + g.minutes, 0) / 5;
  const season =
    sorted.reduce((s, g) => s + g.minutes, 0) / Math.max(1, sorted.length);
  if (l5 < season + 3) return undefined;
  return `Playing more: ${Math.round(l5)} min last 5 (${Math.round(season)} season)`;
}

export function buildLegReasons(input: {
  leg: PickLeg;
  logs: PlayerGameLog[];
  defense?: DefenseRatingsBundle;
  defendingTeamId?: string;
  playerTeamId?: string;
  playerPosition?: string;
  teamName?: string;
  opponentName?: string;
  tracking?: PlayerTrackingDay;
  seedReasons?: LegReason[];
  playerId?: string;
  positionRanks?: Map<string, Partial<Record<"pts" | "reb" | "ast", PlayerStatRankRow>>>;
  seasonAvg?: { pts: number; reb: number; ast: number; threes: number };
  /** Full ESPN logs (incl. prior seasons) for H2H context. */
  h2hLogs?: PlayerGameLog[];
  /** Slate date (YYYY-MM-DD) for season ceiling copy. */
  slateDate?: string;
}): LegReason[] {
  const byType = new Map<string, LegReason>();

  const put = (type: LegReason["type"], text: string) => {
    const t = houseReasonText(text.trim());
    if (!t || byType.has(type) || reasonTextHasBannedPhrase(t)) return;
    byType.set(type, { type, text: t });
  };

  const injurySeeds = (input.seedReasons ?? []).filter(
    (r) => r.type === "injury" || isInjuryRedistributionReason(r.text)
  );
  const combinedInjury = combineTeammateInjuryReasonForMarket(
    injurySeeds,
    input.leg.market
  );
  if (combinedInjury) put("injury", combinedInjury);

  for (const raw of input.seedReasons ?? []) {
    if (raw.type === "injury" || isInjuryRedistributionReason(raw.text)) continue;
    put(raw.type, raw.text);
  }

  const m = input.leg.market;
  const q1Market = m.startsWith("q1");
  if (!q1Market && input.tracking) {
    if (m === "ast") {
      const t = potentialAstReason(input.tracking);
      if (t) put("tracking", t);
    } else if (m === "pts") {
      const t = shotVolumeReason(input.tracking);
      if (t) put("tracking", t);
    } else if (m === "3pm") {
      const t = threesVolumeFromLogs(input.logs);
      if (t) put("tracking", t);
    }
  } else if (m === "3pm") {
    const t = threesVolumeFromLogs(input.logs);
    if (t) put("tracking", t);
  }

  if (!q1Market) {
    const matchup = matchupPhrase(
      input.defense,
      input.defendingTeamId,
      input.playerPosition,
      input.leg.market,
      input.opponentName
    );
    if (matchup) put("matchup", matchup);

    const h2h = h2hReasonPhrase({
      logs: input.h2hLogs ?? input.logs,
      playerId: input.playerId ?? input.leg.playerId,
      defendingTeamId: input.defendingTeamId,
      market: input.leg.market,
      line: input.leg.line,
      opponentName: input.opponentName,
      seasonAvg: input.seasonAvg,
    });
    if (h2h) put("h2h", h2h);

    const rankLine = playerRankPhrase(
      input.leg.market,
      input.playerId ?? input.leg.playerId,
      input.positionRanks,
      input.leg.line
    );
    if (rankLine) put("rank", rankLine);

    const pace = pacePhrase(
      input.defense,
      input.playerTeamId,
      input.defendingTeamId,
      input.teamName,
      input.opponentName
    );
    if (pace) put("pace", pace);
  } else {
    const q1m = input.leg.market as "q1pts" | "q1reb" | "q1ast";
    const season = q1SeasonHitFraction(input.logs, q1m, input.leg.line);
    if (season && season.hits / season.total >= 0.65) {
      put("form", `${season.hits}/${season.total} Q1 at line`);
    } else {
      const rate = q1HitRateLast10(input.logs, q1m, input.leg.line);
      if (rate != null && rate >= 0.7) {
        put("form", `${Math.round(rate * 10)}/10 Q1 at line`);
      }
    }
  }

  const form = q1Market ? undefined : formPhrase(input.logs, input.leg.market, input.leg.line);
  if (form) put("form", form);

  const avg = avgPhrase(
    input.logs,
    input.leg.market,
    input.leg.line,
    input.seasonAvg
  );
  if (avg) put("avg", avg);

  const mins = q1Market ? undefined : minutesPhrase(input.logs);
  if (mins) put("min", mins);

  const pLong = (input.leg.probability ?? 1) < 0.25;
  if (pLong) {
    const ceiling = seasonCeilingVsOpponentPhrase({
      logs: input.h2hLogs ?? input.logs,
      defendingTeamId: input.defendingTeamId,
      opponentName: input.opponentName,
      market: input.leg.market,
      line: input.leg.line,
      slateDate: input.slateDate,
    });
    if (ceiling) put("h2h", ceiling);
    const former = formerTeamReasonPhrase(
      input.leg.tags,
      input.opponentName ?? input.leg.opponent
    );
    if (former) put("angle", former);
  }

  const sorted = sortLegReasons([...byType.values()]);
  const filtered = reasonsForMarket(sorted, input.leg.market);
  let reasons = gateLegReasons(filtered, input.leg.market, 3, input.leg.line);
  reasons = ensureLegReasonMinimum(input.leg, reasons);
  return reasons.slice(0, 3);
}

export function buildLegReasonLine(input: Parameters<typeof buildLegReasons>[0]): string | undefined {
  const reasons = buildLegReasons(input);
  if (!reasons.length) return undefined;
  return reasons
    .slice(0, 2)
    .map((r) => r.text)
    .join(" · ");
}