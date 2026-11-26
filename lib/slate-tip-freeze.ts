import type { MultiBet, PickLeg, SlateGame } from "./types.js";
import { normalizeEspnGameStatus, slateStatusLabel } from "./slate-espn-status.js";
import { gameStartTimeSydney } from "./sydney.js";

export function gameStarted(game: SlateGame, now: Date): boolean {
  const phase = normalizeEspnGameStatus(game.status);
  if (phase === "live" || phase === "final") return true;
  const tip = Date.parse(game.startTime);
  return Number.isFinite(tip) && tip <= now.getTime();
}

function startedGameIds(slate: SlateGame[], now: Date): Set<string> {
  return new Set(slate.filter((g) => gameStarted(g, now)).map((g) => g.id));
}

/** Merge refreshed ESPN slate: never drop started/final games; refresh status only. */
export function mergeSlateGamesOnRefresh(
  previous: SlateGame[],
  incoming: SlateGame[],
  now: Date
): SlateGame[] {
  const byId = new Map<string, SlateGame>();
  for (const g of previous) {
    byId.set(g.id, g);
  }
  for (const g of incoming) {
    const prev = byId.get(g.id);
  const phase = normalizeEspnGameStatus(g.status);
    const startTime = g.startTime || prev?.startTime || g.startTime;
    const merged: SlateGame = {
      ...(prev ?? g),
      ...g,
      status: slateStatusLabel(phase),
      startTime,
      startTimeSydney:
        gameStartTimeSydney({
          startTime,
          startTimeSydney: g.startTimeSydney || prev?.startTimeSydney,
        }) || g.startTimeSydney || prev?.startTimeSydney || "",
    };
    byId.set(g.id, merged);
  }
  for (const g of previous) {
    if (!byId.has(g.id) && gameStarted(g, now)) {
      byId.set(g.id, { ...g, status: slateStatusLabel(normalizeEspnGameStatus(g.status)) });
    }
  }
  const order = [...previous.map((g) => g.id), ...incoming.map((g) => g.id)];
  const seen = new Set<string>();
  const out: SlateGame[] = [];
  for (const id of order) {
    if (seen.has(id)) continue;
    const row = byId.get(id);
    if (row) {
      seen.add(id);
      out.push(row);
    }
  }
  for (const [id, row] of byId) {
    if (!seen.has(id)) out.push(row);
  }
  return out;
}

/** After tip-off, keep pre-tip leg snapshots (prices, reasons, tags) for started games. */
export function freezePicksAfterTip(
  previous: PickLeg[],
  incoming: PickLeg[],
  slate: SlateGame[],
  now: Date
): PickLeg[] {
  const started = startedGameIds(slate, now);
  if (!started.size || !previous.length) return incoming;
  const prevById = new Map(previous.map((p) => [p.id, p]));
  const out: PickLeg[] = [];
  const kept = new Set<string>();
  for (const leg of incoming) {
    if (started.has(leg.gameId) && prevById.has(leg.id)) {
      out.push(prevById.get(leg.id)!);
      kept.add(leg.id);
    } else {
      out.push(leg);
      kept.add(leg.id);
    }
  }
  for (const leg of previous) {
    if (kept.has(leg.id)) continue;
    if (started.has(leg.gameId)) {
      out.push(leg);
    }
  }
  return out;
}

function pickMap(legs: PickLeg[]): Map<string, PickLeg> {
  return new Map(legs.map((p) => [p.id, p]));
}

/** Keep multis whose legs still exist after pick freeze; preserve combined prices when odds vanish post-tip. */
export function freezeMultisAfterTip(
  previous: MultiBet[],
  incoming: MultiBet[],
  frozenPicks: PickLeg[],
  slate: SlateGame[],
  now: Date
): MultiBet[] {
  const started = startedGameIds(slate, now);
  if (!started.size || !previous.length) return incoming;
  const picks = pickMap(frozenPicks);
  const prevByKey = new Map(
    previous.map((m) => [`${m.type}|${m.legs.join(",")}`, m])
  );
  const out: MultiBet[] = [];
  const seen = new Set<string>();
  for (const m of incoming) {
    const key = `${m.type}|${m.legs.join(",")}`;
    seen.add(key);
    const touchesStarted = m.legs.some((id) => {
      const leg = picks.get(id);
      return leg && started.has(leg.gameId);
    });
    if (touchesStarted) {
      const prev = prevByKey.get(key);
      if (prev) {
        out.push({
          ...m,
          bestBookie: prev.bestBookie ?? m.bestBookie,
          bestBookieTotal: prev.bestBookieTotal ?? m.bestBookieTotal,
        });
        continue;
      }
    }
    out.push(m);
  }
  for (const m of previous) {
    const key = `${m.type}|${m.legs.join(",")}`;
    if (seen.has(key)) continue;
    const stillValid = m.legs.every((id) => picks.has(id));
    const onStarted = m.legs.some((id) => {
      const leg = picks.get(id);
      return leg && started.has(leg.gameId);
    });
    if (stillValid && onStarted) {
      out.push(m);
    }
  }
  return out;
}

export type SlateBundleFreezeInput = {
  previousSlate: SlateGame[];
  incomingSlate: SlateGame[];
  previousPicks: PickLeg[];
  incomingPicks: PickLeg[];
  previousMultis: MultiBet[];
  incomingMultis: MultiBet[];
  now: Date;
};

export function applySlateTipFreeze(input: SlateBundleFreezeInput): {
  slate: SlateGame[];
  picks: PickLeg[];
  multis: MultiBet[];
} {
  const slate = mergeSlateGamesOnRefresh(
    input.previousSlate,
    input.incomingSlate,
    input.now
  );
  const picks = freezePicksAfterTip(
    input.previousPicks,
    input.incomingPicks,
    slate,
    input.now
  );
  const multis = freezeMultisAfterTip(
    input.previousMultis,
    input.incomingMultis,
    picks,
    slate,
    input.now
  );
  return { slate, picks, multis };
}