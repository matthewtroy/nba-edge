import type { SlateGame } from "../lib/types.js";
import type { PickLeg } from "../lib/types.js";
import type { GameInjuryRank } from "../lib/game-injury-ranking.js";
import {
  computeAllowance,
  formatBudgetLog,
  maxGamesAboveReserve,
  selectGamesForAllowance,
  shouldPauseForReserve,
  type OddsBudgetConfig,
} from "../lib/odds-budget.js";
import { oddsReserveCredits } from "../lib/odds-reserve.js";
import {
  listOddsEvents,
  matchOddsEventId,
  fetchOddsForEvent,
  extractOddsBundles,
} from "./fetch/odds-events.js";
import { isPostTipOff, mergeBestOddsMaps } from "../lib/odds-cache-merge.js";
import { oddsComboStatMarketCount, oddsMarketsForEventPull } from "../lib/odds-coverage.js";
import { rankGamesByInjuryAngle, logGameInjuryRanks } from "../lib/game-injury-ranking.js";
import { oddsMapFromRecord, oddsMapToRecord } from "./model-engine.js";
import type { OddsCacheFile } from "./odds-schedule.js";
import type { OddsPullTrigger } from "./odds-schedule.js";

export interface BudgetedOddsResult {
  oddsMap: Map<string, { price: number; bookie: string }>;
  allOddsMap: Map<string, Record<string, number>>;
  payloads: unknown[];
  pulledGameIds: Set<string>;
  unpulledGameIds: Set<string>;
  ranking: GameInjuryRank[];
  creditsUsed: number;
  creditsRemaining?: number;
  creditsPerGame: number;
  gameNames: string[];
}

export async function pullBudgetedOddsForSlate(opts: {
  apiKey: string;
  targetSlate: SlateGame[];
  unionSlate: SlateGame[];
  injuries: import("../lib/types.js").InjuryEntry[];
  picksForRanking: PickLeg[];
  cache: OddsCacheFile;
  now: Date;
  budget: OddsBudgetConfig;
  trigger: OddsPullTrigger;
  targetSlateDate?: string;
  /** When > 0, pull exactly this many top games (capped by reserve). */
  fixedGameCount?: number;
}): Promise<BudgetedOddsResult | null> {
  const ranking = rankGamesByInjuryAngle(
    opts.targetSlate,
    opts.injuries,
    opts.picksForRanking
  );
  logGameInjuryRanks(ranking);

  const creditsPerGame = opts.budget.creditsPerGame ?? 10;
  const marketsPerEvent = oddsMarketsForEventPull().length;
  const comboStatMarkets = oddsComboStatMarketCount();
  console.log(
    `odds pull: ${marketsPerEvent} API markets/event` +
      (comboStatMarkets
        ? ` (+${comboStatMarkets} combo stat markets; budget credits/game still ${creditsPerGame})`
        : "")
  );
  const priorBest = oddsMapFromRecord(opts.cache.oddsMap ?? {});
  let creditsRemaining = opts.budget.creditsRemaining ?? opts.cache.creditsRemaining;
  const remainingBefore = creditsRemaining;

  const reserve = opts.budget.reserveCredits ?? oddsReserveCredits();
  if (shouldPauseForReserve(creditsRemaining, reserve)) {
    console.log(`odds pull: paused — below ${reserve} credit reserve`);
    return null;
  }

  const allowance = computeAllowance(opts.now, {
    ...opts.budget,
    creditsRemaining,
    creditsPerGame,
    reserveCredits: reserve,
  });
  console.log(formatBudgetLog(allowance, creditsRemaining ?? 0));

  const capGames =
    creditsRemaining != null
      ? maxGamesAboveReserve(creditsRemaining, creditsPerGame, 1, reserve)
      : 0;

  let selected: typeof ranking;
  if (opts.fixedGameCount != null && opts.fixedGameCount > 0) {
    const n = Math.min(opts.fixedGameCount, capGames, ranking.length);
    selected = ranking.slice(0, n);
    console.log(
      `odds pull: fixed game count ${opts.fixedGameCount} → pulling ${n} (cap ${capGames} above reserve)`
    );
  } else {
    selected = selectGamesForAllowance(
      ranking,
      allowance.allowance,
      1,
      creditsPerGame
    );
  }
  if (!selected.length) {
    console.log("odds pull: no allowance for games this run");
    return {
      oddsMap: priorBest,
      allOddsMap: new Map(),
      payloads: [],
      pulledGameIds: new Set(),
      unpulledGameIds: new Set(),
      ranking,
      creditsUsed: 0,
      creditsRemaining,
      creditsPerGame,
      gameNames: [],
    };
  }

  const { events, remaining: remAfterList } = await listOddsEvents(opts.apiKey);
  if (remAfterList != null) creditsRemaining = remAfterList;

  const payloads: unknown[] = [];
  const pulledIds = new Set<string>();
  const gameNames: string[] = [];

  for (const row of selected) {
    const g = opts.targetSlate.find((x) => x.id === row.gameId);
    if (!g) continue;
    const oddsId = matchOddsEventId(g, events);
    if (!oddsId) continue;
    const { data, remaining: rem } = await fetchOddsForEvent(opts.apiKey, oddsId);
    if (rem != null) creditsRemaining = rem;
    if (data) {
      payloads.push(data);
      pulledIds.add(g.id);
      gameNames.push(`${g.awayTeam} @ ${g.homeTeam}`);
    }
    if (creditsRemaining != null && shouldPauseForReserve(creditsRemaining, reserve)) {
      break;
    }
  }

  const creditsUsed =
    remainingBefore != null && creditsRemaining != null
      ? Math.max(0, remainingBefore - creditsRemaining)
      : pulledIds.size + (payloads.length ? 1 : 0);

  const measuredPerGame =
    pulledIds.size > 0 ? creditsUsed / pulledIds.size : creditsPerGame;

  const bundles = extractOddsBundles(payloads);
  const postTip = isPostTipOff(opts.now, opts.unionSlate);
  const oddsMap = mergeBestOddsMaps(priorBest, bundles.best, { postTipOff: postTip });
  const allOddsMap = new Map<string, Record<string, number>>();
  const snap = opts.targetSlateDate
    ? opts.cache.bySlateDate?.[opts.targetSlateDate]
    : undefined;
  if (snap?.allOddsMap) {
    for (const [k, v] of Object.entries(snap.allOddsMap)) allOddsMap.set(k, v);
  }
  for (const [k, v] of bundles.all) allOddsMap.set(k, v);
  const unpulled = new Set(
    opts.targetSlate.filter((g) => !pulledIds.has(g.id)).map((g) => g.id)
  );

  opts.cache.oddsMap = oddsMapToRecord(oddsMap);
  opts.cache.creditsRemaining = creditsRemaining;

  const priceCount = payloads.reduce((n: number, p) => {
    const e = p as { bookmakers?: { markets?: { outcomes?: unknown[] }[] }[] };
    let c = 0;
    for (const bm of e.bookmakers ?? []) {
      for (const m of bm.markets ?? []) c += m.outcomes?.length ?? 0;
    }
    return n + c;
  }, 0);

  console.log(
    `odds pull: games [${gameNames.join(", ")}], ${priceCount} prices, credits used ${creditsUsed}, credits left ${creditsRemaining ?? "?"}`
  );

  return {
    oddsMap,
    allOddsMap,
    payloads,
    pulledGameIds: pulledIds,
    unpulledGameIds: unpulled,
    ranking,
    creditsUsed,
    creditsRemaining,
    creditsPerGame: measuredPerGame,
    gameNames,
  };
}