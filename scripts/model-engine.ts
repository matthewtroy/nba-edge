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
import { logMarketBlendSample } from "../lib/market-blend.js";
import { loadAliasMap, normalizePlayerName } from "../lib/player-names.js";
import { legOddsLookupKey } from "../lib/odds.js";
import type { PlayerGameLog } from "../lib/types.js";
import {
  isPlayerExcluded,
  injuriesByPlayerId,
  detectReturningFromNotes,
} from "../lib/player-eligibility.js";
import { buildWhatChanged } from "../lib/what-changed.js";
import { qualifiesStarter } from "../lib/starter-eligibility.js";
import type { DefenseRatingsBundle } from "../lib/defense-ratings.js";

export interface ModelPlayer extends PlayerProfile {
  gameId: string;
  opponent: string;
  opponentTeamId?: string;
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
  defense?: DefenseRatingsBundle;
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
  const allQ1Exclusions: string[] = [];
  const matchupLog: { name: string; market: string; line: number; deltaPp: number }[] = [];
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

      const q1Exclusions: string[] = [];
      const seasonMinutes =
        p.gameLogs.reduce((s, g) => s + g.minutes, 0) / Math.max(1, p.gameLogs.length);
      const injuryAngle = playerReasons.some((r) => /\+\d|benefit|redistrib/i.test(r));
      const newLegs = buildLegsForPlayer({
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
          q1Exclusions,
          defense: input.defense,
          defendingTeamId: p.opponentTeamId,
          playerPosition: p.position,
          seasonMinutes,
          injuryAngle,
          matchupLog,
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
        });
      picks.push(...newLegs);
      allQ1Exclusions.push(...q1Exclusions);
    }
  }

  if (input.allOddsMap?.size) {
    for (const leg of picks) {
      const oddKey = legOddsLookupKey(leg.playerName, leg.market, leg.line);
      const displayKey = `${leg.playerName}|${leg.market}|${leg.line}`;
      const books =
        input.allOddsMap.get(oddKey) ??
        input.allOddsMap.get(displayKey) ??
        input.allOddsMap.get(
          `${normalizePlayerName(leg.playerName)}|${leg.market}|${leg.line}`
        );
      if (books && Object.keys(books).length) {
        leg.bookiePrices = { ...leg.bookiePrices, ...books };
      }
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

  const edgeFraction =
    input.minEdge != null && input.minEdge > 1
      ? input.minEdge - 1
      : input.minEdge != null
        ? input.minEdge
        : 0.08;
  console.log(
    `picks filter: ${picks.length} legs priced → ${eligiblePicks.length} eligible (excluded ${picks.length - eligiblePicks.length})`
  );
  logMarketBlendSample(eligiblePicks);
  if (matchupLog.length) {
    const top = [...matchupLog].sort((a, b) => Math.abs(b.deltaPp) - Math.abs(a.deltaPp)).slice(0, 5);
    for (const row of top) {
      console.log(
        `matchup adjust sample: ${row.name} ${row.market} ${row.line}+ ${row.deltaPp > 0 ? "+" : ""}${row.deltaPp.toFixed(1)}pp`
      );
    }
  }
  const signalUnavailable = input.defense?.unavailable ?? [];
  const topConfluenceLegs = [...eligiblePicks]
    .filter((l) => (l.confluence ?? 0) > 0)
    .sort((a, b) => (b.confluence ?? 0) - (a.confluence ?? 0))
    .slice(0, 10)
    .map((l) => ({
      player: l.playerName,
      market: l.market,
      line: l.line,
      confluence: l.confluence ?? 0,
      reasonLine: l.reasonLine,
    }));
  const multiResult = buildMultis(
    eligiblePicks,
    input.slate.length,
    300,
    edgeFraction,
    allQ1Exclusions
  );
  const injuryImpactLog: string[] = [];
  const whatChanged =
    input.whatChanged && input.whatChanged.length
      ? input.whatChanged
      : buildWhatChanged(input.injuries, eligiblePicks, 3, {
          slateGameIds: new Set(input.slate.map((g) => g.id)),
          slateTeamIds: new Set(
            input.slate.flatMap((g) => [g.homeTeamId, g.awayTeamId])
          ),
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
    ...(allQ1Exclusions.length ? { q1ExclusionLog: allQ1Exclusions.slice(0, 20) } : {}),
    ...(signalUnavailable.length ? { signalUnavailable } : {}),
    ...(topConfluenceLegs.length ? { topConfluenceLegs } : {}),
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