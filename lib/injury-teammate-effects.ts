import type { InjuryEntry, InjuryTeammateEffect, PlayerGameLog, PlayerProfile } from "./types.js";
import {
  perMinuteRates,
  projectedMinutes,
  projectBaseline,
  type PerMinuteRates,
  type ProjectedStats,
} from "./baseline.js";
import { applyInjuryRedistribution } from "./injury-redistribution.js";
import { isOutOrDoubtful } from "./injury-match.js";
import { isMeaningfulRotation } from "./rotation.js";

export type PlayerWithLogs = Pick<
  PlayerProfile,
  "id" | "name" | "teamId" | "teamName" | "position"
> & { gameLogs: PlayerGameLog[] };

function baselineForTeam(
  players: PlayerWithLogs[]
): { base: Map<string, ProjectedStats>; rates: Map<string, PerMinuteRates> } {
  const base = new Map<string, ProjectedStats>();
  const rates = new Map<string, PerMinuteRates>();
  for (const p of players) {
    const r = perMinuteRates(p.gameLogs);
    if (!r) continue;
    rates.set(p.id, r);
    base.set(p.id, projectBaseline(r, projectedMinutes(p.gameLogs)));
  }
  return { base, rates };
}

function effectsForInjury(
  inj: InjuryEntry,
  teammates: PlayerWithLogs[],
  gameLogsByPlayer: Map<string, PlayerGameLog[]>,
  base: Map<string, ProjectedStats>,
  rates: Map<string, PerMinuteRates>
): InjuryTeammateEffect[] {
  const injured = teammates.find((p) => p.id === inj.playerId);
  if (!injured || !isMeaningfulRotation(injured.gameLogs)) return [];

  const profiles: PlayerProfile[] = teammates.map((p) => ({
    id: p.id,
    name: p.name,
    teamId: p.teamId,
    teamName: p.teamName,
    position: p.position,
    headshotUrl: "",
    seasonAvgMinutes:
      p.gameLogs.reduce((s, g) => s + g.minutes, 0) / Math.max(1, p.gameLogs.length),
    gameLogs: p.gameLogs,
  }));

  const baseCopy = new Map(
    [...base].map(([id, v]) => [id, { ...v }] as const)
  );
  const { adjusted } = applyInjuryRedistribution(
    {
      players: profiles,
      injuries: [{ ...inj, status: "Out" }],
      gameLogsByPlayer,
    },
    baseCopy,
    rates
  );

  const out: InjuryTeammateEffect[] = [];
  const statKeys = ["pts", "reb", "ast", "threes"] as const;
  for (const [id, after] of adjusted) {
    const before = base.get(id);
    if (!before || before.minutes < 12) continue;
    const p = teammates.find((x) => x.id === id);
    if (!p || id === inj.playerId) continue;
    for (const stat of statKeys) {
      const delta = after[stat] - before[stat];
      if (Math.abs(delta) < 0.5) continue;
      out.push({
        playerId: id,
        playerName: p.name,
        stat,
        delta: Math.round(delta * 10) / 10,
      });
    }
  }
  return out.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
}

/** Attach pipeline teammate stat deltas to Out/Doubtful rows (does not mutate legs). */
export function attachTeammateEffectsToInjuries(
  injuries: InjuryEntry[],
  players: PlayerWithLogs[]
): InjuryEntry[] {
  const byTeam = new Map<string, PlayerWithLogs[]>();
  for (const p of players) {
    const arr = byTeam.get(p.teamId) ?? [];
    arr.push(p);
    byTeam.set(p.teamId, arr);
  }
  const gameLogsByPlayer = new Map(players.map((p) => [p.id, p.gameLogs]));

  return injuries.map((inj) => {
    if (!isOutOrDoubtful(inj.status)) return inj;
    const teamPlayers = byTeam.get(inj.teamId);
    if (!teamPlayers?.length) return inj;
    const { base, rates } = baselineForTeam(teamPlayers);
    if (!base.size) return inj;
    const teammateEffects = effectsForInjury(
      inj,
      teamPlayers,
      gameLogsByPlayer,
      base,
      rates
    );
    if (!teammateEffects.length) return inj;
    return { ...inj, teammateEffects };
  });
}