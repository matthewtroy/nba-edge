import type { Market, PickLeg, PlayerGameLog } from "./types.js";
import type { DefenseRatingsBundle } from "./defense-ratings.js";
import {
  defenseAllowRow,
  defenseRankFor,
  leagueAvgAllowed,
  paceRank,
} from "./defense-ratings.js";
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
import { isInjuryRedistributionReason, formatInjuryReasonLine } from "./injury-reason.js";
import type { PlayerTrackingDay } from "./player-tracking-cache.js";
import {
  potentialAstReason,
  shotVolumeReason,
} from "./player-tracking-fetch.js";

function hitCountL10(logs: PlayerGameLog[], market: Market, line: number): number | null {
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
  return hits;
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
  if (rank == null || rank > 8) return undefined;
  const row = defenseAllowRow(defense, defendingTeamId, playerPosition, market);
  if (!row) return undefined;
  const opp = shortTeamName(opponentName ?? defendingTeamId);
  const bucket = positionBucket(playerPosition);
  const posLabel = positionBucketLabel(bucket);
  const statWord =
    row.stat === "reb"
      ? "reb"
      : row.stat === "ast"
        ? "ast"
        : row.stat === "3pm"
          ? "threes"
          : "pts";
  const leagueAvg = leagueAvgAllowed(defense, playerPosition, row.stat);
  const rankPhrase = rank === 1 ? "the most" : `${ordinal(rank)} most`;
  const avgSuffix = leagueAvg != null ? ` (avg ${leagueAvg.toFixed(1)})` : "";
  return `${opp} allow ${row.allowedPer48.toFixed(1)} ${statWord} to ${posLabel}, ${rankPhrase}${avgSuffix}`;
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
  if (p1 <= 8 && p2 <= 8) {
    const a = shortTeamName(teamName ?? teamId);
    const b = shortTeamName(opponentName ?? defendingTeamId);
    return `Pace ${a} #${p1} · ${b} #${p2}`;
  }
  return undefined;
}

function formPhrase(logs: PlayerGameLog[], market: Market, line: number): string | undefined {
  const hits = hitCountL10(logs, market, line);
  if (hits != null && hits >= 7) return `${hits}/10 at line`;
  const l5 = lastFiveVsLine(logs, market, line).filter((t) => t !== "na");
  if (l5.length === 5 && l5.every((t) => t === "hit")) return "5/5 at line";
  return undefined;
}

function avgPhrase(logs: PlayerGameLog[], market: Market, line: number): string | undefined {
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
  const stat = market === "3pm" ? "3pm" : market.replace(/^q1/, "");
  return `L10 ${stat} avg ${avg.toFixed(1)} (above ${line}+ line)`;
}

function minutesPhrase(logs: PlayerGameLog[]): string | undefined {
  const sorted = [...logs].sort((a, b) => b.date.localeCompare(a.date));
  if (sorted.length < 10) return undefined;
  const l5 = sorted.slice(0, 5).reduce((s, g) => s + g.minutes, 0) / 5;
  const p5 = sorted.slice(5, 10).reduce((s, g) => s + g.minutes, 0) / 5;
  const diff = l5 - p5;
  if (diff < 1.5) return undefined;
  return `Min up ${diff.toFixed(1)} L5`;
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
}): LegReason[] {
  const byType = new Map<string, LegReason>();

  const put = (type: LegReason["type"], text: string) => {
    const t = text.trim();
    if (!t || byType.has(type)) return;
    byType.set(type, { type, text: t });
  };

  for (const raw of input.seedReasons ?? []) {
    if (raw.type === "injury" || isInjuryRedistributionReason(raw.text)) {
      const inj = formatInjuryReasonLine(raw.text);
      if (inj && /\+[\d.]+\s*(pts|reb|ast)\b/i.test(inj)) {
        const stat = input.leg.market.replace(/^q1/, "");
        if (
          (stat === "ast" && /\+[\d.]+\s*ast\b/i.test(inj)) ||
          (stat === "reb" && /\+[\d.]+\s*reb|only big|missing \d+ big/i.test(inj)) ||
          (stat === "pts" && /\+[\d.]+\s*pts\b/i.test(inj))
        ) {
          put("injury", inj);
        }
      } else if (inj && /only big|missing \d+ big/i.test(inj)) {
        put("injury", inj);
      }
    } else {
      put(raw.type, raw.text);
    }
  }

  if (input.tracking) {
    const m = input.leg.market;
    if (m === "ast" || m === "q1ast") {
      const t = potentialAstReason(input.tracking);
      if (t) put("tracking", t);
    } else if (input.tracking.source === "espn") {
      const t = shotVolumeReason(input.tracking);
      if (t && (m === "pts" || m === "3pm")) put("tracking", t);
    }
  }

  const matchup = matchupPhrase(
    input.defense,
    input.defendingTeamId,
    input.playerPosition,
    input.leg.market,
    input.opponentName
  );
  if (matchup) put("matchup", matchup);

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

  const form = formPhrase(input.logs, input.leg.market, input.leg.line);
  if (form) put("form", form);

  const avg = avgPhrase(input.logs, input.leg.market, input.leg.line);
  if (avg) put("avg", avg);

  const mins = minutesPhrase(input.logs);
  if (mins) put("min", mins);

  const sorted = sortLegReasons([...byType.values()]);
  return reasonsForMarket(sorted, input.leg.market);
}

export function buildLegReasonLine(input: Parameters<typeof buildLegReasons>[0]): string | undefined {
  const reasons = buildLegReasons(input);
  if (!reasons.length) return undefined;
  return reasons
    .slice(0, 2)
    .map((r) => r.text)
    .join(" · ");
}