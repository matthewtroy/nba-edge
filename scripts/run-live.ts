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
import { shouldPauseOdds } from "../lib/odds.js";
import { sydneyYmd } from "../lib/odds-budget.js";
import { isPostTipOff, mergeBestOddsMaps } from "../lib/odds-cache-merge.js";
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
  detectOddsPullTrigger,
  recordOddsPull,
  resetOddsDayIfNeeded,
  injuryRefreshSkipsOdds,
  type OddsCacheFile,
  type OddsPullTrigger,
} from "./odds-schedule.js";
import { pullBudgetedOddsForSlate } from "./budgeted-odds-pull.js";
import {
  createSupabaseClient,
  finalizePipelineSupabaseSync,
  loadOddsBudgetFromSupabase,
  saveOddsBudgetAfterPull,
  type SlateSyncBundle,
} from "./supabase-sync.js";
import { filterPlayersForSlate, writeSlateBundle } from "./slate-bundle.js";
import {
  cacheSlateOddsSnapshot,
  cachedMapFromFile,
  mergePricingMaps,
  resolveSlateOddsMaps,
  snapshotFromPricingMaps,
} from "../lib/odds-slate-cache.js";
import type { InjuryEntry, SlateGame } from "../lib/types.js";
import { normalizePlayerName } from "../lib/player-names.js";
import { loadAliasMap } from "../lib/player-names.js";
import {
  filterOpenGamesOnSydneyDate,
  filterSlateToNextSydney,
  filterSlateToTodaySydney,
  slateTeamIds,
  slateTipDateFromGames,
  tomorrowSydneyDateString,
} from "../lib/slate-today.js";
import { buildDataIndex, writeDataIndex } from "../lib/data-index.js";
import { buildOddsCoverage } from "../lib/odds-coverage.js";
import {
  countPricedLegsByMarket,
  coverageAttachWarnings,
  expandOddsMapForPlayers,
  tracePlayerOddsStages,
} from "../lib/odds-attach.js";
import { buildRosterIndex, mergeInjuryEntry } from "../lib/injury-match.js";
import {
  OFFICIAL_CARD_BOOKIE,
  loadOfficialCard,
  shouldPublishOfficialCard,
  writeOfficialCard,
} from "../lib/official-card.js";
import { sydneyDateString } from "../lib/official-card-time.js";
import { resolveOddsLastPulled } from "../lib/odds-pull-meta.js";
import {
  cacheLogsFromRaw,
  getCachedLogs,
  loadGameLogCache,
  saveGameLogCache,
} from "../lib/game-log-cache.js";

const ET = "America/New_York";

import { snapshotFromPicks, writeFromLiveOddsSnapshot } from "./load-from-live-odds.js";
import {
  fetchPublishedBundle,
  oddsMapsFromPublished,
} from "./fetch-published-data.js";

