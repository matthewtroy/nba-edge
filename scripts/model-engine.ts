import type {
  InjuryEntry,
  PickLeg,
  PlayerProfile,
  SlateGame,
  MultiBet,
  MetaJson,
} from "../lib/types.js";
import { perMinuteRates, projectedMinutes, projectBaseline } from "../lib/baseline.js";
import { applyInjuryRedistribution } from "../lib/injury-redistribution.js";
import { applyContextAdjustments } from "../lib/context.js";
import { buildLegsForPlayer } from "../lib/pricing.js";
import { buildMultis, type MultiBuildResult } from "../lib/multis.js";
import { loadAliasMap } from "../lib/player-names.js";
import type { PlayerGameLog } from "../lib/types.js";
import {
  isPlayerExcluded,
  injuriesByPlayerId,
  detectReturningFromNotes,
} from "../lib/player-eligibility.js";
import { buildWhatChanged } from "../lib/what-changed.js";
import { qualifiesStarter } from "../lib/starter-eligibility.js";

export interface ModelPlayer extends PlayerProfile {
  gameId: string;
  opponent: string;
}

export interface ModelRunInput {
  rootDir: string;
  slate: SlateGame[];
  injuries: InjuryEntry[];
  players: ModelPlayer[];
  rosterIds: Set<string>;
  oddsMap?: Map<string, { price: number; bookie: string }>;
  allOddsMap?: Map<string, Record<string, number>>;
  oddsPulledAt?: string;
  minEdge?: number;
  whatChanged?: string[];
  metaSources?: MetaJson["sources"];
  smallSlate?: boolean;
}

