import fs from "fs";
import path from "path";
import {
  fetchScoreboard,
  fetchSummary,
  fetchLeagueInjuries,
  fetchRoster,
  fetchPlayerGameLog,
} from "./fetch/espn.js";
import { fetchLatestInjuryPdf, parsePdfInjuries } from "./fetch/nba-pdf.js";
import {
  listOddsEvents,
  matchOddsEventId,
  fetchOddsForEvent,
  extractOddsBundles,
} from "./fetch/odds-events.js";
import { shouldPauseOdds } from "../lib/odds.js";
import {
  formatYyyymmddInZone,
  parseScoreboard,
  teamIdsFromFinalGames,
  parseEspnLeagueInjuries,
  mergeOfficialInjuries,
  parseGameLogsFromEspn,
  parseBoxscore,
  parseQ1FromPlays,
} from "./espn-parse.js";
import { mapPool } from "./lib/concurrency.js";
import { loadOddsApiKey } from "./lib/env.js";
import { runModel, oddsMapFromRecord, oddsMapToRecord, type ModelPlayer } from "./model-engine.js";
import { loadHistory } from "./run-model.js";
import { appendRecommendations, gradeOpenLegs } from "./grading-run.js";
import {
  shouldPullOddsNow,
  recordOddsPull,
  resetOddsDayIfNeeded,
  type OddsCacheFile,
} from "./odds-schedule.js";
import type { InjuryEntry, SlateGame } from "../lib/types.js";
import { normalizePlayerName } from "../lib/player-names.js";
import { loadAliasMap } from "../lib/player-names.js";
import { filterSlateToTodaySydney, slateTeamIds } from "../lib/slate-today.js";
import { buildRosterIndex, mergeInjuryEntry } from "../lib/injury-match.js";

const ET = "America/New_York";

