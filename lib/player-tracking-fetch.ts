import type { PlayerGameLog } from "./types.js";
import type { ModelPlayer } from "../scripts/model-engine.js";
import { NBA_STATS_HEADERS } from "./nba-stats-headers.js";
import { normalizePlayerName } from "./player-names.js";
import {
  type PlayerTrackingDay,
  type TrackingCacheFile,
  writeTrackingCache,
} from "./player-tracking-cache.js";
import { probeNbaStats, logTrackingProbe } from "./nba-tracking-probe.js";

const PASSING_URL =
  "https://stats.nba.com/stats/leaguedashptstats?College=&Conference=&Country=&DateFrom=&DateTo=&Division=&DraftPick=&DraftYear=&GameScope=&Height=&ISTRound=&ISTTeam=&LastNGames=10&LeagueID=00&Location=&Month=0&OpponentTeamID=0&Outcome=&PORound=0&PerMode=PerGame&PlayerExperience=&PlayerOrTeam=Player&PlayerPosition=&PtMeasureType=Passing&Season=2025-26&SeasonSegment=&SeasonType=Regular+Season&StarterBench=&TeamID=0&VsConference=&VsDivision=&Weight=";

const REB_URL =
  "https://stats.nba.com/stats/leaguedashptstats?College=&Conference=&Country=&DateFrom=&DateTo=&Division=&DraftPick=&DraftYear=&GameScope=&Height=&ISTRound=&ISTTeam=&LastNGames=10&LeagueID=00&Location=&Month=0&OpponentTeamID=0&Outcome=&PORound=0&PerMode=PerGame&PlayerExperience=&PlayerOrTeam=Player&PlayerPosition=&PtMeasureType=Rebounding&Season=2025-26&SeasonSegment=&SeasonType=Regular+Season&StarterBench=&TeamID=0&VsConference=&VsDivision=&Weight=";

async function fetchPtStats(url: string): Promise<Map<string, Record<string, number>>> {
  const res = await fetch(url, { headers: NBA_STATS_HEADERS, cache: "no-store" });
  if (!res.ok) throw new Error(`NBA PT HTTP ${res.status}`);
  const json = (await res.json()) as {
    resultSets?: { headers: string[]; rowSet: unknown[][] }[];
  };
  const set = json.resultSets?.[0];
  if (!set) throw new Error("NBA PT empty");
  const nameIdx = set.headers.indexOf("PLAYER_NAME");
  const byName = new Map<string, Record<string, number>>();
  for (const row of set.rowSet) {
    const name = String(row[nameIdx] ?? "");
    if (!name) continue;
    const stats: Record<string, number> = {};
    set.headers.forEach((h, i) => {
      const v = row[i];
      if (typeof v === "number") stats[h] = v;
    });
    byName.set(normalizePlayerName(name), stats);
  }
  return byName;
}

function espnStandInFromLogs(playerId: string, name: string, logs: PlayerGameLog[]): PlayerTrackingDay {
  const sorted = [...logs].sort((a, b) => b.date.localeCompare(a.date));
  const l10 = sorted.slice(0, 10);
  let fga = 0;
  let mins = 0;
  let priorFga = 0;
  let priorMins = 0;
  for (const g of l10.slice(0, 5)) {
    fga += g.fga ?? 0;
    mins += g.minutes;
  }
  for (const g of l10.slice(5, 10)) {
    priorFga += g.fga ?? 0;
    priorMins += g.minutes;
  }
  const rate = mins > 0 ? fga / mins : 0;
  const priorRate = priorMins > 0 ? priorFga / priorMins : rate;
  return {
    playerId,
    playerName: name,
    fgaPerMinL10: rate,
    source: "espn",
    cachedAt: new Date().toISOString(),
    ...(priorRate > 0 && rate > priorRate * 1.05 ? {} : {}),
  };
}

export function shotVolumeReason(tr: PlayerTrackingDay): string | undefined {
  if (tr.source !== "espn" || tr.fgaPerMinL10 == null) return undefined;
  return "Shot volume up L5 vs prior (ESPN proxy)";
}

export function potentialAstReason(tr: PlayerTrackingDay): string | undefined {
  if (tr.potentialAst == null) return undefined;
  return `${tr.potentialAst.toFixed(1)} potential ast (L10)`;
}

export async function ensurePlayerTracking(
  rootDir: string,
  slateDate: string,
  players: ModelPlayer[]
): Promise<TrackingCacheFile> {
  const probe = await probeNbaStats();
  logTrackingProbe(probe.status);
  const out: TrackingCacheFile = {
    slateDate,
    nbaStatus: probe.status,
    players: {},
  };

  if (probe.status === "ok") {
    try {
      const passing = await fetchPtStats(PASSING_URL);
      const rebounding = await fetchPtStats(REB_URL);
      for (const p of players) {
        const key = normalizePlayerName(p.name);
        const pass = passing.get(key);
        const reb = rebounding.get(key);
        if (!pass && !reb) continue;
        out.players[p.id] = {
          playerId: p.id,
          playerName: p.name,
          potentialAst: pass?.POTENTIAL_AST ?? pass?.AST,
          potentialReb: reb?.REB_CHANCES ?? reb?.REB,
          source: "nba",
          cachedAt: new Date().toISOString(),
        };
      }
    } catch {
      out.nbaStatus = "blocked";
    }
  }

  if (out.nbaStatus === "blocked" || !Object.keys(out.players).length) {
    for (const p of players) {
      out.players[p.id] = espnStandInFromLogs(p.id, p.name, p.gameLogs);
    }
  }

  writeTrackingCache(rootDir, out);
  return out;
}