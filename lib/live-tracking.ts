import type { MultiBet, PickLeg, SlateGame } from "./types.js";
import type { LiveSourceSnapshot } from "./live-source.js";
import { liveLegView, type LiveLegView } from "./live-leg.js";
import { liveBetView, type LiveBetView } from "./live-bet.js";

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
  for (const leg of legs) {
    const game = games.get(leg.gameId);
    const box = snapshot?.boxesByGame.get(leg.gameId)?.get(leg.playerId);
    const board = boards.get(leg.gameId);
    out.set(
      leg.id,
      liveLegView(leg, game, box, {
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