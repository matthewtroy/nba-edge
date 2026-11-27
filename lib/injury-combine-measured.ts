import type { InjuryEntry, PlayerGameLog, PlayerProfile } from "./types.js";
import type { PerMinuteRates, ProjectedStats } from "./baseline.js";
import { playerLastName } from "./player-last-name.js";
import { isMeaningfulRotation } from "./rotation.js";
import type { InjuryCombineLogEntry, InjuryCombineOutSplit } from "./injury-combine-log-ui.js";

type MeasuredStat = "pts" | "reb" | "ast";

const STAT_THRESH: Record<MeasuredStat, number> = { pts: 0.5, reb: 1, ast: 1 };

function sharedGamesWithInjured(
  tmLogs: PlayerGameLog[],
  injuredGameIds: Set<string>
): number {
  return tmLogs.filter((g) => injuredGameIds.has(g.gameId)).length;
}

function gamesWithoutInjured(
  injuredId: string,
  teammates: PlayerProfile[],
  logs: Map<string, PlayerGameLog[]>
): number {
  const injuredLogs = logs.get(injuredId) ?? [];
  const injuredGameIds = new Set(injuredLogs.map((g) => g.gameId));
  if (teammates.length === 0) return 0;
  const t0 = logs.get(teammates[0]!.id) ?? [];
  return t0.filter((g) => !injuredGameIds.has(g.gameId)).length;
}

function injuryAbsentInGame(
  injuredId: string,
  gameId: string,
  logs: Map<string, PlayerGameLog[]>
): boolean {
  const injuredLogs = logs.get(injuredId) ?? [];
  return !injuredLogs.some((g) => g.gameId === gameId);
}

function jointWithoutGames(
  tmLogs: PlayerGameLog[],
  injuredIds: string[],
  logs: Map<string, PlayerGameLog[]>
): PlayerGameLog[] {
  return tmLogs.filter((g) =>
    injuredIds.every((id) => injuryAbsentInGame(id, g.gameId, logs))
  );
}

function jointWithGames(
  tmLogs: PlayerGameLog[],
  injuredIds: string[],
  logs: Map<string, PlayerGameLog[]>
): PlayerGameLog[] {
  return tmLogs.filter((g) =>
    injuredIds.some((id) => !injuryAbsentInGame(id, g.gameId, logs))
  );
}

function perMinuteAvg(games: PlayerGameLog[], key: MeasuredStat | "threes"): number {
  if (!games.length) return 0;
  return (
    games.reduce((s, g) => s + g[key], 0) /
    Math.max(1, games.reduce((s, g) => s + g.minutes, 0))
  );
}

export function measuredSplitEffect(
  tmLogs: PlayerGameLog[],
  injuredGameIds: Set<string>,
  cur: ProjectedStats,
  stat: MeasuredStat,
  fallbackRate: number
): { effect: number; n: number } {
  const withGames = tmLogs.filter((g) => injuredGameIds.has(g.gameId));
  const withoutGames = tmLogs.filter((g) => !injuredGameIds.has(g.gameId));
  const n = withoutGames.length;
  if (n < 1) return { effect: 0, n: 0 };

  const rateWith =
    withGames.length > 0 ? perMinuteAvg(withGames, stat) : fallbackRate;
  const rateWithout = perMinuteAvg(withoutGames, stat);
  const diff = rateWithout - rateWith;
  const shrink = (diff * n) / (n + 5);
  const raw = shrink * cur.minutes;
  if (raw <= 0) return { effect: 0, n };
  const cap = cur[stat] * 0.25;
  const effect = Math.min(raw, cap);
  return { effect: effect >= STAT_THRESH[stat] ? effect : 0, n };
}

export function genericOutStatBump(
  injuredRates: PerMinuteRates,
  injuredMins: number,
  teammates: PlayerProfile[],
  adjusted: Map<string, ProjectedStats>,
  tm: PlayerProfile,
  stat: MeasuredStat
): number {
  const cur = adjusted.get(tm.id);
  if (!cur) return 0;
  const totalMins = teammates.reduce(
    (s, p) => s + (adjusted.get(p.id)?.minutes ?? 0),
    0
  );
  if (totalMins <= 0) return 0;
  const share = cur.minutes / totalMins;
  let bump = 0;
  if (stat === "pts") {
    const totalPts = teammates.reduce((s, p) => s + (adjusted.get(p.id)?.pts ?? 0), 0);
    const ptShare = totalPts > 0 ? cur.pts / totalPts : share;
    bump = Math.min(injuredRates.pts * injuredMins * ptShare, cur.pts * 0.25);
  } else if (stat === "reb") {
    const totalReb = teammates.reduce((s, p) => s + (adjusted.get(p.id)?.reb ?? 0), 0);
    const rebShare = totalReb > 0 ? cur.reb / totalReb : share;
    bump = Math.min(injuredRates.reb * injuredMins * rebShare, cur.reb * 0.25);
  } else {
    const totalAst = teammates.reduce((s, p) => s + (adjusted.get(p.id)?.ast ?? 0), 0);
    const astShare = totalAst > 0 ? cur.ast / totalAst : share;
    bump = Math.min(injuredRates.ast * injuredMins * astShare, cur.ast * 0.25);
  }
  return bump >= STAT_THRESH[stat] ? bump : 0;
}

export type ResolvedOut = {
  inj: InjuryEntry;
  profile: PlayerProfile;
  gamesWithout: number;
  injuredGameIds: Set<string>;
};

