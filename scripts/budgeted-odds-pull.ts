import type { SlateGame } from "../lib/types.js";
import type { PickLeg } from "../lib/types.js";
import type { GameInjuryRank } from "../lib/game-injury-ranking.js";
import {
  computeAllowance,
  formatBudgetLog,
  selectGamesForAllowance,
  shouldPauseForReserve,
  type OddsBudgetConfig,
} from "../lib/odds-budget.js";
import {
  listOddsEvents,
  matchOddsEventId,
  fetchOddsForEvent,
  extractOddsBundles,
} from "./fetch/odds-events.js";
import { isPostTipOff, mergeBestOddsMaps } from "../lib/odds-cache-merge.js";
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
}): Promise<BudgetedOddsResult | null> {
  const ranking = rankGamesByInjuryAngle(
    opts.targetSlate,
    opts.injuries,
    opts.picksForRanking
  );
  logGameInjuryRanks(ranking);

  const creditsPerGame = opts.budget.creditsPerGame ?? 10;
  const priorBest = oddsMapFromRecord(opts.cache.oddsMap ?? {});
  let creditsRemaining = opts.budget.creditsRemaining ?? opts.cache.creditsRemaining;
  const remainingBefore = creditsRemaining;

  if (shouldPauseForReserve(creditsRemaining, opts.budget.monthlyLimit)) {
    console.log("odds pull: paused — below 20% monthly reserve");
    return null;
  }

  const allowance = computeAllowance(opts.now, {
    ...opts.budget,
    creditsRemaining,
    creditsPerGame,
  });
  console.log(formatBudgetLog(allowance, creditsRemaining ?? 0));

  const selected = selectGamesForAllowance(
    ranking,
    allowance.allowance,
    1,
    creditsPerGame
  );
  if (!selected.length) {
    console.log("odds pull: no allowance for games this run");
    return {
      oddsMap: priorBest,
      allOddsMap: new Map(),
      payloads: [],
      pulledGameIds: new Set(),
      unpulledGameIds: new Set(opts.targetSlate.map((g) => g.id)),
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
    if (
      creditsRemaining != null &&
      shouldPauseForReserve(creditsRemaining, opts.budget.monthlyLimit)
    ) {
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
  const unpulled = new Set(
    opts.targetSlate.filter((g) => !pulledIds.has(g.id)).map((g) => g.id)
  );

  opts.cache.oddsMap = oddsMapToRecord(oddsMap);
  opts.cache.creditsRemaining = creditsRemaining;

  const priceCount = payloads.reduce((n, p) => {
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
    allOddsMap: bundles.all,
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