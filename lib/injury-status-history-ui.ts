import type { InjuryStatus } from "./types.js";

export const INJURY_STATUS_HISTORY_FILE = "injury-status-history.json";
export const INJURY_STATUS_TRANSITION_WINDOW_MS = 48 * 60 * 60 * 1000;

export interface InjuryStatusChange {
  playerId: string;
  playerName: string;
  teamId?: string;
  gameId?: string;
  slateDate: string;
  fromStatus: InjuryStatus;
  toStatus: InjuryStatus;
  observedAt: string;
  source?: string;
}

export interface InjuryStatusHistoryFile {
  version: 1;
  changes: InjuryStatusChange[];
}

export function injuryStatusHealthyForTransition(status: InjuryStatus): boolean {
  return status === "Available";
}

/** Latest transition within `windowMs` from a healthy (Available) status. */
export function recentActiveStatusTransition(
  history: InjuryStatusHistoryFile | null | undefined,
  playerId: string,
  now: Date,
  windowMs = INJURY_STATUS_TRANSITION_WINDOW_MS
): InjuryStatusChange | null {
  if (!history?.changes?.length) return null;
  const minMs = now.getTime() - windowMs;
  let best: InjuryStatusChange | null = null;
  let bestMs = -1;
  for (const c of history.changes) {
    if (c.playerId !== playerId) continue;
    if (!injuryStatusHealthyForTransition(c.fromStatus)) continue;
    const ms = Date.parse(c.observedAt);
    if (!Number.isFinite(ms) || ms < minMs) continue;
    if (ms > bestMs) {
      bestMs = ms;
      best = c;
    }
  }
  return best;
}