export async function runLivePipeline(
  rootDir: string,
  outDir: string,
  opts: { forceOdds?: boolean } = {}
): Promise<void> {
  const forceOdds = opts.forceOdds === true;
  loadAliasMap(rootDir);
  const now = new Date();
  const sources: Record<string, string> = {
    espn: "ok",
    nbaOfficial: "ok",
    odds: "stale",
  };

  let slate: SlateGame[] = [];
  let yesterdayPlayed = new Set<string>();

  try {
    const todayEt = formatYyyymmddInZone(now, ET);
    const yd = new Date(now.getTime() - 86400000);
    const yEt = formatYyyymmddInZone(yd, ET);

    const [boardToday, boardYesterday] = await Promise.all([
      fetchScoreboard(dateFromYyyymmdd(todayEt)),
      fetchScoreboard(dateFromYyyymmdd(yEt)),
    ]);

    yesterdayPlayed = teamIdsFromFinalGames(boardYesterday);
    const fromToday = parseScoreboard(boardToday, yesterdayPlayed);
    slate = filterSlateToTodaySydney(dedupeGames(fromToday), now);
  } catch (e) {
    console.error("ESPN scoreboard error:", e);
    sources.espn = "failed";
  }

  const slateByTeam = new Map<string, string>();
  for (const g of slate) {
    slateByTeam.set(g.homeTeamId, g.id);
    slateByTeam.set(g.awayTeamId, g.id);
  }

  let injuries: InjuryEntry[] = [];
  try {
    const rawInj = await fetchLeagueInjuries();
    injuries = parseEspnLeagueInjuries(rawInj, slateByTeam);
  } catch {
    sources.espn = sources.espn === "failed" ? "failed" : "stale";
  }

  const playerTeamLookup = new Map<
    string,
    { teamId: string; teamName: string; playerId: string }
  >();

  const teamIds = [...new Set(slate.flatMap((g) => [g.homeTeamId, g.awayTeamId]))];

  try {
    const rosters = await mapPool(teamIds, 3, async (tid) => {
      const raw = await fetchRoster(tid);
      return { tid, raw };
    });

    for (const { tid, raw } of rosters) {
      const data = raw as { team?: { displayName?: string }; athletes?: { id: string; displayName?: string; fullName?: string }[] };
      const teamName = data.team?.displayName ?? "";
      for (const a of data.athletes ?? []) {
        const name = a.displayName ?? a.fullName ?? "";
        playerTeamLookup.set(normalizePlayerName(name), {
          teamId: tid,
          teamName,
          playerId: a.id,
        });
      }
    }
  } catch {
    sources.espn = sources.espn === "failed" ? "failed" : "stale";
  }

  let nbaOfficialUrl: string | undefined;
  let nbaOfficialLastTriedUrl: string | undefined;
  try {
    const pdfOutcome = await fetchLatestInjuryPdf(now);
    if (pdfOutcome.ok) {
      const pdf = pdfOutcome.result;
      nbaOfficialUrl = pdf.url;
      sources.nbaOfficial = "ok";
      const parsed = parsePdfInjuries(pdf.text).map((p) => ({
        ...p,
        updatedAt: now.toISOString(),
      }));
      injuries = mergeOfficialInjuries(injuries, parsed, slateByTeam, playerTeamLookup);
    } else {
      sources.nbaOfficial = "stale";
      const last = pdfOutcome.tryLog[pdfOutcome.tryLog.length - 1];
      nbaOfficialLastTriedUrl = last?.url;
    }
  } catch (e) {
    console.warn("nbaOfficial PDF error:", e instanceof Error ? e.message : e);
    sources.nbaOfficial = "stale";
  }

  const players: ModelPlayer[] = [];
  const rosterIds = new Set<string>();
  const summaryCache = new Map<string, Awaited<ReturnType<typeof fetchSummary>>>();

  async function getSummary(id: string) {
    if (!summaryCache.has(id)) {
      summaryCache.set(id, await fetchSummary(id));
    }
    return summaryCache.get(id)!;
  }

  try {
    const rosterPlayers = await mapPool(teamIds, 2, async (tid) => {
      const raw = (await fetchRoster(tid)) as {
        team?: { displayName?: string; abbreviation?: string };
        athletes?: {
          id: string;
          displayName?: string;
          fullName?: string;
          position?: { abbreviation?: string };
          age?: number;
          headshot?: { href?: string };
        }[];
      };
      return { tid, raw };
    });

    const tasks: { athleteId: string; teamId: string; teamName: string; meta: (typeof rosterPlayers)[0]["raw"]["athletes"][0] }[] = [];
    for (const { tid, raw } of rosterPlayers) {
      const teamName = raw.team?.displayName ?? "";
      for (const a of raw.athletes ?? []) {
        tasks.push({ athleteId: a.id, teamId: tid, teamName, meta: a });
      }
    }

    const gameForTeam = (tid: string) =>
      slate.find((g) => g.homeTeamId === tid || g.awayTeamId === tid);

    await mapPool(tasks, 3, async (task) => {
      try {
        const logRaw = await fetchPlayerGameLog(task.athleteId);
        const headshot = task.meta.headshot?.href ?? "";
        let logs = parseGameLogsFromEspn(logRaw, headshot);
        if (logs.length < 3) return;

        const avgMin = logs.reduce((s, g) => s + g.minutes, 0) / logs.length;
        if (avgMin < 12) return;

        const recentIds = logs.slice(0, 3).map((g) => g.gameId);
        for (const gid of recentIds) {
          try {
            const sum = await getSummary(gid);
            const plays = (sum as { plays?: unknown }).plays;
            if (!plays) continue;
            const q1 = parseQ1FromPlays(plays as Parameters<typeof parseQ1FromPlays>[0], task.athleteId);
            const entry = logs.find((g) => g.gameId === gid);
            if (entry) Object.assign(entry, { q1Pts: q1.pts, q1Reb: q1.reb, q1Ast: q1.ast });
          } catch {
            /* skip q1 for this game */
          }
        }

        const game = gameForTeam(task.teamId);
        if (!game) return;

        const opponent =
          game.homeTeamId === task.teamId ? game.awayTeam : game.homeTeam;

        rosterIds.add(task.athleteId);
        players.push({
          id: task.athleteId,
          name: task.meta.displayName ?? task.meta.fullName ?? "",
          teamId: task.teamId,
          teamName: task.teamName,
          position: task.meta.position?.abbreviation ?? "G",
          age: task.meta.age,
          headshotUrl: headshot,
          gameLogs: logs,
          gameId: game.id,
          opponent,
        });
      } catch {
        /* skip player */
      }
    });
  } catch {
    sources.espn = sources.espn === "failed" ? "failed" : "stale";
  }

  await refreshRecentFinalBoxScores(now, summaryCache);

  const oddsCachePath = path.join(outDir, "odds-cache.json");
  const cache: OddsCacheFile = loadOddsCache(oddsCachePath);
  resetOddsDayIfNeeded(cache, now);

  let oddsMap = oddsMapFromRecord(cache.oddsMap ?? {});
  let allOddsMap = new Map<string, Record<string, number>>();
  let oddsPulledAt = cache.lastPulled;
  const apiKey = loadOddsApiKey(rootDir);

  if (!apiKey) {
    sources.odds = "stale";
  } else if (cache.creditsRemaining != null && shouldPauseOdds(cache.creditsRemaining)) {
    sources.odds = "paused (credit limit)";
  } else if (shouldPullOddsNow(now, slate, cache) || forceOdds) {
    try {
      const { events, remaining } = await listOddsEvents(apiKey);
      if (remaining != null) cache.creditsRemaining = remaining;
      if (remaining != null && shouldPauseOdds(remaining)) {
        sources.odds = "paused (credit limit)";
      } else {
        const payloads: unknown[] = [];
        for (const g of slate) {
          const oddsId = matchOddsEventId(g, events);
          if (!oddsId) continue;
          const { data, remaining: rem } = await fetchOddsForEvent(apiKey, oddsId);
          if (rem != null) cache.creditsRemaining = rem;
          if (data) payloads.push(data);
        }
        const bundles = extractOddsBundles(payloads);
        oddsMap = bundles.best;
        allOddsMap = bundles.all;
        const norm = new Map<string, { price: number; bookie: string }>();
        for (const [k, v] of oddsMap) norm.set(k, v);
        oddsMap = norm;
        recordOddsPull(cache, now, slate);
        oddsPulledAt = now.toISOString();
        cache.lastPulled = oddsPulledAt;
        cache.oddsMap = oddsMapToRecord(oddsMap);
        sources.odds = "ok";
      }
    } catch {
      sources.odds = sources.odds === "paused (credit limit)" ? sources.odds : "stale";
    }
  } else if (Object.keys(cache.oddsMap ?? {}).length) {
    sources.odds = "ok";
  }

  const pricingOdds = new Map<string, { price: number; bookie: string }>();
  const pricingAllOdds = new Map<string, Record<string, number>>();
  for (const [k, v] of oddsMap) {
    pricingOdds.set(k, v);
    const [name, market, line] = k.split("|");
    if (name) {
      for (const p of players) {
        if (normalizePlayerName(p.name) === name) {
          pricingOdds.set(`${p.name}|${market}|${line}`, v);
        }
      }
    }
  }
  for (const [k, v] of allOddsMap) {
    pricingAllOdds.set(k, v);
    const [name, market, line] = k.split("|");
    if (name) {
      for (const p of players) {
        if (normalizePlayerName(p.name) === name) {
          pricingAllOdds.set(`${p.name}|${market}|${line}`, v);
        }
      }
    }
  }

  const slateTeams = slateTeamIds(slate);
  injuries = injuries.filter((i) => slateTeams.has(i.teamId));

  const { picks, multis, multisPayload, meta, whatChanged } = runModel({
    rootDir,
    slate,
    injuries,
    players,
    rosterIds,
    oddsMap: pricingOdds,
    allOddsMap: pricingAllOdds,
    oddsPulledAt,
    metaSources: sources,
  });

  let history = loadHistory(rootDir);
  const slateDate = now.toLocaleDateString("en-CA", { timeZone: "Australia/Sydney" });
  const picksById = new Map(picks.map((p) => [p.id, p]));

  const boxesByGame = await loadFinalBoxesForGrading(now, summaryCache);
  history = gradeOpenLegs(history, picksById, boxesByGame);
  history = appendRecommendations(history, picks, multis, slateDate);

  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "slate.json"), JSON.stringify(slate, null, 2));
  fs.writeFileSync(path.join(outDir, "injuries.json"), JSON.stringify(injuries, null, 2));
  fs.writeFileSync(path.join(outDir, "picks.json"), JSON.stringify(picks, null, 2));
  fs.writeFileSync(
    path.join(outDir, "multis.json"),
    JSON.stringify({ bets: multis, notBuilt: multisPayload.notBuilt }, null, 2)
  );
  fs.writeFileSync(
    path.join(outDir, "meta.json"),
    JSON.stringify(
      {
        ...meta,
        whatChanged,
        ...(nbaOfficialUrl ? { nbaOfficialUrl } : {}),
        ...(nbaOfficialLastTriedUrl ? { nbaOfficialLastTriedUrl } : {}),
      },
      null,
      2
    )
  );
  fs.writeFileSync(path.join(outDir, "history.json"), JSON.stringify(history, null, 2));
  fs.writeFileSync(oddsCachePath, JSON.stringify(cache, null, 2));

  console.log(
    `Pipeline OK: ${slate.length} games, ${picks.length} legs, ${multis.length} multis (live)`
  );
}