export function applyMeasuredOutCombines(input: {
  teammates: PlayerProfile[];
  resolvedOuts: ResolvedOut[];
  gameLogs: Map<string, PlayerGameLog[]>;
  base: Map<string, ProjectedStats>;
  adjusted: Map<string, ProjectedStats>;
  rates: Map<string, PerMinuteRates>;
  reasons: Map<string, string[]>;
  slateDate?: string;
}): InjuryCombineLogEntry[] {
  const logEntries: InjuryCombineLogEntry[] = [];
  const { resolvedOuts } = input;
  if (!resolvedOuts.length) return logEntries;

  const injuredIds = resolvedOuts.map((o) => o.profile.id);
  const multiOut = resolvedOuts.length >= 2;
  const jointByTeammate = new Map<
    string,
    { jointN: number; withoutGames: PlayerGameLog[]; withGames: PlayerGameLog[] }
  >();
  if (multiOut) {
    for (const tm of input.teammates) {
      const tmLogs = input.gameLogs.get(tm.id) ?? [];
      jointByTeammate.set(tm.id, {
        jointN: jointWithoutGames(tmLogs, injuredIds, input.gameLogs).length,
        withoutGames: jointWithoutGames(tmLogs, injuredIds, input.gameLogs),
        withGames: jointWithGames(tmLogs, injuredIds, input.gameLogs),
      });
    }
  }

  for (const tm of input.teammates) {
    const cur = input.adjusted.get(tm.id);
    const baseline = input.base.get(tm.id);
    if (!cur || !baseline || cur.minutes < 12) continue;
    const tmLogs = input.gameLogs.get(tm.id) ?? [];
    const r = input.rates.get(tm.id);
    if (!r) continue;

    for (const stat of ["pts", "reb", "ast"] as const) {
      const splits: InjuryCombineOutSplit[] = [];

      for (const out of resolvedOuts) {
        const shared = sharedGamesWithInjured(tmLogs, out.injuredGameIds);
        let effect = 0;
        let n = 0;
        if (out.gamesWithout >= 3) {
          const m = measuredSplitEffect(
            tmLogs,
            out.injuredGameIds,
            cur,
            stat,
            r[stat]
          );
          effect = m.effect;
          n = m.n;
        } else {
          const injuredRates = input.rates.get(out.profile.id);
          const injuredMins = input.base.get(out.profile.id)?.minutes ?? 0;
          if (injuredRates && injuredMins > 0) {
            effect = genericOutStatBump(
              injuredRates,
              injuredMins,
              input.teammates,
              input.adjusted,
              tm,
              stat
            );
            n = out.gamesWithout;
          }
        }
        if (effect <= 0) continue;
        if (shared >= 3) {
          splits.push({
            playerId: out.profile.id,
            playerName: out.inj.playerName ?? out.profile.name,
            stat,
            n,
            individualEffect: Math.round(effect * 10) / 10,
          });
        }
      }

      if (!splits.length) continue;

      const jointSplit = jointByTeammate.get(tm.id);
      const jointN = jointSplit?.jointN ?? 0;
      let method: "joint" | "sum" = "sum";
      let combined = splits.reduce((s, p) => s + p.individualEffect, 0);
      let applied = Math.min(combined, baseline[stat] * 0.25);

      if (multiOut && jointN >= 2 && jointSplit) {
        const { withoutGames, withGames } = jointSplit;
        const rateWith =
          withGames.length > 0 ? perMinuteAvg(withGames, stat) : r[stat];
        const rateWithout = perMinuteAvg(withoutGames, stat);
        const diff = rateWithout - rateWith;
        const shrink = (diff * jointN) / (jointN + 5);
        const raw = shrink * cur.minutes;
        if (raw > 0) {
          method = "joint";
          combined = raw;
          applied = Math.min(raw, baseline[stat] * 0.25);
        }
      }

      if (applied < STAT_THRESH[stat]) continue;
      cur[stat] += applied;
      input.adjusted.set(tm.id, cur);

      for (const split of splits) {
        const last = playerLastName(split.playerName);
        addReason(input.reasons, tm.id, `${last} out: +${split.individualEffect.toFixed(1)} ${stat}`);
      }

      if (multiOut && input.slateDate) {
        logEntries.push({
          slateDate: input.slateDate,
          playerId: tm.id,
          playerName: tm.name,
          stat,
          outSplits: splits,
          method,
          jointN: method === "joint" ? jointN : undefined,
          combinedBoost: Math.round(combined * 10) / 10,
          appliedBoost: Math.round(applied * 10) / 10,
          loggedAt: new Date().toISOString(),
        });
      }
    }
  }

  return logEntries;
}

function addReason(map: Map<string, string[]>, id: string, text: string) {
  const arr = map.get(id) ?? [];
  if (arr.length < 3 && !arr.includes(text)) arr.push(text);
  map.set(id, arr);
}

export function resolveOutInjuries(
  outInjuries: InjuryEntry[],
  players: PlayerProfile[],
  gameLogs: Map<string, PlayerGameLog[]>,
  teammatesSample: PlayerProfile[]
): ResolvedOut[] {
  const resolved: ResolvedOut[] = [];
  for (const inj of outInjuries) {
    let injured = players.find((p) => p.id === inj.playerId);
    if (!injured && inj.playerName) {
      const norm = inj.playerName.toLowerCase();
      injured = players.find((p) => p.name.toLowerCase() === norm);
    }
    if (!injured) continue;
    const injLogs = gameLogs.get(injured.id) ?? [];
    if (!isMeaningfulRotation(injLogs)) continue;
    const injuredGameIds = new Set(injLogs.map((g) => g.gameId));
    const mates = teammatesSample.filter((p) => p.id !== injured.id);
    const gamesWithout = gamesWithoutInjured(injured.id, mates, gameLogs);
    resolved.push({ inj, profile: injured, gamesWithout, injuredGameIds });
  }
  return resolved;
}