export async function runLivePipeline(
  rootDir: string,
  outDir: string,
  opts: {
    forceOdds?: boolean;
    fromLive?: boolean;
    skipOfficialPublish?: boolean;
  } = {}
): Promise<void> {
  const forceOdds = opts.forceOdds === true;
  const fromLive = opts.fromLive === true;
  const skipOfficialPublish = opts.skipOfficialPublish === true;
  loadAliasMap(rootDir);
  const now = new Date();
  const sources: Record<string, string> = {
    espn: "ok",
    nbaOfficial: "ok",
    odds: "stale",
  };

  let slatesToPublish: SlateGame[][] = [];
  let unionSlate: SlateGame[] = [];
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
    let merged = dedupeGames(parseScoreboard(boardToday, yesterdayPlayed));
    const todaySlate = filterSlateToTodaySydney(merged, now);
    let tomorrowSlate = filterSlateToNextSydney(merged);
    const tomorrowYmd = tomorrowSydneyDateString(now);
    console.log(
      `dual-slate: scoreboard ET ${todayEt} · merged=${merged.length} · today Sydney=${todaySlate.length} · tomorrow on board=${tomorrowSlate.length}`
    );
    if (!tomorrowSlate.length) {
      const tomorrowBoard = await maybeTomorrowBoard(now, todaySlate, yesterdayPlayed);
      const tEt = formatYyyymmddInZone(new Date(now.getTime() + 86400000), ET);
      console.log(
        `dual-slate: scoreboard ET ${tEt} probed · ${tomorrowBoard.length} games parsed · filter Sydney ${tomorrowYmd}`
      );
      merged = dedupeGames([...merged, ...tomorrowBoard]);
      tomorrowSlate = filterOpenGamesOnSydneyDate(merged, tomorrowYmd);
    }
    if (todaySlate.length) slatesToPublish.push(todaySlate);
    if (tomorrowSlate.length) {
      const todayIds = new Set(todaySlate.map((g) => g.id));
      const tomOnly = tomorrowSlate.filter((g) => !todayIds.has(g.id));
      if (tomOnly.length) slatesToPublish.push(tomOnly);
    }
    unionSlate = dedupeGames(slatesToPublish.flat());
  } catch (e) {
    console.error("ESPN scoreboard error:", e);
    sources.espn = "failed";
  }
  const slate = unionSlate;

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
  const slateTeamSet = new Set(teamIds);
  injuries = injuries.filter((i) => slateTeamSet.has(i.teamId));

  const gameLogCache = loadGameLogCache(outDir);
  try {
    const rosters = await mapPool(teamIds, 4, async (tid) => {
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
      if (pdfOutcome.blocked403) {
        console.log("nba pdf blocked (403), using ESPN injuries");
      }
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

    let cacheHits = 0;
    await mapPool(tasks, 8, async (task) => {
      try {
        const headshot = task.meta.headshot?.href ?? "";
        let logs = getCachedLogs(gameLogCache, task.athleteId, now);
        if (logs) {
          cacheHits += 1;
        } else {
          const logRaw = await fetchPlayerGameLog(task.athleteId);
          logs = cacheLogsFromRaw(gameLogCache, task.athleteId, logRaw, headshot, now);
        }
        if (logs.length < 3) return;

        const avgMin = logs.reduce((s, g) => s + g.minutes, 0) / logs.length;
        if (avgMin < 12) return;

        const recentIds = logs.slice(0, 5).map((g) => g.gameId);
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
    saveGameLogCache(outDir, gameLogCache);
    console.log(
      `espn logs: ${players.length} players, ${cacheHits} game-log cache hits`
    );
  } catch {
    sources.espn = sources.espn === "failed" ? "failed" : "stale";
  }

  await refreshRecentFinalBoxScores(now, summaryCache);

  const oddsCachePath = path.join(outDir, "odds-cache.json");
  const cache: OddsCacheFile = loadOddsCache(oddsCachePath);
  resetOddsDayIfNeeded(cache, now);
  console.log(
    `odds cache: ${Object.keys(cache.oddsMap ?? {}).length} global keys` +
      (cache.lastPulled ? ` · last pull ${cache.lastPulled}` : "")
  );
  const todayTip =
    slatesToPublish[0]?.length
      ? slateTipDateFromGames(slatesToPublish[0]) ?? sydneyDateString(now)
      : sydneyDateString(now);
  const existingTodayOfficial = loadOfficialCard(
    path.join(outDir, todayTip)
  );
  const officialPublishedToday =
    existingTodayOfficial?.slateDate === todayTip;

  let oddsMap = cachedMapFromFile(cache);
  let allOddsMap = new Map<string, Record<string, number>>();
  let oddsPayloads: unknown[] = [];
  let oddsPulledAt = cache.lastPulled;
  const apiKey = loadOddsApiKey(rootDir);
  const unpulledBySlateDate = new Map<string, Set<string>>();
  const rankingBySlateDate = new Map<string, import("../lib/game-injury-ranking.js").GameInjuryRank[]>();
  let lastPullTrigger: OddsPullTrigger | undefined;
  let lastCreditsUsed = 0;
  let lastCreditsPerGame = 10;

  const supabaseConn = await createSupabaseClient(rootDir);
  const supabaseClient = supabaseConn.client;
  const monthKey = sydneyYmd(now).slice(0, 7);
  const budgetFromDb = supabaseClient
    ? await loadOddsBudgetFromSupabase(supabaseClient, monthKey)
    : {
        monthlyLimit: 500,
        resetDay: 1,
        pretipPull: false,
        creditsPerGame: 10,
      };

  const nextSlateGames = filterSlateToNextSydney(unionSlate);
  const nextSlateTip = slateTipDateFromGames(nextSlateGames) ?? undefined;

  const skipOddsEnv = injuryRefreshSkipsOdds() && !forceOdds;
  let pullTrigger = detectOddsPullTrigger(now, unionSlate, cache, {
    officialPublishedToday,
    pretipPull: budgetFromDb?.pretipPull ?? false,
    forceOdds,
    skipScheduled9pm: skipOddsEnv,
    nextSlateTipDate: nextSlateTip,
  });
  if (skipOddsEnv && pullTrigger === "scheduled_9pm") {
    pullTrigger = detectOddsPullTrigger(now, unionSlate, cache, {
      pretipPull: budgetFromDb?.pretipPull ?? false,
      skipScheduled9pm: true,
    });
  }
  if (skipOddsEnv && pullTrigger !== "pretip") pullTrigger = null;

  let usedLiveOddsPull = false;
  let publishedPicksCount = 0;

  if (fromLive) {
    try {
      const published = await fetchPublishedBundle();
      const maps = oddsMapsFromPublished(published.picks, published.oddsCache);
      oddsMap = maps.best;
      allOddsMap = maps.all;
      oddsPulledAt = published.oddsCache.lastPulled ?? published.fetchedAt;
      if (published.oddsCache.oddsMap) {
        cache.oddsMap = published.oddsCache.oddsMap;
        cache.lastPulled = published.oddsCache.lastPulled;
        cache.creditsRemaining = published.oddsCache.creditsRemaining;
        cache.pullSlotsToday = published.oddsCache.pullSlotsToday;
      }
      publishedPicksCount = published.picks.length;
      sources.odds = "ok (from-live pages)";
      usedLiveOddsPull = true;
      console.log(
        `from-live: loaded Pages odds (${publishedPicksCount} legs, cache keys ${Object.keys(published.oddsCache.oddsMap ?? {}).length})`
      );
    } catch (e) {
      console.error("from-live Pages fetch failed:", e);
      sources.odds = "failed (from-live pages)";
    }
  } else if (!apiKey) {
    sources.odds = "stale";
  } else if (
    cache.creditsRemaining != null &&
    shouldPauseOdds(cache.creditsRemaining, budgetFromDb?.monthlyLimit ?? 500)
  ) {
    sources.odds = "paused (credit limit)";
  } else if (pullTrigger) {
    const targetSlate =
      pullTrigger === "scheduled_9pm" || forceOdds
        ? filterSlateToNextSydney(unionSlate).length
          ? filterSlateToNextSydney(unionSlate)
          : unionSlate
        : unionSlate;
    const preview = runModel({
      rootDir,
      slate: targetSlate,
      injuries,
      players: filterPlayersForSlate(players, targetSlate),
      rosterIds,
      oddsMap: expandOddsMapForPlayers(oddsMap, players.map((p) => p.name)),
      metaSources: sources,
    });
    try {
      const pull = await pullBudgetedOddsForSlate({
        apiKey,
        targetSlate,
        unionSlate,
        injuries,
        picksForRanking: preview.picks,
        cache,
        now,
        budget: {
          monthlyLimit: budgetFromDb?.monthlyLimit ?? 500,
          resetDay: budgetFromDb?.resetDay ?? 1,
          pretipPull: budgetFromDb?.pretipPull ?? false,
          creditsRemaining:
            budgetFromDb?.creditsRemaining ?? cache.creditsRemaining,
          creditsPerGame: budgetFromDb?.creditsPerGame ?? 10,
        },
        trigger: pullTrigger,
        targetSlateDate: slateTipDateFromGames(targetSlate) ?? undefined,
      });
      if (pull) {
        oddsMap = pull.oddsMap;
        allOddsMap = pull.allOddsMap;
        oddsPayloads = pull.payloads;
        oddsPulledAt = now.toISOString();
        cache.lastPulled = oddsPulledAt;
        recordOddsPull(
          cache,
          now,
          pullTrigger,
          pullTrigger === "scheduled_9pm" ? nextSlateTip : undefined
        );
        sources.odds = "ok";
        usedLiveOddsPull = true;
        lastPullTrigger = pullTrigger;
        lastCreditsUsed = pull.creditsUsed;
        lastCreditsPerGame = pull.creditsPerGame;
        if (supabaseClient && pull.creditsUsed > 0) {
          await saveOddsBudgetAfterPull(supabaseClient, monthKey, {
            monthlyLimit: budgetFromDb?.monthlyLimit ?? 500,
            resetDay: budgetFromDb?.resetDay ?? 1,
            pretipPull: budgetFromDb?.pretipPull ?? false,
            creditsRemaining: pull.creditsRemaining,
            creditsPerGame: pull.creditsPerGame,
          });
        }
        const tip = slateTipDateFromGames(targetSlate);
        if (tip && pull.pulledGameIds.size && pull.unpulledGameIds.size) {
          unpulledBySlateDate.set(tip, pull.unpulledGameIds);
        }
        if (tip) rankingBySlateDate.set(tip, pull.ranking);
      }
    } catch {
      sources.odds = "stale";
    }
  } else if (Object.keys(cache.oddsMap ?? {}).length) {
    sources.odds = "ok";
  }

  const playerNames = players.map((p) => p.name);
  const playerTeamIds = new Map(
    players.map((p) => [normalizePlayerName(p.name), p.teamId])
  );
  const pulledOddsExpanded = expandOddsMapForPlayers(oddsMap, playerNames);
  const extractedKeyList = [...oddsMap.keys()];

  const indexEntries: import("../lib/data-index.js").DataIndexDateEntry[] = [];
  let todayPicks: ReturnType<typeof runModel>["picks"] = [];
  let todayMultis: ReturnType<typeof runModel>["multis"] = [];
  let lastPricingMapSize = 0;

  for (const oneSlate of slatesToPublish) {
    const tip = slateTipDateFromGames(oneSlate);
    const slateMaps = tip
      ? resolveSlateOddsMaps(cache, tip, oneSlate, playerNames, playerTeamIds)
      : {
          best: pulledOddsExpanded,
          all: allOddsMap,
          lastPulled: oddsPulledAt,
        };
    const slateBest = mergePricingMaps(slateMaps.best, pulledOddsExpanded);
    const slateAll = new Map(slateMaps.all);
    for (const [k, v] of allOddsMap) slateAll.set(k, v);
    for (const [k, v] of slateAll) {
      const [name, market, line] = k.split("|");
      for (const p of players) {
        if (normalizePlayerName(p.name) === name) {
          slateAll.set(`${p.name}|${market}|${line}`, v);
          slateAll.set(`${normalizePlayerName(p.name)}|${market}|${line}`, v);
        }
      }
    }
    const pricingOdds = expandOddsMapForPlayers(slateBest, playerNames);
    lastPricingMapSize = pricingOdds.size;
    const slatePulledAt = oddsPulledAt ?? slateMaps.lastPulled;
    const entry = writeSlateBundle({
      rootDir,
      rootOutDir: outDir,
      slate: oneSlate,
      injuriesAll: injuries,
      playersAll: players,
      rosterIds,
      oddsMap: pricingOdds,
      allOddsMap: slateAll,
      oddsPulledAt: slatePulledAt,
      oddsPayloads: tip === nextSlateTip ? oddsPayloads : [],
      sources,
      cache,
      now,
      nbaOfficialUrl,
      nbaOfficialLastTriedUrl,
      unpulledGameIds: tip ? unpulledBySlateDate.get(tip) : undefined,
      skipOfficialPublish,
    });
    if (tip) {
      cacheSlateOddsSnapshot(
        cache,
        tip,
        snapshotFromPricingMaps(
          tip,
          slateBest,
          slateAll,
          slatePulledAt ?? now.toISOString(),
          unpulledBySlateDate.get(tip)?.size
            ? oneSlate
                .filter((g) => !unpulledBySlateDate.get(tip)!.has(g.id))
                .map((g) => g.id)
            : oneSlate.map((g) => g.id)
        )
      );
      if (!cache.oddsMap) cache.oddsMap = {};
      for (const [k, v] of slateBest) cache.oddsMap[k] = v;
      console.log(
        `odds cache: slate ${tip} · ${slateBest.size} merged keys (${slateMaps.best.size} cached)`
      );
    }
    if (entry) indexEntries.push(entry);
    if (tip === todayTip) {
      const picksPath = path.join(outDir, tip, "picks.json");
      const multisPath = path.join(outDir, tip, "multis.json");
      if (fs.existsSync(picksPath)) {
        todayPicks = JSON.parse(fs.readFileSync(picksPath, "utf8"));
        const multisRaw = JSON.parse(fs.readFileSync(multisPath, "utf8")) as {
          bets: typeof todayMultis;
        };
        todayMultis = multisRaw.bets;
      }
    }
  }

  if (fromLive && usedLiveOddsPull && sources.odds.startsWith("ok") && todayPicks.length) {
    writeFromLiveOddsSnapshot(
      rootDir,
      snapshotFromPicks(todayPicks, oddsPulledAt ?? now.toISOString())
    );
  }

  const tatumLegs = todayPicks.filter((p) => p.playerName === "Jayson Tatum");
  if (tatumLegs.length || extractedKeyList.some((k) => k.includes("tatum"))) {
    tracePlayerOddsStages("Jayson Tatum", {
      extractedKeys: extractedKeyList,
      pricingMapSize: lastPricingMapSize,
      pricedLegs: tatumLegs,
    });
  }

  let history = loadHistory(rootDir);
  const picksById = new Map(todayPicks.map((p) => [p.id, p]));
  const boxesByGame = await loadFinalBoxesForGrading(now, summaryCache);
  history = gradeOpenLegs(history, picksById, boxesByGame);
  history = appendRecommendations(history, todayPicks, todayMultis, todayTip);

  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "history.json"), JSON.stringify(history, null, 2));
  fs.writeFileSync(oddsCachePath, JSON.stringify(cache, null, 2));
  writeDataIndex(outDir, buildDataIndex(indexEntries, now));

  for (const legacy of [
    "slate.json",
    "picks.json",
    "multis.json",
    "meta.json",
    "injuries.json",
    "odds-coverage.json",
    "official-card.json",
  ]) {
    const legacyPath = path.join(outDir, legacy);
    if (fs.existsSync(legacyPath)) fs.unlinkSync(legacyPath);
  }

  const syncBundles: SlateSyncBundle[] = [];
  for (const oneSlate of slatesToPublish) {
    const tip = slateTipDateFromGames(oneSlate);
    if (!tip) continue;
    const slateInjuries = injuries.filter((i) =>
      oneSlate.some(
        (g) => g.homeTeamId === i.teamId || g.awayTeamId === i.teamId
      )
    );
    const tipPayloads =
      tip === slateTipDateFromGames(nextSlateGames) ? oddsPayloads : [];
    syncBundles.push({
      slateDate: tip,
      slate: oneSlate,
      injuries: slateInjuries,
      players,
      ranking: rankingBySlateDate.get(tip) ?? [],
      pullTrigger: tip === nextSlateTip ? lastPullTrigger : undefined,
      creditsUsed: tip === nextSlateTip ? lastCreditsUsed : undefined,
      creditsRemaining: cache.creditsRemaining,
      gamesPulled: [
        ...oneSlate
          .filter((g) => !unpulledBySlateDate.get(tip)?.has(g.id))
          .map((g) => g.id),
      ],
      oddsPayloads: tipPayloads.length ? tipPayloads : undefined,
      pulledAt: oddsPulledAt,
      cache,
    });
  }
  await finalizePipelineSupabaseSync(rootDir, syncBundles);

  console.log(
    `Pipeline OK: ${slatesToPublish.length} slate(s) · ${indexEntries.map((e) => `${e.date} ${e.multiCount}m`).join(", ")} (${fromLive ? "from-live" : "live"})`
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
  _today: SlateGame[],
  yesterdayPlayed: Set<string>
): Promise<SlateGame[]> {
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