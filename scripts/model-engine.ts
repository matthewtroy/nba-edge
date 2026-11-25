import type {
  InjuryEntry,
  PickLeg,
  PlayerProfile,
  SlateGame,
  MultiBet,
  MetaJson,
} from "../lib/types.js";
import { perMinuteRates, projectedMinutes, projectBaseline } from "../lib/baseline.js";
import {
  applyInjuryRedistribution,
  countOpponentOutBigs,
} from "../lib/injury-redistribution.js";
import { logInjuryAngleLegs } from "../lib/injury-angle-log.js";
import { logSlatePickReport } from "../lib/slate-pick-report.js";
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
import { applyFormGuardExclusions, passesFormGuard } from "../lib/form-guard.js";
import { checkModelSanity, logModelSanity, type ModelSanityResult } from "../lib/model-sanity.js";

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
  matchupSignalsEnabled?: boolean;
  slateTipDate?: string;
}

export function runModel(input: ModelRunInput): {
  picks: PickLeg[];
  multis: MultiBet[];
  multisPayload: MultiBuildResult;
  meta: MetaJson;
  whatChanged: string[];
  modelSanity: ModelSanityResult;
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
  const sanityInputs: { playerName: string; gameLogs: PlayerGameLog[]; projected: import("../lib/baseline.js").ProjectedStats }[] = [];
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

    const teamGame = input.slate.find((g) => g.homeTeamId === teamId || g.awayTeamId === teamId);
    const oppTeamId =
      teamGame?.homeTeamId === teamId ? teamGame.awayTeamId : teamGame?.homeTeamId;
    const oppProfiles: import("../lib/types.js").PlayerProfile[] | undefined = oppTeamId
      ? (byTeam.get(oppTeamId) ?? []).map((p) => ({
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
        }))
      : undefined;
    const opponentOutBigCount = countOpponentOutBigs(
      oppProfiles,
      oppTeamId ? injuriesByTeam.get(oppTeamId) ?? [] : []
    );

    const { adjusted, reasons, boardsShared } = applyInjuryRedistribution(
      {
        players: profiles,
        injuries: teamInjuries,
        gameLogsByPlayer,
        opponentOutBigCount,
      },
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
          playerTeamId: p.teamId,
          playerPosition: p.position,
          seasonMinutes,
          injuryAngle,
          matchupSignalsEnabled: input.matchupSignalsEnabled,
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
      sanityInputs.push({
        playerName: p.name,
        gameLogs: p.gameLogs,
        projected: ctxAdj,
      });
    }
  }

  const modelSanity = checkModelSanity(sanityInputs);
  logModelSanity(modelSanity);

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

  const slateGameIds = new Set(input.slate.map((g) => g.id));
  const slatePicks = picks.filter((leg) => slateGameIds.has(leg.gameId));

  const eligiblePicks = slatePicks.filter((leg) => {
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
  logInjuryAngleLegs(eligiblePicks, input.slateTipDate);
  if (input.matchupSignalsEnabled !== false && matchupLog.length) {
    const pos = [...matchupLog]
      .filter((r) => r.deltaPp > 0)
      .sort((a, b) => b.deltaPp - a.deltaPp)
      .slice(0, 5);
    const neg = [...matchupLog]
      .filter((r) => r.deltaPp < 0)
      .sort((a, b) => a.deltaPp - b.deltaPp)
      .slice(0, 5);
    for (const row of pos) {
      console.log(
        `matchup adjust sample (+): ${row.name} ${row.market} ${row.line}+ +${row.deltaPp.toFixed(1)}pp`
      );
    }
    for (const row of neg) {
      console.log(
        `matchup adjust sample (-): ${row.name} ${row.market} ${row.line}+ ${row.deltaPp.toFixed(1)}pp`
      );
    }
  }
  const logsByPlayer = new Map(input.players.map((p) => [p.id, p.gameLogs]));
  const formGuardExcludedCount = applyFormGuardExclusions(eligiblePicks, logsByPlayer);
  const multisPicks = eligiblePicks.filter(passesFormGuard);

  const multiResult = buildMultis(
    multisPicks,
    input.slate.length,
    300,
    edgeFraction,
    allQ1Exclusions
  );
  const picksById = new Map(eligiblePicks.map((p) => [p.id, p]));
  logSlatePickReport(eligiblePicks, multiResult.bets, picksById);
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
    modelSanityChecked: modelSanity.checked,
    modelSanityFailures: modelSanity.failed,
    formGuardExcludedCount,
  };

  return {
    picks: eligiblePicks,
    multis: multiResult.bets,
    multisPayload: multiResult,
    meta,
    whatChanged: whatChanged,
    modelSanity,
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