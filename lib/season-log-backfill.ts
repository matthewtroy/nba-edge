import type { GameLogCacheFile } from "./game-log-cache.js";
import { getCachedLogs, cacheLogsFromRaw } from "./game-log-cache.js";
import { fetchPlayerGameLog } from "../scripts/fetch/espn.js";
import { mapPool } from "../scripts/lib/concurrency.js";

/** One-time polite refresh of roster logs for defense metadata (concurrency 3). */
export async function backfillRosterLogsOnce(
  cache: GameLogCacheFile,
  tasks: { athleteId: string; teamId: string }[],
  now: Date,
  opts?: { concurrency?: number }
): Promise<{ refreshed: number; skipped: number }> {
  const concurrency = opts?.concurrency ?? 3;
  let refreshed = 0;
  let skipped = 0;
  await mapPool(tasks, concurrency, async (task) => {
    const existing = getCachedLogs(cache, task.athleteId, now);
    const needsOpponent = existing?.some((l) => !l.opponentTeamId) ?? true;
    if (!needsOpponent && existing?.length) {
      skipped += 1;
      return;
    }
    try {
      const logRaw = await fetchPlayerGameLog(task.athleteId);
      const headshot = cache[task.athleteId]?.headshot ?? "";
      cacheLogsFromRaw(cache, task.athleteId, logRaw, headshot, now, task.teamId);
      refreshed += 1;
    } catch {
      skipped += 1;
    }
  });
  return { refreshed, skipped };
}