export function runModel(input: ModelRunInput): {
  picks: PickLeg[];
  multis: MultiBet[];
  multisPayload: MultiBuildResult;
  meta: MetaJson;
  whatChanged: string[];
} {
  loadAliasMap(input.rootDir);
  const minEdge = input.minEdge ?? 1.08;

  const injMap = injuriesByPlayerId(input.injuries);
  const returning = detectReturningFromNotes(input.injuries);

  const injuriesByTeam = new Map<string, InjuryEntry[]>();
  for (const inj of input.injuries) {
    const arr = injuriesByTeam.get(inj.teamId) ?? [];
    arr.push(inj);
    injuriesByTeam.set(inj.teamId, arr);
  }

  const picks: PickLeg[] = [];
  const byTeam = new Map<string, ModelPlayer[]>();
  for (const p of input.players) {
    const arr = byTeam.get(p.teamId) ?? [];
    arr.push(p);
    byTeam.set(p.teamId, arr);
  }

  for (const [teamId, players] of byTeam) {
    const teamInjuries = injuriesByTeam.get(teamId) ?? [];
    const outIds = new Set(
      teamInjuries
        .filter((i) => i.status === "Out" || i.status === "Doubtful")
        .map((i) => i.playerId)
    );

    const profiles: PlayerProfile[] = players.map((p) => ({
      id: p.id,
      name: p.name,
      teamId: p.teamId,
      teamName: p.teamName,
      position: p.position,
      age: p.age,
      headshotUrl: p.headshotUrl,
      seasonAvgMinutes:
        p.gameLogs.reduce((s, g) => s + g.minutes, 0) / Math.max(1, p.gameLogs.length),
      gameLogs: p.gameLogs,
    }));

    const gameLogsByPlayer = new Map(profiles.map((p) => [p.id, p.gameLogs]));
    const rates = new Map<string, ReturnType<typeof perMinuteRates>>();
    const base = new Map<string, ReturnType<typeof projectBaseline>>();

    for (const p of profiles) {
      if (
        isPlayerExcluded({
          playerId: p.id,
          playerName: p.name,
          teamId: p.teamId,
          gameLogs: p.gameLogs,
          injuriesByPlayer: injMap,
          rosterIds: input.rosterIds,
          returningPlayerIds: returning,
        })
      ) {
        continue;
      }
      const r = perMinuteRates(p.gameLogs);
      if (!r) continue;
      const mins = projectedMinutes(p.gameLogs);
      if (outIds.has(p.id)) {
        if (!base.has(p.id)) base.set(p.id, projectBaseline(r, mins));
        if (!rates.has(p.id)) rates.set(p.id, r);
        continue;
      }
      rates.set(p.id, r);
      base.set(p.id, projectBaseline(r, mins));
    }

    const { adjusted, reasons, boardsShared } = applyInjuryRedistribution(
      { players: profiles, injuries: teamInjuries, gameLogsByPlayer },
      base,
      rates as Map<string, NonNullable<ReturnType<typeof perMinuteRates>>>
    );

    for (const p of players) {
      if (
        isPlayerExcluded({
          playerId: p.id,
          playerName: p.name,
          teamId: p.teamId,
          gameLogs: p.gameLogs,
          injuriesByPlayer: injMap,
          rosterIds: input.rosterIds,
          returningPlayerIds: returning,
        })
      ) {
        continue;
      }
      if (outIds.has(p.id)) continue;
      const adj = adjusted.get(p.id);
      if (!adj) continue;

      const game = input.slate.find((g) => g.id === p.gameId);
      const spread = game?.spread;
      const home = game?.homeTeamId === teamId;
      const b2b = home ? game?.homeB2B : game?.awayB2B;
      const inj = teamInjuries.find((i) => i.playerId === p.id);

      const ctxAdj = applyContextAdjustments(adj, {
        oppFactor: 0.02,
        spread: spread !== undefined ? (home ? spread : -spread) : undefined,
        b2b,
        age: p.age,
      });

      const playerReasons = [...(reasons.get(p.id) ?? [])];
      if (inj?.status === "Questionable") playerReasons.push("voids if out");

      picks.push(
        ...buildLegsForPlayer({
          gameId: p.gameId,
          team: p.teamName,
          opponent: p.opponent,
          playerId: p.id,
          playerName: p.name,
          headshotUrl: p.headshotUrl,
          stats: ctxAdj,
          logs: p.gameLogs,
          reasons: playerReasons,
          tags: [],
          flags: {
            questionable: inj?.status === "Questionable",
            boardsShared: boardsShared.has(p.id),
            b2b,
            blowoutRisk: ctxAdj.blowoutRisk,
            ageB2B: ctxAdj.ageB2B,
            projectedMinutes: ctxAdj.minutes,
            starterEligible: qualifiesStarter(p.gameLogs, ctxAdj.minutes),
          },
          bestOdds: input.oddsMap,
          allOdds: input.allOddsMap,
          oddsPulledAt: input.oddsPulledAt,
          minEdge,
        })
      );
    }
  }

  const eligiblePicks = picks.filter((leg) => {
    const p = input.players.find((x) => x.id === leg.playerId);
    if (!p) return false;
    return !isPlayerExcluded({
      playerId: p.id,
      playerName: p.name,
      teamId: p.teamId,
      gameLogs: p.gameLogs,
      injuriesByPlayer: injMap,
      rosterIds: input.rosterIds,
      returningPlayerIds: returning,
    });
  });

  const multiResult = buildMultis(eligiblePicks, input.slate.length);
  const injuryImpactLog: string[] = [];
  const whatChanged =
    input.whatChanged && input.whatChanged.length
      ? input.whatChanged
      : buildWhatChanged(input.injuries, eligiblePicks, 3, {
          slateGameIds: new Set(input.slate.map((g) => g.id)),
          playerLogsById: new Map(input.players.map((p) => [p.id, p.gameLogs])),
          onSkip: (inj, detail) => {
            injuryImpactLog.push(`${inj.playerName} (${inj.teamName}): ${detail}`);
            console.log(`whatChanged skip ${inj.playerName} (${inj.teamName}): ${detail}`);
          },
        });

  const meta: MetaJson = {
    lastUpdated: new Date().toISOString(),
    oddsLastPulled: input.oddsPulledAt,
    sources: input.metaSources ?? { espn: "ok", nbaOfficial: "ok", odds: "stale" },
    slateSize: input.slate.length,
    smallSlate: input.smallSlate ?? input.slate.length <= 4,
    ...(injuryImpactLog.length ? { injuryImpactLog } : {}),
  };

  return {
    picks: eligiblePicks,
    multis: multiResult.bets,
    multisPayload: multiResult,
    meta,
    whatChanged: whatChanged,
  };
}

export function oddsMapFromRecord(
  record: Record<string, { price: number; bookie: string }>
): Map<string, { price: number; bookie: string }> {
  return new Map(Object.entries(record));
}

export function oddsMapToRecord(
  map: Map<string, { price: number; bookie: string }>
): Record<string, { price: number; bookie: string }> {
  return Object.fromEntries(map);
}