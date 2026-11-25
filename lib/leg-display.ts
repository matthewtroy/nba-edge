import type { Market, PickLeg, PlayerGameLog } from "./types.js";
import { lastFiveVsLine } from "./leg-history.js";
import { injuryReasonForMarket } from "./injury-reason.js";
import type { DefenseRatingsBundle } from "./defense-ratings.js";
import { defenseRankFor, paceRank } from "./defense-ratings.js";
import { MATCHUP_REASONS_ENABLED } from "./pricing-config.js";
import { ordinal, shortTeamName } from "./ordinal.js";

/** Tags shown on leg rows / sheets (model-only tags stay internal). */
export function visibleLegTags(tags: string[]): string[] {
  return tags.filter((t) => t !== "boards shared");
}

export function visibleLegReasons(reasons: string[]): string[] {
  return reasons.filter(
    (r) => r.toLowerCase() !== "boards shared" && !/voids if out/i.test(r)
  );
}

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

function statLabel(market: Market): string {
  if (market.startsWith("q1")) return market.slice(2);
  if (market === "3pm") return "3pm";
  return market;
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
  const opp = shortTeamName(opponentName ?? defendingTeamId);
  const statWord =
    market === "reb" || market === "q1reb"
      ? "rebounds"
      : market === "ast" || market === "q1ast"
        ? "assists"
        : market === "3pm"
          ? "threes"
          : "points";
  return `${opp} rank ${ordinal(rank)} worst defending ${statWord}`;
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
    return `Pace ${a} ${ordinal(p1)} · ${b} ${ordinal(p2)}`;
  }
  return undefined;
}

function formPhrase(logs: PlayerGameLog[], market: Market, line: number): string | undefined {
  const hits = hitCountL10(logs, market, line);
  if (hits != null && hits >= 7) {
    return `${hits}/10 hits at line`;
  }
  const l5 = lastFiveVsLine(logs, market, line).filter((t) => t !== "na");
  if (l5.length === 5 && l5.every((t) => t === "hit")) {
    return "5/5 hits at line";
  }
  return undefined;
}

/** Up to two reasons, max ~80 chars: injury, matchup/pace, form. */
export function buildLegReasonLine(input: {
  leg: PickLeg;
  logs: PlayerGameLog[];
  defense?: DefenseRatingsBundle;
  defendingTeamId?: string;
  playerTeamId?: string;
  playerPosition?: string;
  teamName?: string;
  opponentName?: string;
}): string | undefined {
  const parts: string[] = [];
  const inj = injuryReasonForMarket(input.leg.reasons, input.leg.market);
  if (inj) parts.push(inj);
  const matchup = matchupPhrase(
    input.defense,
    input.defendingTeamId,
    input.playerPosition,
    input.leg.market,
    input.opponentName
  );
  if (matchup && parts.length < 2) parts.push(matchup);
  else if (parts.length < 2) {
    const pace = pacePhrase(
      input.defense,
      input.playerTeamId,
      input.defendingTeamId,
      input.teamName,
      input.opponentName
    );
    if (pace) parts.push(pace);
  }
  if (parts.length < 2) {
    const form = formPhrase(input.logs, input.leg.market, input.leg.line);
    if (form) parts.push(form);
  }
  if (!parts.length) return undefined;
  return parts.join(" · ").slice(0, 80);
}

/** @deprecated use buildLegReasonLine */
export function buildShortLegReason(leg: PickLeg, logs: PlayerGameLog[]): string | undefined {
  return buildLegReasonLine({
    leg,
    logs,
  });
}

export function countLegsWithInjuryReason(picks: PickLeg[]): number {
  return picks.filter((l) => injuryReasonForMarket(l.reasons, l.market) != null).length;
}