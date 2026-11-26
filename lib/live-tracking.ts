import type { MultiBet, PickLeg, SlateGame } from "./types.js";
import type { LiveSourceSnapshot } from "./live-source.js";
import { liveLegView, type LiveLegState, type LiveLegView } from "./live-leg.js";
import { liveBetView, type LiveBetView } from "./live-bet.js";
import {
  normalizeEspnGameStatus,
  slateStatusLabel,
  type SlateGamePhase,
} from "./slate-espn-status.js";

const PHASE_RANK: Record<SlateGamePhase, number> = {
  scheduled: 0,
  live: 1,
  final: 2,
};

function slatePhaseFromGame(game: SlateGame): SlateGamePhase {
  return normalizeEspnGameStatus(game.status, game.status);
}

/** Prefer the most advanced phase between persisted slate and ESPN poll. */
export function mergeGamePhase(
  slatePhase: SlateGamePhase,
  espnPhase?: SlateGamePhase
): SlateGamePhase {
  const e = espnPhase ?? "scheduled";
  return PHASE_RANK[slatePhase] >= PHASE_RANK[e] ? slatePhase : e;
}

export function gameForLiveLeg(
  game: SlateGame | undefined,
  espnPhase?: SlateGamePhase
): SlateGame | undefined {
  if (!game) return undefined;
  const slatePhase = slatePhaseFromGame(game);
  const phase = mergeGamePhase(slatePhase, espnPhase);
  if (phase === slatePhase) return game;
  return { ...game, status: slateStatusLabel(phase) };
}

export function slateGameMap(slate: SlateGame[]): Map<string, SlateGame> {
  return new Map(slate.map((g) => [g.id, g]));
}

export function liveBoardByGame(
  snapshot: LiveSourceSnapshot | null
): Map<string, { period: number | null; statusDetail: string }> {
  const m = new Map<string, { period: number | null; statusDetail: string }>();
  for (const g of snapshot?.games ?? []) {
    m.set(g.gameId, { period: g.period, statusDetail: g.statusDetail });
  }
  return m;
}

export function liveViewsForLegs(
  legs: PickLeg[],
  slate: SlateGame[],
  snapshot: LiveSourceSnapshot | null
): Map<string, LiveLegView> {
  const games = slateGameMap(slate);
  const boards = liveBoardByGame(snapshot);
  const out = new Map<string, LiveLegView>();
  const phaseByGame = new Map(
    (snapshot?.games ?? []).map((g) => [g.gameId, g.phase] as const)
  );
  for (const leg of legs) {
    const game = games.get(leg.gameId);
    const phase = phaseByGame.get(leg.gameId);
    const gameForView = gameForLiveLeg(game, phase);
    const box = snapshot?.boxesByGame.get(leg.gameId)?.get(leg.playerId);
    const board = boards.get(leg.gameId);
    out.set(
      leg.id,
      liveLegView(leg, gameForView, box, {
        period: board?.period,
        statusDetail: board?.statusDetail,
      })
    );
  }
  return out;
}

export function liveMultiKey(multi: MultiBet): string {
  return `${multi.type}:${multi.legs.join(",")}`;
}

export function legStatesForMulti(
  multi: MultiBet,
  legViews: Map<string, LiveLegView> | undefined
): LiveLegState[] {
  return multi.legs.map((id) => legViews?.get(id)?.state ?? "pending");
}

export function liveBetViewsForMultis(
  multis: MultiBet[],
  legViews: Map<string, LiveLegView>
): Map<string, LiveBetView> {
  const out = new Map<string, LiveBetView>();
  for (const multi of multis) {
    const key = liveMultiKey(multi);
    const states = multi.legs.map((id) => legViews.get(id)?.state ?? "pending");
    out.set(key, liveBetView(states));
  }
  return out;
}

export function measureLiveTrackingMs(
  legs: PickLeg[],
  slate: SlateGame[],
  snapshot: LiveSourceSnapshot | null,
  multis: MultiBet[]
): number {
  const t0 = performance.now();
  const views = liveViewsForLegs(legs, slate, snapshot);
  liveBetViewsForMultis(multis, views);
  return performance.now() - t0;
}