import fs from "fs";
import path from "path";
import { fetchScoreboard, fetchSummary, yyyymmdd } from "../scripts/fetch/espn.js";
import { parseBoxscorePlayerLogs } from "../scripts/espn-parse.js";
import type { PlayerGameLog } from "./types.js";
import type { GameLogCacheFile } from "./game-log-cache.js";
import { mapPool } from "../scripts/lib/concurrency.js";
import { nbaSeasonStartDate, NBA_SEASON_OPENING_UTC } from "./pricing-config.js";

const NBA_SEASON_START = nbaSeasonStartDate();

/** Drop pre-season log rows so backfill stats reflect 2026–27 regular season only. */
export function pruneGameLogCacheBeforeSeason(cache: GameLogCacheFile): number {
  let dropped = 0;
  for (const row of Object.values(cache)) {
    const kept: PlayerGameLog[] = [];
    for (const g of row.logs) {
      if (g.date && g.date < NBA_SEASON_OPENING_UTC) {
        dropped += 1;
      } else {
        kept.push(g);
      }
    }
    row.logs = kept;
  }
  return dropped;
}
export type LeagueGameCacheFile = {
  processedGameIds: string[];
  lastDate?: string;
};

export interface LeagueBackfillReport {
  gamesProcessed: number;
  gamesSkippedCached: number;
  /** Final games played season-to-date (unique ESPN event ids). */
  gamesPlayedSoFar: number;
  /** Final game ids with boxscores in cache. */
  gamesCached: number;
  logRowsAdded: number;
  totalLogRows: number;
  teamsWithLogs: number;
  nullOpponentRows: number;
  lastDateProcessed?: string;
  /** @deprecated use gamesCached */
  nbaGamesInCache?: number;
}

function loadGameCache(p: string): LeagueGameCacheFile {
  if (!fs.existsSync(p)) return { processedGameIds: [] };
  try {
    return JSON.parse(fs.readFileSync(p, "utf8")) as LeagueGameCacheFile;
  } catch {
    return { processedGameIds: [] };
  }
}

function finalEventsOnDate(raw: unknown): {
  id: string;
  date: string;
  homeTeamId: string;
  awayTeamId: string;
}[] {
  const data = raw as {
    events?: {
      id: string;
      date: string;
      status?: { type?: { state?: string; name?: string } };
      competitions?: {
        competitors?: { homeAway: string; team?: { id: string } }[];
      }[];
    }[];
  };
  const out: ReturnType<typeof finalEventsOnDate> = [];
  for (const ev of data.events ?? []) {
    const state = ev.status?.type?.state ?? "";
    const name = (ev.status?.type?.name ?? "").toLowerCase();
    if (state !== "post" && !name.includes("final")) continue;
    const comp = ev.competitions?.[0];
    const home = comp?.competitors?.find((c) => c.homeAway === "home")?.team?.id;
    const away = comp?.competitors?.find((c) => c.homeAway === "away")?.team?.id;
    if (!home || !away) continue;
    out.push({
      id: ev.id,
      date: ev.date?.slice(0, 10) ?? "",
      homeTeamId: home,
      awayTeamId: away,
    });
  }
  return out;
}

export async function runLeagueSeasonBackfill(
  outDir: string,
  logCache: GameLogCacheFile,
  opts: { maxGames?: number; concurrency?: number; until?: Date } = {}
): Promise<LeagueBackfillReport> {
  const gameCachePath = path.join(outDir, "league-game-cache.json");
  const gameCache = loadGameCache(gameCachePath);
  const processed = new Set(gameCache.processedGameIds);
  const until = opts.until ?? new Date();
  const maxGames = opts.maxGames ?? 400;
  const concurrency = opts.concurrency ?? 2;

  let gamesProcessed = 0;
  let gamesSkippedCached = 0;
  let logRowsAdded = 0;

  const tasks: { id: string; date: string; homeTeamId: string; awayTeamId: string }[] = [];

  for (let d = new Date(NBA_SEASON_START); d <= until; d.setUTCDate(d.getUTCDate() + 1)) {
    try {
      const board = await fetchScoreboard(d);
      tasks.push(...finalEventsOnDate(board));
    } catch (e) {
      console.warn(`league backfill scoreboard ${yyyymmdd(d)}:`, e instanceof Error ? e.message : e);
    }
  }

  const uniqueFinal = new Map<string, (typeof tasks)[0]>();
  for (const t of tasks) uniqueFinal.set(t.id, t);
  const gamesPlayedSoFar = uniqueFinal.size;

  const pending = tasks.filter((t) => {
    if (processed.has(t.id)) {
      gamesSkippedCached += 1;
      return false;
    }
    return true;
  });

  const batch = pending.slice(0, maxGames);

  await mapPool(batch, concurrency, async (game) => {
    try {
      const summary = await fetchSummary(game.id);
      const plays = (summary as { plays?: unknown }).plays;
      const rows = parseBoxscorePlayerLogs(summary, plays, {
        gameId: game.id,
        date: game.date,
        homeTeamId: game.homeTeamId,
        awayTeamId: game.awayTeamId,
      });

      for (const { playerId, log: row } of rows) {
        const entry = logCache[playerId] ?? {
          fetchedAt: new Date().toISOString(),
          headshot: "",
          logs: [],
        };
        const existing = entry.logs.find((l) => l.gameId === game.id);
        if (!existing) {
          entry.logs.push(row);
          logRowsAdded += 1;
        } else {
          Object.assign(existing, row);
        }
        entry.logs.sort((a, b) => b.date.localeCompare(a.date));
        logCache[playerId] = entry;
      }

      processed.add(game.id);
      gamesProcessed += 1;
      if (gamesProcessed % 10 === 0) {
        console.log(`league backfill progress: ${gamesProcessed} games, ${logRowsAdded} new log rows`);
      }
    } catch (e) {
      console.warn(`league backfill game ${game.id}:`, e instanceof Error ? e.message : e);
    }
  });

  gameCache.processedGameIds = [...processed];
  gameCache.lastDate = until.toISOString().slice(0, 10);
  fs.writeFileSync(gameCachePath, JSON.stringify(gameCache, null, 2));

  const teams = new Set<string>();
  let nullOpp = 0;
  let totalRows = 0;
  for (const row of Object.values(logCache)) {
    for (const g of row.logs) {
      if (g.date && g.date < NBA_SEASON_OPENING_UTC) continue;
      totalRows += 1;
      if (g.teamId) teams.add(g.teamId);
      if (!g.opponentTeamId) nullOpp += 1;
    }
  }

  const seasonGameIds = new Set<string>();
  for (const row of Object.values(logCache)) {
    for (const g of row.logs) {
      if (g.date && g.date >= NBA_SEASON_OPENING_UTC && g.gameId) {
        seasonGameIds.add(g.gameId);
      }
    }
  }

  const gamesCached = seasonGameIds.size;
  const report: LeagueBackfillReport = {
    gamesProcessed,
    gamesSkippedCached,
    gamesPlayedSoFar,
    gamesCached,
    nbaGamesInCache: gamesCached,
    logRowsAdded,
    totalLogRows: totalRows,
    teamsWithLogs: teams.size,
    nullOpponentRows: nullOpp,
    lastDateProcessed: gameCache.lastDate,
  };

  console.log(
    `league backfill report: games played so far ${gamesPlayedSoFar}, cached ${gamesCached}, ` +
      `teams ${report.teamsWithLogs}/30, null-opponent ${report.nullOpponentRows} ` +
      `(+${gamesProcessed} this run, skip ${gamesSkippedCached}, logs ${report.totalLogRows} +${logRowsAdded})`
  );

  return report;
}