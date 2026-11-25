import type { PlayerGameLog } from "./types.js";
import { logsForModelRates } from "./baseline.js";

/** Legacy data-branch rows predate `source`; treat unset as ESPN player API. */
export function stampLegacyLogSources(logs: PlayerGameLog[]): PlayerGameLog[] {
  return logs.map((g) => {
    if (g.source === "boxscore") return g;
    if (g.source === "espn") return g;
    return { ...g, source: "espn" as const };
  });
}

export function modelRatesLogCount(logs: PlayerGameLog[]): number {
  return logsForModelRates(stampLegacyLogSources(logs)).length;
}

export function normalizeLogsForPlayer(logs: PlayerGameLog[]): PlayerGameLog[] {
  return stampLegacyLogSources(logs);
}