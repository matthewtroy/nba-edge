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
import { injuryReportTimeFromPdfUrl } from "../lib/injury-report-time.js";
import { shouldPauseOdds } from "../lib/odds.js";
import { oddsReserveCredits } from "../lib/odds-reserve.js";
import { sydneyYmd, type OddsBudgetConfig } from "../lib/odds-budget.js";
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
import { espnHeadshotUrl } from "../lib/player-headshot.js";
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
  type SupabaseUpsertClient,
} from "./supabase-sync.js";
import { ensurePlayerTracking } from "../lib/player-tracking-fetch.js";

const DEFAULT_ODDS_BUDGET: OddsBudgetConfig = {
  monthlyLimit: 500,
  resetDay: 1,
  pretipPull: false,
  creditsPerGame: 10,
};

/** Supabase failures must not fail the static JSON pipeline (Actions exit 0). */
export async function safeFinalizePipelineSupabaseSync(
  rootDir: string,
  bundles: SlateSyncBundle[]
): Promise<void> {
  try {
    await finalizePipelineSupabaseSync(rootDir, bundles);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`supabase sync failed: ${msg}`);
  }
}
import { logsForModelRates } from "../lib/baseline.js";
import { filterPlayersForSlate, writeSlateBundle } from "./slate-bundle.js";
import { buildDefenseRatings, logDefenseSpotCheck } from "../lib/defense-ratings.js";
import { buildPlayerPositionRanks } from "../lib/player-position-rank.js";
import {
  pruneGameLogCacheBeforeSeason,
  runLeagueSeasonBackfill,
  type LeagueBackfillReport,
} from "../lib/league-season-backfill.js";
import { matchupGateLogLine, matchupSignalsReady } from "../lib/matchup-gate.js";
import { MATCHUP_ENABLED } from "../lib/pricing-config.js";
import { backfillRosterLogsOnce } from "../lib/season-log-backfill.js";
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
  slateTeamIds,
  slateTipDateFromGames,
  tomorrowSydneyDateString,
} from "../lib/slate-today.js";
import { buildDataIndex, writeDataIndex } from "../lib/data-index.js";
import {
  mergePlanWithPersisted,
  rebuildIndexEntriesFromDisk,
  planScoreboardSlates,
  pipelineSydneyDates,
  slatesToPublishFromPlan,
} from "../lib/slate-retention.js";
import {
  indexRetentionDropReason,
  listDataBranchRetainedFolders,
  loadDataIndexFile,
} from "../lib/index-guard.js";
import {
  applyForwardMetadata,
  forwardSlateMetadataFromGames,
} from "../lib/index-forward-scan.js";
import { buildOddsCoverage } from "../lib/odds-coverage.js";
import {
  countPricedLegsByMarket,
  coverageAttachWarnings,
  expandOddsMapForPlayers,
  tracePlayerOddsStages,
} from "../lib/odds-attach.js";
import { buildRosterIndex, mergeInjuryEntry } from "../lib/injury-match.js";
import {
  loadOfficialCard,
  shouldPublishOfficialCard,
  writeOfficialCard,
} from "../lib/official-card.js";
import { sydneyDateString, sydneyHour } from "../lib/official-card-time.js";
import { slateFirstTipStarted } from "../lib/slate-started.js";
import { resolveOddsLastPulled } from "../lib/odds-pull-meta.js";
import { logOfficialCard } from "../lib/official-card-log.js";
import {
  cacheLogsFromRaw,
  getCachedLogs,
  loadGameLogCache,
  normalizeLogsForPlayer,
  saveGameLogCache,
} from "../lib/game-log-cache.js";
import { ensureH2hSeasonLogs } from "../lib/h2h-season-logs.js";
import {
  mergeGlobalOddsMapRecord,
  oddsMapDowngradeBlocked,
  oddsMapKeyCount,
} from "../lib/odds-cache-guard.js";
import {
  espnCacheShrinkBlocked,
  historyEntryCount,
  recordKeyCount,
  warnEspnCacheShrinkBlocked,
} from "../lib/espn-cache-guard.js";
import { loadH2hSeasonCache, saveH2hSeasonCache } from "../lib/h2h-cache.js";

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
    republishCard?: boolean;
  } = {}
): Promise<void> {
  const forceOdds = opts.forceOdds === true;
  const fromLive = opts.fromLive === true;
  const reserveCredits = oddsReserveCredits();
  const fixedOddsGames = (() => {
    const raw = process.env.PIPELINE_ODDS_GAMES;
    if (raw == null || raw.trim() === "") return 0;
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  })();
  const skipOfficialPublish = opts.skipOfficialPublish === true;
  const republishCard = opts.republishCard === true;
  loadAliasMap(rootDir);
  const now = new Date();
  const priorIndex = loadDataIndexFile(outDir);
  const sources: Record<string, string> = {
    espn: "ok",
    nbaOfficial: "ok",
    odds: "stale",
  };

  let slatesToPublish: SlateGame[][] = [];
  let unionSlate: SlateGame[] = [];
  /** Full ESPN merge (incl. forward ET scan) for index forward metadata — not just publish slates. */
  let scoreboardMerged: SlateGame[] = [];
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
    let plan = planScoreboardSlates(merged, now);
    const { tomorrowYmd } = pipelineSydneyDates(now);
    console.log(
      `dual-slate: scoreboard ET ${todayEt} · merged=${merged.length} · today Sydney=${plan.today.length} · tomorrow Sydney ${tomorrowYmd}=${plan.tomorrow.length}`
    );
    if (!plan.tomorrow.length) {
      const tomorrowBoard = await maybeTomorrowBoard(now, plan.today, yesterdayPlayed);
      const tEt = formatYyyymmddInZone(new Date(now.getTime() + 86400000), ET);
      console.log(
        `dual-slate: scoreboard ET ${tEt} probed · ${tomorrowBoard.length} games parsed · filter Sydney ${tomorrowYmd}`
      );
      merged = dedupeGames([...merged, ...tomorrowBoard]);
      plan = planScoreboardSlates(merged, now);
    }
    plan = mergePlanWithPersisted(plan, outDir, now);
    if (!plan.today.length && !plan.tomorrow.length) {
      for (let i = 2; i < 7; i++) {
        const d = new Date(now.getTime() + i * 86400000);
        const et = formatYyyymmddInZone(d, ET);
        try {
          const board = await fetchScoreboard(dateFromYyyymmdd(et));
          const parsed = parseScoreboard(board, yesterdayPlayed);
          if (!parsed.length) continue;
          merged = dedupeGames([...merged, ...parsed]);
          plan = planScoreboardSlates(merged, now);
          console.log(
            `dual-slate: forward ET ${et} · +${parsed.length} games · today Sydney=${plan.today.length} · tomorrow=${plan.tomorrow.length}`
          );
          if (plan.today.length || plan.tomorrow.length) break;
        } catch {
          /* keep scanning */
        }
      }
      plan = mergePlanWithPersisted(plan, outDir, now);
    }
    scoreboardMerged = merged;
    slatesToPublish = slatesToPublishFromPlan(plan.today, plan.tomorrow);
    unionSlate = dedupeGames(slatesToPublish.flat());
  } catch (e) {
    console.error("ESPN scoreboard error:", e);
    sources.espn = "failed";
  }
  if (!slatesToPublish.length) {
    const plan = mergePlanWithPersisted({ today: [], tomorrow: [] }, outDir, now);
    slatesToPublish = slatesToPublishFromPlan(plan.today, plan.tomorrow);
    unionSlate = dedupeGames(slatesToPublish.flat());
    console.log(
      `dual-slate: scoreboard empty · restored from disk today=${plan.today.length} tomorrow=${plan.tomorrow.length}`
    );
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
  const baselineGameLogCache = structuredClone(gameLogCache);
  const baselineGameLogKeys = recordKeyCount(gameLogCache);
  const baselineH2hSeasonCache = loadH2hSeasonCache(outDir);
  const baselineH2hSeasonKeys = recordKeyCount(baselineH2hSeasonCache);
  const espnDegraded = () => sources.espn !== "ok";
  const postTipOff = () => isPostTipOff(now, unionSlate);
  const blockEspnShrink = () => espnDegraded() || postTipOff();
  let leagueBackfillReport: LeagueBackfillReport | undefined;
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
      const reportTime =
        injuryReportTimeFromPdfUrl(pdf.url) ?? now.toISOString();
      const parsed = parsePdfInjuries(pdf.text).map((p) => ({
        ...p,
        updatedAt: reportTime,
        reportTime,
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

    type AthleteMeta = NonNullable<
      NonNullable<(typeof rosterPlayers)[0]["raw"]["athletes"]>[number]
    >;
    const tasks: { athleteId: string; teamId: string; teamName: string; meta: AthleteMeta }[] = [];
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
        const headshotHref = task.meta.headshot?.href ?? "";
        let logs = getCachedLogs(gameLogCache, task.athleteId, now);
        if (logs) {
          cacheHits += 1;
        } else {
          const logRaw = await fetchPlayerGameLog(task.athleteId);
          const headshot = espnHeadshotUrl(task.athleteId, headshotHref);
          logs = cacheLogsFromRaw(
            gameLogCache,
            task.athleteId,
            logRaw,
            headshot,
            now,
            task.teamId
          );
        }
        logs = normalizeLogsForPlayer(logs);
        const rateLogs = logsForModelRates(logs);
        if (rateLogs.length < 3) return;

        const avgMin = rateLogs.reduce((s, g) => s + g.minutes, 0) / rateLogs.length;
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

        const home = game.homeTeamId === task.teamId;
        const opponent = home ? game.awayTeam : game.homeTeam;
        const opponentTeamId = home ? game.awayTeamId : game.homeTeamId;

        rosterIds.add(task.athleteId);
        players.push({
          id: task.athleteId,
          name: task.meta.displayName ?? task.meta.fullName ?? "",
          teamId: task.teamId,
          teamName: task.teamName,
          position: task.meta.position?.abbreviation ?? "G",
          age: task.meta.age,
          headshotUrl: espnHeadshotUrl(task.athleteId, headshotHref),
          gameLogs: logs,
          seasonAvgMinutes: avgMin,
          gameId: game.id,
          opponent,
          opponentTeamId,
        });
      } catch {
        /* skip player */
      }
    });
    const backfillTasks = tasks.map((t) => ({
      athleteId: t.athleteId,
      teamId: t.teamId,
    }));
    const backfill = await backfillRosterLogsOnce(gameLogCache, backfillTasks, now, {
      concurrency: 3,
    });
    const prunedRows = pruneGameLogCacheBeforeSeason(gameLogCache);
    if (prunedRows > 0) {
      console.log(`league backfill: pruned ${prunedRows} pre-season log rows from cache`);
    }
    leagueBackfillReport = await runLeagueSeasonBackfill(outDir, gameLogCache, {
      maxGames: Number(process.env.LEAGUE_BACKFILL_MAX_GAMES ?? 400),
      concurrency: 2,
      until: now,
    });
    const nextGameLogKeys = recordKeyCount(gameLogCache);
    if (espnCacheShrinkBlocked(baselineGameLogKeys, nextGameLogKeys) && blockEspnShrink()) {
      warnEspnCacheShrinkBlocked("game-log-cache", baselineGameLogKeys, nextGameLogKeys);
      saveGameLogCache(outDir, baselineGameLogCache);
    } else {
      saveGameLogCache(outDir, gameLogCache);
    }
    console.log(
      `espn logs: ${players.length} players, ${cacheHits} game-log cache hits` +
        ` · backfill refreshed ${backfill.refreshed}`
    );
  } catch {
    sources.espn = sources.espn === "failed" ? "failed" : "stale";
  }

  let defenseBundle: import("../lib/defense-ratings.js").DefenseRatingsBundle = {
    defense: [],
    pace: [],
    unavailable: ["defense: not computed"],
  };
  let positionRanks = new Map<
    string,
    Partial<Record<"pts" | "reb" | "ast", import("../lib/player-position-rank.js").PlayerStatRankRow>>
  >();
  try {
    const playerMeta = new Map(
      players.map((p) => [p.id, { teamId: p.teamId, position: p.position }])
    );
    defenseBundle = buildDefenseRatings(gameLogCache, playerMeta);
    logDefenseSpotCheck(defenseBundle);
    fs.writeFileSync(
      path.join(outDir, "defense-ratings.json"),
      JSON.stringify(defenseBundle, null, 2)
    );
    console.log(
      `defense ranks: ${defenseBundle.defense.length} rows, pace ${defenseBundle.pace.length}`
    );
    positionRanks = buildPlayerPositionRanks(gameLogCache, playerMeta);
    console.log(`position rank table: ${positionRanks.size} players with ranks`);
  } catch (e) {
    console.warn("defense ratings:", e instanceof Error ? e.message : e);
  }

  const matchupSignalsEnabled =
    MATCHUP_ENABLED &&
    Boolean(leagueBackfillReport && matchupSignalsReady(leagueBackfillReport));
  if (!MATCHUP_ENABLED) {
    console.log("matchup signals off: MATCHUP_ENABLED=false");
  } else if (leagueBackfillReport && !matchupSignalsEnabled) {
    console.log(matchupGateLogLine(leagueBackfillReport));
  }

  await refreshRecentFinalBoxScores(now, summaryCache);

  const oddsCachePath = path.join(outDir, "odds-cache.json");
  const cache: OddsCacheFile = loadOddsCache(oddsCachePath);
  const baselineOddsMap = { ...(cache.oddsMap ?? {}) };
  const baselineOddsMapKeys = oddsMapKeyCount(cache);
  const baselineLastPulled = cache.lastPulled;
  resetOddsDayIfNeeded(cache, now);
  console.log(
    `odds cache: ${baselineOddsMapKeys} global keys` +
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
  let oddsPullSucceeded = false;

  const monthKey = sydneyYmd(now).slice(0, 7);
  let supabaseClient: SupabaseUpsertClient | null = null;
  let budgetFromDb: OddsBudgetConfig = { ...DEFAULT_ODDS_BUDGET };
  try {
    const supabaseConn = await createSupabaseClient(rootDir);
    supabaseClient = supabaseConn.client;
    if (supabaseClient) {
      const fromDb = await loadOddsBudgetFromSupabase(supabaseClient, monthKey);
      budgetFromDb = fromDb ? { ...DEFAULT_ODDS_BUDGET, ...fromDb } : { ...DEFAULT_ODDS_BUDGET };
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`supabase sync failed: ${msg}`);
    supabaseClient = null;
  }

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

  const eveningSydney = sydneyHour(now) >= 21 && sydneyHour(now) < 22;
  if (eveningSydney && !forceOdds && !fromLive) {
    const pulled = new Set(cache.pullSlotsToday ?? []);
    if (pullTrigger === "scheduled_9pm") {
      console.log("scheduled: acted");
    } else if (pulled.has("scheduled_9pm")) {
      console.log("scheduled: already done");
    } else if (
      nextSlateTip &&
      cache.lastScheduled9pmSlate === nextSlateTip
    ) {
      console.log("scheduled: already done");
    }
  }

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
    shouldPauseOdds(cache.creditsRemaining, budgetFromDb?.monthlyLimit ?? 500, reserveCredits)
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
          reserveCredits,
        },
        trigger: pullTrigger,
        targetSlateDate: slateTipDateFromGames(targetSlate) ?? undefined,
        fixedGameCount: forceOdds && fixedOddsGames > 0 ? fixedOddsGames : undefined,
      });
      if (pull) {
        oddsMap = pull.oddsMap;
        allOddsMap = pull.allOddsMap;
        oddsPayloads = pull.payloads;
        const pulledAnything = pull.pulledGameIds.size > 0 && pull.creditsUsed > 0;
        if (pulledAnything) {
          oddsPullSucceeded = true;
          oddsPulledAt = now.toISOString();
          cache.lastPulled = oddsPulledAt;
          recordOddsPull(
            cache,
            now,
            pullTrigger,
            pullTrigger === "scheduled_9pm" ? nextSlateTip : undefined
          );
        } else {
          console.log("odds pull: empty — keeping prior cache and lastPulled");
        }
        sources.odds = pulledAnything ? "ok" : "stale";
        usedLiveOddsPull = pulledAnything;
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

  if (nextSlateTip) {
    const slatePlayers = filterPlayersForSlate(players, nextSlateGames);
    try {
      await ensurePlayerTracking(rootDir, nextSlateTip, slatePlayers);
    } catch (e) {
      console.warn("tracking refresh failed:", e);
    }
  }

  try {
    const byId = new Map(players.map((p) => [p.id, p]));
    let h2hReady = 0;
    await mapPool([...byId.values()], 4, async (p) => {
      const merged = await ensureH2hSeasonLogs({
        rootDir: outDir,
        playerId: p.id,
        asOf: now,
      });
      if (merged.length) {
        p.h2hLogs = merged;
        h2hReady += 1;
      }
    });
    console.log(`h2h season logs: ${h2hReady}/${byId.size} players (${3} ESPN seasons)`);
    const nextH2hKeys = recordKeyCount(loadH2hSeasonCache(outDir));
    if (espnCacheShrinkBlocked(baselineH2hSeasonKeys, nextH2hKeys) && blockEspnShrink()) {
      warnEspnCacheShrinkBlocked("h2h-season-cache", baselineH2hSeasonKeys, nextH2hKeys);
      saveH2hSeasonCache(outDir, baselineH2hSeasonCache);
    }
  } catch (e) {
    console.warn("h2h season logs:", e instanceof Error ? e.message : e);
  }

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
      defense: defenseBundle,
      matchupSignalsEnabled,
      positionRanks,
    });
    const forceOddsPullSucceeded = Boolean(forceOdds && oddsPullSucceeded);
    if (tip && (slateBest.size > 0 || forceOddsPullSucceeded)) {
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
      cache.oddsMap = mergeGlobalOddsMapRecord(
        cache.oddsMap,
        oddsMapToRecord(slateBest),
        { forceOddsPullSucceeded }
      );
      console.log(
        `odds cache: slate ${tip} · ${slateBest.size} merged keys (${slateMaps.best.size} cached)`
      );
    } else if (tip && slateBest.size === 0 && baselineOddsMapKeys > 0) {
      console.log(`odds cache: slate ${tip} · skip empty snapshot (keep ${baselineOddsMapKeys} global keys)`);
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
  const baselineHistory = history;
  const baselineHistoryCount = historyEntryCount(history);
  const picksById = new Map(todayPicks.map((p) => [p.id, p]));
  const boxesByGame = await loadFinalBoxesForGrading(now, summaryCache);
  history = gradeOpenLegs(history, picksById, boxesByGame);
  history = appendRecommendations(history, todayPicks, todayMultis, todayTip);

  const forceOddsPullSucceeded = Boolean(forceOdds && oddsPullSucceeded);
  const finalKeys = oddsMapKeyCount(cache);
  if (
    oddsMapDowngradeBlocked(baselineOddsMapKeys, finalKeys, { forceOddsPullSucceeded })
  ) {
    console.warn(
      `odds cache: blocked downgrade ${baselineOddsMapKeys}→${finalKeys} keys — keeping restored map`
    );
    cache.oddsMap = baselineOddsMap;
    if (!oddsPullSucceeded && baselineLastPulled) {
      cache.lastPulled = baselineLastPulled;
    }
  }

  fs.mkdirSync(outDir, { recursive: true });
  const nextHistoryCount = historyEntryCount(history);
  if (espnCacheShrinkBlocked(baselineHistoryCount, nextHistoryCount) && blockEspnShrink()) {
    warnEspnCacheShrinkBlocked("history.json", baselineHistoryCount, nextHistoryCount);
    history = baselineHistory;
  }
  fs.writeFileSync(path.join(outDir, "history.json"), JSON.stringify(history, null, 2));
  fs.writeFileSync(oddsCachePath, JSON.stringify(cache, null, 2));
  const mergedIndexEntries = rebuildIndexEntriesFromDisk(indexEntries, outDir, now);
  const defaultSlate =
    slatesToPublish.find(
      (s) => slateTipDateFromGames(s) === pipelineSydneyDates(now).todayYmd
    ) ?? slatesToPublish[0] ?? [];
  let nextIndex = buildDataIndex(mergedIndexEntries, now, {
    defaultSlate,
  });
  const forwardGames =
    scoreboardMerged.length > 0 ? scoreboardMerged : unionSlate;
  const forwardMeta = forwardSlateMetadataFromGames(forwardGames, now);
  if (forwardMeta) {
    nextIndex = applyForwardMetadata(nextIndex, forwardMeta);
    console.log(
      `index forward: ${JSON.stringify({
        nextSlateDate: forwardMeta.nextSlateDate,
        nextPublishAt: forwardMeta.nextPublishAt,
        firstTipAt: forwardMeta.firstTipAt,
        games: forwardMeta.games,
      })}`
    );
  } else {
    nextIndex = {
      ...nextIndex,
      nextSlateDate: null,
      nextPublishAt: undefined,
      games: undefined,
    };
    console.log("index forward: null (no upcoming slate on scoreboard)");
  }
  const branchFolders = listDataBranchRetainedFolders(rootDir, now);
  const dropReason = indexRetentionDropReason(priorIndex, nextIndex, now, {
    dataBranchFolders: branchFolders,
  });
  if (dropReason) {
    console.error(`index guard: blocked — ${dropReason}`);
    process.exit(1);
  }
  writeDataIndex(outDir, nextIndex);

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
    const tipPayloads =
      tip === slateTipDateFromGames(nextSlateGames) ? oddsPayloads : [];
    const officialCard = loadOfficialCard(path.join(outDir, tip));
    const tipDir = path.join(outDir, tip);
    const picksForSync = fs.existsSync(path.join(tipDir, "picks.json"))
      ? (JSON.parse(
          fs.readFileSync(path.join(tipDir, "picks.json"), "utf8")
        ) as import("../lib/types.js").PickLeg[])
      : undefined;
    syncBundles.push({
      slateDate: tip,
      slate: oneSlate,
      injuries,
      players,
      picks: picksForSync,
      officialCard: officialCard ?? undefined,
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
      defense: defenseBundle,
    });
  }
  if (republishCard) {
    const nextSlate = filterSlateToNextSydney(unionSlate);
    const nextTip = slateTipDateFromGames(nextSlate);
    if (!nextSlate.length || !nextTip) {
      logOfficialCard("blocked", "no next slate on board");
    } else if (slateFirstTipStarted(nextSlate, now)) {
      logOfficialCard("blocked", "next slate tip already started");
    } else {
      const slateDir = path.join(outDir, nextTip);
      const picksPath = path.join(slateDir, "picks.json");
      const multisPath = path.join(slateDir, "multis.json");
      const metaPath = path.join(slateDir, "meta.json");
      const injPath = path.join(slateDir, "injuries.json");
      if (
        fs.existsSync(picksPath) &&
        fs.existsSync(multisPath) &&
        fs.existsSync(metaPath)
      ) {
        const meta = JSON.parse(fs.readFileSync(metaPath, "utf8"));
        const multisRaw = JSON.parse(fs.readFileSync(multisPath, "utf8")) as {
          bets: import("../lib/types.js").MultiBet[];
          notBuilt: import("../lib/types.js").MultiNotBuilt[];
        };
        const injuriesSnap = fs.existsSync(injPath)
          ? (JSON.parse(fs.readFileSync(injPath, "utf8")) as InjuryEntry[])
          : injuries;
        const picksSnap = JSON.parse(
          fs.readFileSync(picksPath, "utf8")
        ) as import("../lib/types.js").PickLeg[];
        const existing = loadOfficialCard(slateDir);
        const republishedAt = now.toISOString();
        const official = writeOfficialCard(slateDir, {
          now,
          slate: nextSlate,
          multis: multisRaw.bets,
          notBuilt: multisRaw.notBuilt,
          injuries: injuriesSnap,
          meta,
          picks: picksSnap,
          republishedAt,
          preservePublishedAt: existing?.publishedAt,
        });
        meta.officialCard = {
          lockedAt: official.lockedAt,
          publishedAt: official.publishedAt ?? official.lockedAt,
          republishedAt: official.republishedAt,
          slateDate: nextTip,
          bookie: official.bookie,
        };
        fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2));
        logOfficialCard(
          existing ? "republished" : "published",
          `${nextTip}, ${official.bookie}`
        );
        const bundle = syncBundles.find((b) => b.slateDate === nextTip);
        if (bundle) bundle.officialCard = official;
        else {
          syncBundles.push({
            slateDate: nextTip,
            slate: nextSlate,
            injuries,
            players,
            ranking: rankingBySlateDate.get(nextTip) ?? [],
            officialCard: official,
          });
        }
      } else {
        logOfficialCard("blocked", `missing JSON under ${nextTip}`);
      }
    }
  }

  await safeFinalizePipelineSupabaseSync(rootDir, syncBundles);

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