import type { InjuryEntry, SlateGame } from "./types.js";
import { gameStarted } from "./slate-tip-freeze.js";
import {
  injuryEntryRecencyMs,
  newerInjuryEntry,
} from "./injury-report-time.js";

function tipMsForGame(slate: SlateGame[], gameId: string): number | null {
  const g = slate.find((x) => x.id === gameId);
  if (!g?.startTime) return null;
  const ms = Date.parse(g.startTime);
  return Number.isFinite(ms) ? ms : null;
}

/** Newest injury report at or before tip (reportTime wins over wall-clock updatedAt). */
export function preTipInjurySnapshot(
  candidates: InjuryEntry[],
  tipMs: number
): InjuryEntry | undefined {
  const beforeTip = candidates.filter((c) => injuryEntryRecencyMs(c) <= tipMs);
  if (!beforeTip.length) return undefined;
  return beforeTip.reduce((a, b) => newerInjuryEntry(a, b));
}

/** After game tip, lock injury status for players on that game (badges + rows). */
export function freezeInjuriesAtTip(
  previous: InjuryEntry[],
  incoming: InjuryEntry[],
  slate: SlateGame[],
  now: Date
): InjuryEntry[] {
  const prevByPlayer = new Map<string, InjuryEntry>();
  for (const e of previous) {
    const key = injuryRowKey(e);
    const cur = prevByPlayer.get(key);
    if (!cur || injuryEntryRecencyMs(e) >= injuryEntryRecencyMs(cur)) prevByPlayer.set(key, e);
  }
  const tipMsByGame = new Map(
    slate.map((g) => [g.id, tipMsForGame(slate, g.id)] as const)
  );
  const startedByGame = new Map<string, boolean>();
  for (const g of slate) {
    startedByGame.set(g.id, gameStarted(g, now));
  }
  const out: InjuryEntry[] = [];
  const seen = new Set<string>();
  for (const entry of incoming) {
    const started = startedByGame.get(entry.gameId) === true;
    const key = injuryRowKey(entry);
    const prev = prevByPlayer.get(key);
    const tipMs = tipMsByGame.get(entry.gameId) ?? null;
    if (started) {
      const history = [...previous, ...incoming].filter(
        (e) => injuryRowKey(e) === key
      );
      const snap =
        tipMs != null
          ? preTipInjurySnapshot(history, tipMs) ?? prev ?? entry
          : prev ?? entry;
      out.push({
        ...entry,
        status: snap.status,
        source: snap.source,
        reportTime: snap.reportTime ?? entry.reportTime,
        updatedAt: snap.updatedAt,
      });
    } else {
      out.push(entry);
    }
    seen.add(key);
  }
  for (const entry of previous) {
    const key = injuryRowKey(entry);
    if (seen.has(key)) continue;
    seen.add(key);
    const started = startedByGame.get(entry.gameId) === true;
    if (started) out.push(entry);
  }
  return out;
}

/** Dedupe key for injury rows; some feed rows have no playerId. */
export function injuryRowKey(entry: InjuryEntry): string {
  return entry.playerId || `${entry.teamId}:${entry.playerName}`;
}

export function mergeInjuriesReportTime(
  rows: InjuryEntry[]
): InjuryEntry[] {
  const map = new Map<string, InjuryEntry>();
  for (const entry of rows) {
    const key = injuryRowKey(entry);
    const prev = map.get(key);
    map.set(key, prev ? newerInjuryEntry(entry, prev) : entry);
  }
  return [...map.values()];
}