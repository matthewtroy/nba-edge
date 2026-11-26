import type { InjuryEntry, InjuryStatus, SlateGame } from "./types.js";
import { injuriesByPlayerId } from "./player-eligibility.js";
import { freezeInjuriesAtTip, mergeInjuriesReportTime } from "./injury-tip-freeze.js";
import { injuryEntryRecencyMs } from "./injury-report-time.js";
import { gameStarted } from "./slate-tip-freeze.js";
import { injuriesAtTipByPlayer } from "./injuries-at-tip.js";

/** Live injuries for UI badges: newest `reportTime`/`updatedAt` per player; frozen after tip. */
export function injuriesForBadges(
  live: InjuryEntry[],
  opts?: { slate?: SlateGame[]; now?: Date; previous?: InjuryEntry[] }
): InjuryEntry[] {
  let rows = mergeInjuriesReportTime(live);
  const now = opts?.now ?? new Date();
  const atTip = injuriesAtTipByPlayer(opts?.previous);
  if (opts?.slate?.length && opts.previous?.length) {
    rows = freezeInjuriesAtTip(opts.previous, rows, opts.slate, now);
  }
  const map = injuriesByPlayerId(rows);
  if (opts?.slate?.length) {
    for (const game of opts.slate) {
      if (!gameStarted(game, now)) continue;
      for (const [playerId, row] of map) {
        if (row.gameId !== game.id) continue;
        if (!atTip.has(playerId)) {
          map.set(playerId, { ...row, status: "Available" });
        }
      }
    }
  }
  return [...map.values()];
}

/**
 * Prefer live injury feed; optional locked rows only fill players missing from live.
 * Newer `updatedAt` always wins — official-card `injuries` must not override live NBA/ESPN rows.
 */
export function mergeInjuriesNewestFirst(
  live: InjuryEntry[],
  locked?: InjuryEntry[] | null
): InjuryEntry[] {
  const map = injuriesByPlayerId(locked ?? []);
  for (const entry of live) {
    const prev = map.get(entry.playerId);
    if (!prev || injuryEntryRecencyMs(entry) >= injuryEntryRecencyMs(prev)) {
      map.set(entry.playerId, entry);
    }
  }
  return [...map.values()];
}

export function injuryStatusForPlayer(
  injuries: InjuryEntry[],
  playerId: string
): InjuryStatus | undefined {
  return injuriesByPlayerId(injuries).get(playerId)?.status;
}

const BADGE_STATUSES: Set<InjuryStatus> = new Set([
  "Probable",
  "Questionable",
  "Doubtful",
]);

/** Injury statuses that render a row badge (not Available / Out / none). */
export function injuryStatusShowsBadge(
  status?: InjuryStatus
): status is InjuryStatus {
  return status != null && BADGE_STATUSES.has(status);
}

export type InjuryBadgeTone = "muted-green" | "orange" | "red";

export function injuryBadgeTone(status: InjuryStatus): InjuryBadgeTone {
  if (status === "Probable") return "muted-green";
  if (status === "Questionable") return "orange";
  return "red";
}