function dateFromYyyymmdd(s: string): Date {
  const y = Number(s.slice(0, 4));
  const m = Number(s.slice(4, 6)) - 1;
  const d = Number(s.slice(6, 8));
  return new Date(Date.UTC(y, m, d, 12, 0, 0));
}

async function maybeTomorrowBoard(
  now: Date,
  today: SlateGame[],
  yesterdayPlayed: Set<string>
): Promise<SlateGame[]> {
  if (today.length >= 2) return [];
  const tomorrow = new Date(now.getTime() + 86400000);
  const tEt = formatYyyymmddInZone(tomorrow, ET);
  try {
    const board = await fetchScoreboard(dateFromYyyymmdd(tEt));
    return parseScoreboard(board, yesterdayPlayed);
  } catch {
    return [];
  }
}

function dedupeGames(games: SlateGame[]): SlateGame[] {
  const m = new Map<string, SlateGame>();
  for (const g of games) m.set(g.id, g);
  return [...m.values()];
}

function loadOddsCache(p: string): OddsCacheFile {
  if (!fs.existsSync(p)) return {};
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {
    return {};
  }
}

function loadPreviousInjuries(outDir: string): InjuryEntry[] {
  const p = path.join(outDir, "injuries.json");
  if (!fs.existsSync(p)) return [];
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {
    return [];
  }
}

