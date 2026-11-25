import type { GameLogCacheFile } from "./game-log-cache.js";
import { positionBucketLabel } from "./position-label.js";
import { positionBucket } from "./position-bucket.js";
import { logsForModelRates } from "./baseline.js";

export interface PlayerStatRankRow {
  stat: "pts" | "reb" | "ast";
  avg: number;
  rank: number;
  total: number;
  posLabel: string;
}

export type PlayerPositionRankMap = Map<string, Partial<Record<"pts" | "reb" | "ast", PlayerStatRankRow>>>;

/** Season L10 per-game averages ranked within G/F/C (league players in cache). */
export function buildPlayerPositionRanks(
  cache: GameLogCacheFile,
  playerMeta: Map<string, { position?: string }>
): PlayerPositionRankMap {
  const byBucketStat = new Map<string, { playerId: string; avg: number }[]>();

  for (const [playerId, row] of Object.entries(cache)) {
    const meta = playerMeta.get(playerId);
    const pos = positionBucket(meta?.position);
    const logs = logsForModelRates(row.logs);
    if (logs.length < 5) continue;
    const n = Math.min(10, logs.length);
    const slice = logs.slice(0, n);
    const sums = { pts: 0, reb: 0, ast: 0 };
    for (const g of slice) {
      sums.pts += g.pts;
      sums.reb += g.reb;
      sums.ast += g.ast;
    }
    for (const stat of ["pts", "reb", "ast"] as const) {
      const key = `${pos}|${stat}`;
      const list = byBucketStat.get(key) ?? [];
      list.push({ playerId, avg: sums[stat] / n });
      byBucketStat.set(key, list);
    }
  }

  const out: PlayerPositionRankMap = new Map();
  for (const [key, list] of byBucketStat) {
    const [pos, stat] = key.split("|") as ["G" | "F" | "C", "pts" | "reb" | "ast"];
    list.sort((a, b) => b.avg - a.avg);
    const total = list.length;
    const posLabel = positionBucketLabel(pos);
    list.forEach((row, i) => {
      const rank = i + 1;
      const playerRows = out.get(row.playerId) ?? {};
      playerRows[stat] = {
        stat,
        avg: Math.round(row.avg * 10) / 10,
        rank,
        total,
        posLabel,
      };
      out.set(row.playerId, playerRows);
    });
  }
  return out;
}