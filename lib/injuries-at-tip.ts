import type { InjuryEntry, SlateGame } from "./types.js";
import { gameStarted } from "./slate-tip-freeze.js";
import { injuriesByPlayerId } from "./player-eligibility.js";
import { preTipInjurySnapshot, mergeInjuriesReportTime } from "./injury-tip-freeze.js";

/** Persist pre-tip injury rows when games have started (pipeline + viewer freeze seed). */
export function refreshInjuriesAtTip(
  existing: InjuryEntry[] | undefined,
  history: InjuryEntry[],
  slate: SlateGame[],
  now: Date
): InjuryEntry[] {
  const byPlayer = new Map<string, InjuryEntry>();
  for (const row of existing ?? []) {
    byPlayer.set(row.playerId, row);
  }
  for (const game of slate) {
    if (!gameStarted(game, now)) continue;
    const tipMs = Date.parse(game.startTime);
    if (!Number.isFinite(tipMs)) continue;
    const playerIds = new Set(
      history.filter((e) => e.gameId === game.id).map((e) => e.playerId)
    );
    for (const playerId of playerIds) {
      const candidates = history.filter((e) => e.playerId === playerId);
      const snap = preTipInjurySnapshot(candidates, tipMs);
      if (snap) {
        byPlayer.set(playerId, { ...snap, gameId: game.id });
      }
    }
  }
  return [...byPlayer.values()];
}

export function injuriesAtTipByPlayer(
  atTip: InjuryEntry[] | undefined
): Map<string, InjuryEntry> {
  return injuriesByPlayerId(atTip ?? []);
}

/** Injury tab: frozen at-tip rows for started games; live feed only for games still pre-tip. */
export function injuriesForInjuryPanel(
  live: InjuryEntry[],
  atTip: InjuryEntry[] | undefined,
  slate: SlateGame[],
  now: Date
): InjuryEntry[] {
  const started = new Set(
    slate.filter((g) => gameStarted(g, now)).map((g) => g.id)
  );
  const out: InjuryEntry[] = [];
  for (const game of slate) {
    if (started.has(game.id)) {
      for (const row of atTip ?? []) {
        if (row.gameId === game.id) out.push(row);
      }
    } else {
      out.push(...live.filter((i) => i.gameId === game.id));
    }
  }
  return mergeInjuriesReportTime(out);
}