function diffInjuries(prev: InjuryEntry[], next: InjuryEntry[]): string[] {
  const lines: string[] = [];
  const prevMap = new Map(prev.map((i) => [i.playerId, i]));
  for (const n of next) {
    const p = prevMap.get(n.playerId);
    if (
      !p ||
      p.status !== n.status ||
      (n.status === "Out" || n.status === "Doubtful")
    ) {
      if (n.status === "Out" || n.status === "Doubtful") {
        lines.push(`${n.playerName} ${n.status.toLowerCase()} → check beneficiaries`);
      }
    }
    if (lines.length >= 3) break;
  }
  return lines;
}

async function refreshRecentFinalBoxScores(
  now: Date,
  cache: Map<string, unknown>
): Promise<void> {
  for (let i = 1; i <= 3; i++) {
    const d = new Date(now.getTime() - i * 86400000);
    const et = formatYyyymmddInZone(d, ET);
    try {
      const board = await fetchScoreboard(dateFromYyyymmdd(et));
      const data = board as { events?: { id: string; status?: { type?: { name?: string } } }[] };
      for (const ev of data.events ?? []) {
        if (!(ev.status?.type?.name ?? "").toLowerCase().includes("final")) continue;
        if (!cache.has(ev.id)) cache.set(ev.id, await fetchSummary(ev.id));
      }
    } catch {
      /* per-day failure ok */
    }
  }
}

async function loadFinalBoxesForGrading(
  now: Date,
  cache: Map<string, unknown>
): Promise<Map<string, Map<string, import("./espn-parse.js").BoxLine>>> {
  const boxesByGame = new Map<string, Map<string, import("./espn-parse.js").BoxLine>>();
  for (let i = 0; i <= 3; i++) {
    const d = new Date(now.getTime() - i * 86400000);
    const et = formatYyyymmddInZone(d, ET);
    try {
      const board = await fetchScoreboard(dateFromYyyymmdd(et));
      const data = board as { events?: { id: string; status?: { type?: { name?: string } } }[] };
      for (const ev of data.events ?? []) {
        if (!(ev.status?.type?.name ?? "").toLowerCase().includes("final")) continue;
        const sum =
          cache.get(ev.id) ?? (await fetchSummary(ev.id));
        cache.set(ev.id, sum);
        boxesByGame.set(ev.id, parseBoxscore(sum, (sum as { plays?: unknown }).plays));
      }
    } catch {
      /* continue */
    }
  }
  return boxesByGame;
}