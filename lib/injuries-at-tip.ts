import type { InjuryEntry, SlateGame } from "./types.js";
import { gameStarted } from "./slate-tip-freeze.js";
import { injuriesByPlayerId } from "./player-eligibility.js";
import {
  preTipInjurySnapshot,
  mergeInjuriesReportTime,
  injuryRowKey,
} from "./injury-tip-freeze.js";

/** Persist pre-tip injury rows when games have started (pipeline + viewer freeze seed). */
export function refreshInjuriesAtTip(
  existing: InjuryEntry[] | undefined,
  history: InjuryEntry[],
  slate: SlateGame[],
  now: Date
): InjuryEntry[] {
  const byPlayer = new Map<string, InjuryEntry>();
  for (const row of existing ?? []) {
    byPlayer.set(injuryRowKey(row), row);
  }
  for (const game of slate) {
    if (!gameStarted(game, now)) continue;
    const tipMs = Date.parse(game.startTime);
    if (!Number.isFinite(tipMs)) continue;
    const keys = new Set(
      history.filter((e) => e.gameId === game.id).map(injuryRowKey)
    );
    for (const key of keys) {
      const candidates = history.filter((e) => injuryRowKey(e) === key);
      const snap = preTipInjurySnapshot(candidates, tipMs);
      if (snap) {
        byPlayer.set(key, { ...snap, gameId: game.id });
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

/**
 * Started games with no at-tip rows yet take their rows from the last data commit before
 * that game's tip. Feed rows carry the run's wall clock, so a post-tip run cannot tell
 * which of them were known before tip.
 */
export function seedInjuriesAtTipFromPreTip(
  existing: InjuryEntry[] | undefined,
  slate: SlateGame[],
  now: Date,
  loadPreTipInjuries: (tipIso: string) => InjuryEntry[] | null
): { rows: InjuryEntry[]; seededGameIds: string[] } {
  const rows = [...(existing ?? [])];
  const seededGameIds: string[] = [];
  for (const game of slate) {
    if (!gameStarted(game, now)) continue;
    if (rows.some((r) => r.gameId === game.id)) continue;
    const preTip = loadPreTipInjuries(game.startTime);
    const forGame = (preTip ?? []).filter((r) => r.gameId === game.id);
    if (!forGame.length) continue;
    rows.push(...mergeInjuriesReportTime(forGame));
    seededGameIds.push(game.id);
  }
  return { rows, seededGameIds };
}

/** Injury tab: frozen at-tip rows for started games (feed rows until any exist); live feed pre-tip. */
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
    const atTipRows = (atTip ?? []).filter((r) => r.gameId === game.id);
    if (started.has(game.id) && atTipRows.length) {
      out.push(...atTipRows);
    } else {
      out.push(...live.filter((i) => i.gameId === game.id));
    }
  }
  return mergeInjuriesReportTime(out);
}