import type { PickLeg, MultiBet, MultiType, MultiNotBuilt, PlayerGameLog } from "./types.js";
import { q1MultiBlendP, passesQ1MultiHitGap } from "./q1-multi-probability.js";
import { nearestPricedRung } from "./nearest-bookie-line.js";
import {
  pickBestSameGameSgmCombo,
  pickCrossGameLegsForGame,
  SGM_NO_ODDS_MIN,
  SGM_NO_ODDS_MAX,
  CROSS_SGM_MIN_GAMES,
  CROSS_LEGS_PER_GAME,
  SGM_MIN_LEG_PRICE,
} from "./same-game-sgm-search.js";
import { qualifiesCrossGameSgmLeg } from "./cross-game-sgm-leg.js";
import {
  qualifiesGamesTabSgmLeg,
  crossGameExcludedReason,
} from "./games-tab-sgm.js";
import type { CrossGameSgmGroup, SlateGame } from "./types.js";
import { crossGameMultiHasClash, legsClash, multiHasClash } from "./clash.js";
import { isMainPlayStatLine } from "./starter-eligibility.js";
import {
  qualifiesCrossBoostLeg,
  qualifiesLongshotLeg,
  qualifiesMainPlayLeg,
  mainPlayQualifiersOk,
} from "./main-play-eligibility.js";
import { legBookiePriceInBand } from "./leg-bookie-band.js";
import { passesFormGuard } from "./form-guard.js";
import {
  enforceExposureCapWithDrops,
  playerNamesOnMulti,
} from "./exposure.js";
import { bestFeedMultiQuote } from "./card-bookie.js";
import {
  asBookieLeg,
  bookiesByCoverage,
  legMeetsBookieEdge,
  overlayForBookie,
} from "./bookie-edge-pool.js";
import { pushMultiBuildTrace, resetMultiBuildTraces } from "./multi-build-trace.js";
import { combinedPriceForBookie, legPriceAtBookie } from "./single-bookie.js";
import { multiBookieTotals } from "./bookie-totals.js";
import { multiClashSummary } from "./clash.js";
import { gateAllMultis } from "./multi-gate.js";
import { slateMatchupAbbrev } from "./team-abbrev.js";
import { bookieMarketLabel } from "./market-label.js";
import { isInjuryRedistributionReason } from "./injury-reason.js";
import { legHasSupportiveReason } from "./picks-supportive-filter.js";
import { logMultiBuildSummary } from "./multi-filter-log.js";
import {
  countQ1MultiFilters,
  formatQ1MultiFilterCounts,
} from "./q1-multi-filter-counts.js";
import {
  combinedFairAndTakeAt,
  DEFAULT_MIN_EDGE,
} from "./multi-combined.js";
import {
  MAIN_PLAY_COMBINED_MIN,
  MAIN_PLAY_COMBINED_MAX,
  MAIN_PLAY_SWEET_MIN,
  MAIN_PLAY_SWEET_MAX,
  compareMainPlayCandidates,
  mainPlayInSweetSpot,
  DOUBLE_UP_MIN,
  DOUBLE_UP_MAX,
  DOUBLE_UP_EXTRA_LEG_PP,
  requiredEdge,
  actualEdgeFraction,
  edgeSurplus,
  formatEdgeShortfall,
} from "./pricing-config.js";

export interface MultiBuildResult {
  bets: MultiBet[];
  notBuilt: MultiNotBuilt[];
  gateViolations: string[];
  mainPlayConfluenceRelaxed?: boolean;
}

export const MIN_LEG_FAIR = 1.3;

let multiMinEdge = DEFAULT_MIN_EDGE;

function combinedPrice(legs: PickLeg[]): {
  p: number;
  fair: number;
  takeAt: number;
} {
  return combinedFairAndTakeAt(legs, multiMinEdge);
}

function legMeetsTakeAt(leg: PickLeg): boolean {
  return leg.bestPrice != null && leg.bestPrice >= leg.takeAt;
}

function comboProduct(legs: PickLeg[], bookie?: string): number {
  if (bookie) {
    return combinedPriceForBookie(legs, bookie) ?? 0;
  }
  return combinedBetPrice(legs);
}

function combinedProb(legs: PickLeg[]): number {
  return legs.reduce((acc, l) => acc * l.probability, 1);
}

function betterBookiePick(
  current: { p: number; total: number } | null,
  p: number,
  total: number
): boolean {
  if (!current) return true;
  if (Math.abs(p - current.p) > 1e-9) return p > current.p;
  return total > current.total;
}

export function combinedBetPrice(legs: PickLeg[]): number {
  if (legs.length > 0 && legs.every((l) => legMeetsTakeAt(l))) {
    return Math.round(legs.reduce((acc, l) => acc * (l.bestPrice ?? 1), 1) * 100) / 100;
  }
  return Math.round(legs.reduce((acc, l) => acc * l.takeAt, 1) * 100) / 100;
}

const NO_AU_MULTI = "No valid multi at any AU bookie (edge + clash + range)";

function singleBookieOverlay(legs: PickLeg[]): {
  bestBookie: string;
  bestBookieTotal: number;
  bookieTotals: Record<string, number>;
} | null {
  const pricedLegs = legs.map((l) =>
    l.bookiePrices && Object.keys(l.bookiePrices).length
      ? l
      : l.bestPrice != null && l.bestBookie
        ? { ...l, bookiePrices: { [l.bestBookie]: l.bestPrice } }
        : l
  );
  const bookieTotals = multiBookieTotals(pricedLegs) as Record<string, number>;
  const feed = bestFeedMultiQuote(pricedLegs);
  if (!feed) return null;
  return {
    bookieTotals,
    bestBookie: feed.bookie,
    bestBookieTotal: feed.total,
  };
}

function legEdge(leg: PickLeg): number {
  if (leg.bestPrice == null) return 0;
  return leg.bestPrice - leg.takeAt;
}

function injuryBoostScore(leg: PickLeg): number {
  return leg.reasons.some(
    (r) => r.type === "injury" || isInjuryRedistributionReason(r.text)
  )
    ? 1
    : 0;
}

function longshotAngleScore(leg: PickLeg): number {
  let s = injuryBoostScore(leg) * 4;
  if (leg.signals?.ANGLE?.active) s += 3;
  if (leg.reasons.some((r) => r.type === "angle")) s += 2;
  if (/Min up/i.test(leg.reasonLine ?? "")) s += 2;
  return s;
}

function qualifiesAngleLongshotAt(
  leg: PickLeg,
  bookie: string,
  minEdgeFraction: number
): boolean {
  if (
    !qualifiesLongshotLeg(leg) &&
    !["pts", "reb", "ast", "dd", "td"].includes(leg.market)
  ) {
    return false;
  }
  if (leg.market === "3pm") return false;
  if ((leg.projectedMinutes ?? 0) < 20) return false;
  const price = legPriceAtBookie(leg, bookie);
  if (price == null || price <= 1) return false;
  if (legMeetsBookieEdge(leg, bookie, minEdgeFraction)) return true;
  return (
    longshotAngleScore(leg) >= 2 &&
    leg.probability >= 0.25 &&
    price >= leg.fairPrice * 0.95
  );
}

function last10HitsAtLine(leg: PickLeg): number {
  return (leg.recentTenVsLine ?? []).filter((t) => t === "hit").length;
}

function last5HitsAtLine(leg: PickLeg): number {
  return (leg.recentVsLine ?? []).filter((t) => t === "hit").length;
}

function hasCheckNews(leg: PickLeg): boolean {
  return leg.tags.includes("Check news");
}

function isCoreMarket(market: string): boolean {
  return market === "pts" || market === "reb" || market === "ast";
}

function threesCount(legs: PickLeg[]): number {
  return legs.filter((l) => l.market === "3pm").length;
}

export function sortLegsForSelection(a: PickLeg, b: PickLeg): number {
  const inj = injuryBoostScore(b) - injuryBoostScore(a);
  if (inj !== 0) return inj;
  const l10 = last10HitsAtLine(b) - last10HitsAtLine(a);
  if (l10 !== 0) return l10;
  if (b.probability !== a.probability) return b.probability - a.probability;
  const edge = legEdge(b) - legEdge(a);
  if (edge !== 0) return edge;
  const coldA = injuryBoostScore(a) === 0 && last5HitsAtLine(a) <= 2 ? 1 : 0;
  const coldB = injuryBoostScore(b) === 0 && last5HitsAtLine(b) <= 2 ? 1 : 0;
  return coldA - coldB;
}

function sortLegs(a: PickLeg, b: PickLeg): number {
  return sortLegsForSelection(a, b);
}

function nextRung(leg: PickLeg, picks: PickLeg[]): PickLeg | undefined {
  const same = picks.filter(
    (p) => p.playerId === leg.playerId && p.market === leg.market && p.line > leg.line
  );
  same.sort((a, b) => a.line - b.line);
  return same[0];
}

function meetsFloor(leg: PickLeg): boolean {
  return leg.fairPrice >= MIN_LEG_FAIR;
}

const LABELS: Record<MultiType, string> = {
  mainPlay: "Main Play",
  doubleUp: "Best Double Up",
  booster: "Booster",
  q1Multi: "Q1 Multi",
  crossGameSgm: "Cross-Game SGM Multi",
  boostSgm: "Best SGM",
  longshot: "Longshot",
};

export function buildMultis(
  picks: PickLeg[],
  slateSize: number,
  targetProfit = 300,
  minEdgeFraction = DEFAULT_MIN_EDGE,
  q1ExclusionNotes: string[] = [],
  logsByPlayer?: Map<string, PlayerGameLog[]>,
  slateGames: SlateGame[] = []
): MultiBuildResult {
  multiMinEdge = minEdgeFraction;
  resetMultiBuildTraces();
  const pool = picks.filter(
    (p) => meetsFloor(p) && (p.market.startsWith("q1") || legHasSupportiveReason(p))
  );
  const catalog = pool;
  const byP = [...pool].sort(sortLegs);
  const notBuilt: MultiNotBuilt[] = [];
  const multis: MultiBet[] = [];

  const main = buildMainPlay(byP, targetProfit, slateSize, minEdgeFraction, catalog);
  let mainPlayConfluenceRelaxed = false;
  if (main.bet) {
    multis.push(main.bet);
    mainPlayConfluenceRelaxed = main.confluenceRelaxed === true;
  } else notBuilt.push({ type: "mainPlay", label: LABELS.mainPlay, reason: main.reason });

  const doubleUp = buildDoubleUp(byP, minEdgeFraction, catalog);
  if (doubleUp.bet) multis.push(doubleUp.bet);
  else notBuilt.push({ type: "doubleUp", label: LABELS.doubleUp, reason: doubleUp.reason });

  if (main.bet) {
    const booster = buildBooster(main.bet, pool, catalog);
    if (booster.bet) multis.push(booster.bet);
    else notBuilt.push({ type: "booster", label: LABELS.booster, reason: booster.reason });
  } else {
    notBuilt.push({ type: "booster", label: LABELS.booster, reason: "Needs a Main Play first" });
  }

  const q1Attempt = buildQ1Multi(byP, q1ExclusionNotes, logsByPlayer);
  multis.push(...q1Attempt.bets);

  const cross = buildCrossGameSgm(byP, minEdgeFraction, catalog, slateGames);
  if (cross.bet) multis.push(cross.bet);
  else notBuilt.push({ type: "crossGameSgm", label: LABELS.crossGameSgm, reason: cross.reason });

  const boostSgm = buildBoostSgm(byP, minEdgeFraction, catalog);
  if (boostSgm.bet) multis.push(boostSgm.bet);
  else notBuilt.push({ type: "boostSgm", label: LABELS.boostSgm, reason: boostSgm.reason });

  const longshot = buildLongshot(byP, minEdgeFraction, catalog);
  if (longshot.bets.length) multis.push(...longshot.bets);
  else notBuilt.push({ type: "longshot", label: LABELS.longshot, reason: longshot.reason });

  const picksById = new Map(pool.map((p) => [p.id, p]));
  const clashDropped: { multi: MultiBet; reason: string }[] = [];
  let filtered: MultiBet[] = [];
  for (const m of multis) {
    const legs = m.legs.map((id) => picksById.get(id)).filter(Boolean) as PickLeg[];
    if (legs.length !== m.legs.length) {
      clashDropped.push({
        multi: m,
        reason: `${LABELS[m.type]}: missing pick for leg id`,
      });
      continue;
    }
    if (m.type !== "q1Multi") {
      const clashes =
        m.type === "crossGameSgm" ? crossGameMultiHasClash(legs) : multiHasClash(legs);
      if (clashes) {
        clashDropped.push({
          multi: m,
          reason: `Clash rule: ${multiClashSummary(legs)}`,
        });
        continue;
      }
    }
    filtered.push(m);
  }

  const { kept, dropped: exposureDropped } = enforceExposureCapWithDrops(
    filtered,
    picksById
  );
  filtered = kept;

  const pushDrop = (multi: MultiBet, reason: string, players?: string[]) => {
    if (multi.type === "longshot" && notBuilt.some((n) => n.type === "longshot")) return;
    if (notBuilt.some((n) => n.type === multi.type && n.variant === multi.variant)) return;
    notBuilt.push({
      type: multi.type,
      label: LABELS[multi.type],
      variant: multi.variant,
      reason,
      players: players ?? playerNamesOnMulti(multi, picksById),
    });
  };

  for (const d of clashDropped) pushDrop(d.multi, d.reason);
  for (const d of exposureDropped) pushDrop(d.multi, d.reason, d.players);

  const gated = gateAllMultis(filtered, picksById, catalog);
  for (const m of gated.dropped) {
    const legs = m.legs.map((id) => picksById.get(id)).filter(Boolean) as PickLeg[];
    const legSummary = legs
      .map((l) => `${l.playerName} ${bookieMarketLabel(l.market, l.line)}`)
      .join(", ");
    const key = `${m.type}|${m.variant ?? ""}|${m.legs.join(",")}`;
    const detail =
      (gated.droppedReasons.get(key) ?? []).slice(0, 3).join("; ") || "rule gate";
    pushDrop(m, `Gate: ${detail} (legs: ${legSummary})`);
  }

  let finalBets = gated.multis;
  if (!finalBets.some((m) => m.type === "mainPlay")) {
    const booster = finalBets.find((m) => m.type === "booster");
    if (booster) {
      finalBets = finalBets.filter((m) => m.type !== "booster");
      pushDrop(booster, "Booster: Main Play not built or removed");
    }
  }
  if (q1Attempt.coreNotBuiltReason) {
    if (
      !finalBets.some((m) => m.type === "q1Multi") &&
      !notBuilt.some((n) => n.type === "q1Multi")
    ) {
      notBuilt.push({
        type: "q1Multi",
        label: LABELS.q1Multi,
        reason: q1Attempt.coreNotBuiltReason,
      });
    }
  }

  logMultiBuildSummary({ picks, pool, built: finalBets, notBuilt });

  return {
    bets: finalBets,
    notBuilt,
    gateViolations: gated.violations,
    ...(mainPlayConfluenceRelaxed ? { mainPlayConfluenceRelaxed: true } : {}),
  };
}

export { qualifiesMainPlayLeg } from "./main-play-eligibility.js";

function countPerGame(chosen: PickLeg[], gameId: string): number {
  return chosen.filter((l) => l.gameId === gameId).length;
}

function canAddToGame(chosen: PickLeg[], leg: PickLeg, slateSize: number): boolean {
  const n = countPerGame(chosen, leg.gameId);
  if (n === 0) return true;
  if (slateSize <= 3 && n === 1) return true;
  return false;
}

function hasQuestionableAnchor(legs: PickLeg[]): boolean {
  if (!legs.length) return false;
  const top = [...legs].sort((a, b) => b.probability - a.probability)[0];
  return Boolean(top.questionable);
}

function mainPlayPoolAtBookie(
  eligible: PickLeg[],
  bookie: string,
  minEdgeFraction: number,
  catalog: PickLeg[]
): PickLeg[] {
  const edge = eligible.filter((l) => legMeetsBookieEdge(l, bookie, minEdgeFraction));
  const priced = edge
    .map((l) => asBookieLeg(l, bookie, catalog))
    .filter((l): l is PickLeg => l != null);
  return priced.sort(sortLegs);
}

function doubleUpScore(legs: PickLeg[]): number {
  const p = combinedProb(legs);
  const extra = Math.max(0, legs.length - 2);
  return p - extra * DOUBLE_UP_EXTRA_LEG_PP;
}

function qualifiesDoubleUpStructural(leg: PickLeg): boolean {
  return (
    leg.starterEligible === true &&
    isMainPlayStatLine(leg.market, leg.line) &&
    !leg.market.startsWith("q1") &&
    passesFormGuard(leg) &&
    !leg.tags.includes("Check news")
  );
}

function buildDoubleUp(
  picks: PickLeg[],
  minEdgeFraction: number,
  catalog: PickLeg[]
): { bet: MultiBet | null; reason: string } {
  const structural = picks.filter(qualifiesDoubleUpStructural);
  if (structural.length < 2) {
    const reason = `Only ${structural.length} starter main lines for Double Up (need 2+)`;
    pushMultiBuildTrace({
      type: "doubleUp",
      eligible: structural.length,
      bestEdgePool: 0,
      clashCandidates: 0,
      rangeCandidates: 0,
      built: false,
      detail: reason,
    });
    return { bet: null, reason };
  }

  type DoubleCand = {
    legs: PickLeg[];
    bookie: string;
    p: number;
    total: number;
    score: number;
  };
  const holder: { best: DoubleCand | null } = { best: null };
  let maxEdgePool = 0;
  let maxEdgeBookie = "";
  let maxRange = 0;
  let clashSkipped = 0;

  for (const bookie of bookiesByCoverage(structural)) {
    const pool = structural
      .filter((l) => legMeetsBookieEdge(l, bookie, minEdgeFraction))
      .map((l) => asBookieLeg(l, bookie, catalog))
      .filter((l): l is PickLeg => l != null)
      .sort(sortLegs)
      .slice(0, 24);
    if (pool.length > maxEdgePool) {
      maxEdgePool = pool.length;
      maxEdgeBookie = bookie;
    }
    if (pool.length < 2) continue;

    const tryCand = (chosen: PickLeg[]) => {
      if (multiHasClash(chosen)) {
        clashSkipped += 1;
        return;
      }
      const total = comboProduct(chosen, bookie);
      if (total < DOUBLE_UP_MIN || total > DOUBLE_UP_MAX) return;
      maxRange += 1;
      const p = combinedProb(chosen);
      const score = doubleUpScore(chosen);
      const cur = holder.best;
      const better =
        !cur ||
        score > cur.score + 1e-12 ||
        (Math.abs(score - cur.score) < 1e-12 &&
          (p > cur.p + 1e-12 ||
            (Math.abs(p - cur.p) < 1e-12 && total > cur.total)));
      if (better) holder.best = { legs: chosen, bookie, p, total, score };
    };

    for (let i = 0; i < pool.length; i++) {
      for (let j = i + 1; j < pool.length; j++) {
        tryCand([pool[i], pool[j]]);
        for (let k = j + 1; k < pool.length; k++) {
          tryCand([pool[i], pool[j], pool[k]]);
        }
      }
    }
  }

  const best = holder.best;
  if (!best) {
    const reason =
      maxEdgePool < 2
        ? `No bookie with 2+ Double Up legs at edge (best ${maxEdgeBookie}=${maxEdgePool})`
        : `No 2–3 leg Double Up @ $${DOUBLE_UP_MIN}–$${DOUBLE_UP_MAX} (edge best ${maxEdgeBookie}=${maxEdgePool}, range-cands ${maxRange})`;
    pushMultiBuildTrace({
      type: "doubleUp",
      eligible: structural.length,
      bestEdgePool: maxEdgePool,
      bestBookie: maxEdgeBookie,
      clashCandidates: clashSkipped,
      rangeCandidates: maxRange,
      built: false,
      detail: reason,
    });
    return { bet: null, reason };
  }

  const { p, fair, takeAt } = combinedPrice(best.legs);
  pushMultiBuildTrace({
    type: "doubleUp",
    eligible: structural.length,
    bestEdgePool: maxEdgePool,
    bestBookie: best.bookie,
    clashCandidates: clashSkipped,
    rangeCandidates: maxRange,
    built: true,
    detail: `${best.legs.length} legs @ ${best.bookie} $${best.total.toFixed(2)}`,
  });

  return {
    bet: {
      type: "doubleUp",
      label: "Best Double Up",
      legs: best.legs.map((l) => l.id),
      combinedProbability: p,
      combinedFairPrice: fair,
      combinedTakeAt: takeAt,
      ...overlayForBookie(best.legs, best.bookie, catalog),
      summary: `${best.legs.length} legs · aim ~$2 @ one bookie`,
    },
    reason: "",
  };
}

function buildMainPlay(
  picks: PickLeg[],
  _targetProfit: number,
  slateSize: number,
  minEdgeFraction: number,
  catalog: PickLeg[]
): { bet: MultiBet | null; reason: string; confluenceRelaxed?: boolean } {
  const attempt = (
    eligible: PickLeg[]
  ): { bet: MultiBet | null; reason: string } => {
  if (eligible.length < 3) {
    const reason = `Only ${eligible.length} legs meet fair 1.40–2.50, p≥0.60 (need 3–5)`;
    pushMultiBuildTrace({
      type: "mainPlay",
      eligible: eligible.length,
      bestEdgePool: 0,
      clashCandidates: 0,
      rangeCandidates: 0,
      built: false,
      detail: reason,
    });
    return { bet: null, reason };
  }

  let best: {
    legs: PickLeg[];
    bookie: string;
    p: number;
    total: number;
    surplus: number;
  } | null = null;
  let maxEdgePool = 0;
  let maxEdgeBookie = "";
  let maxRange = 0;
  let maxClash = 0;
  let bestShortfall: string | null = null;

  for (const bookie of bookiesByCoverage(eligible)) {
    const banded = eligible.filter((l) => qualifiesMainPlayLeg(l, bookie));
    const pool = mainPlayPoolAtBookie(banded, bookie, minEdgeFraction, catalog);
    if (pool.length > maxEdgePool) {
      maxEdgePool = pool.length;
      maxEdgeBookie = bookie;
    }
    if (pool.length < 3) continue;
    const found = findMainPlaySubset(pool, slateSize, bookie);
    maxRange = Math.max(maxRange, found.rangeCandidates);
    maxClash = Math.max(maxClash, found.clashCandidates);
    if (found.shortfall) bestShortfall = found.shortfall;
    if (!found.legs) continue;
    const total = comboProduct(found.legs, bookie);
    const p = combinedProb(found.legs);
    const fair = 1 / p;
    const surplus = edgeSurplus(total, fair);
    const candidate = { total, surplus, p };
    if (
      best &&
      compareMainPlayCandidates(candidate, {
        total: best.total,
        surplus: best.surplus,
        p: best.p,
      }) >= 0
    ) {
      continue;
    }
    best = { legs: found.legs, bookie, p, total, surplus };
  }

  if (!best) {
    const reason =
      maxEdgePool < 3
        ? `No bookie with 3+ main legs at edge (best ${maxEdgeBookie}=${maxEdgePool})`
        : bestShortfall
          ? `Main Play edge shortfall: ${bestShortfall}`
          : `No 3–5 leg main @ edge+clash+bookie total $${MAIN_PLAY_COMBINED_MIN}–$${MAIN_PLAY_COMBINED_MAX} (edge best ${maxEdgeBookie}=${maxEdgePool}, range-cands ${maxRange})`;
    pushMultiBuildTrace({
      type: "mainPlay",
      eligible: eligible.length,
      bestEdgePool: maxEdgePool,
      bestBookie: maxEdgeBookie,
      clashCandidates: maxClash,
      rangeCandidates: maxRange,
      built: false,
      detail: reason,
    });
    return { bet: null, reason };
  }

  const { p, fair, takeAt } = combinedPrice(best.legs);
  pushMultiBuildTrace({
    type: "mainPlay",
    eligible: eligible.length,
    bestEdgePool: maxEdgePool,
    bestBookie: best.bookie,
    clashCandidates: maxClash,
    rangeCandidates: maxRange,
    built: true,
      detail: `${best.legs.length} legs @ ${best.bookie} $${best.total.toFixed(2)} · path ${
        mainPlayInSweetSpot(best.total) ? "sweetSpot" : "fullBand"
      } $${MAIN_PLAY_SWEET_MIN}–$${MAIN_PLAY_SWEET_MAX}`,
  });

  return {
    bet: {
      type: "mainPlay",
      label: "Main Play",
      legs: best.legs.map((l) => l.id),
      combinedProbability: p,
      combinedFairPrice: fair,
      combinedTakeAt: takeAt,
      ...overlayForBookie(best.legs, best.bookie, catalog),
      summary: `${best.legs.length} starter main lines`,
    },
    reason: "",
  };
  };

  const structural = picks.filter((l) => mainPlayQualifiersOk(l));
  const out = attempt(structural);
  return { ...out, confluenceRelaxed: false };
}

function findMainPlaySubset(
  pool: PickLeg[],
  slateSize: number,
  bookie?: string
): {
  legs: PickLeg[] | null;
  rangeCandidates: number;
  clashCandidates: number;
  shortfall?: string;
} {
  const byGame = new Map<string, PickLeg[]>();
  for (const leg of pool) {
    const arr = byGame.get(leg.gameId) ?? [];
    arr.push(leg);
    byGame.set(leg.gameId, arr);
  }
  const gameIds = [...byGame.keys()];
  const candidates: PickLeg[][] = [];
  let clashSkipped = 0;

  function dfs(depth: number, chosen: PickLeg[]) {
    if (depth >= 3 && depth <= 5) {
      const combo = comboProduct(chosen, bookie);
      if (
        combo >= MAIN_PLAY_COMBINED_MIN &&
        combo <= MAIN_PLAY_COMBINED_MAX &&
        threesCount(chosen) <= 1 &&
        !multiHasClash(chosen) &&
        !hasQuestionableAnchor(chosen)
      ) {
        candidates.push([...chosen]);
      } else if (
        combo >= MAIN_PLAY_COMBINED_MIN &&
        combo <= MAIN_PLAY_COMBINED_MAX &&
        threesCount(chosen) <= 1 &&
        multiHasClash(chosen)
      ) {
        clashSkipped += 1;
      }
    }
    if (depth >= 5) return;
    for (const gid of gameIds) {
      for (const leg of (byGame.get(gid) ?? []).slice(0, 8)) {
        if (!canAddToGame(chosen, leg, slateSize)) continue;
        const next = [...chosen, leg];
        if (threesCount(next) > 1) continue;
        if (multiHasClash(next)) continue;
        dfs(depth + 1, next);
      }
    }
  }
  dfs(0, []);

  if (!candidates.length) {
    return { legs: null, rangeCandidates: 0, clashCandidates: clashSkipped };
  }

  type Ranked = {
    legs: PickLeg[];
    total: number;
    p: number;
    surplus: number;
    actual: number;
    req: number;
  };
  const passing: Ranked[] = [];
  let worstShort: Ranked | null = null;

  for (const legs of candidates) {
    const total = comboProduct(legs, bookie);
    const p = combinedProb(legs);
    const fair = 1 / p;
    const actual = actualEdgeFraction(total, fair);
    const req = requiredEdge(total);
    const surplus = edgeSurplus(total, fair);
    const row: Ranked = { legs, total, p, surplus, actual, req };
    if (actual + 1e-12 >= req) passing.push(row);
    else if (
      !worstShort ||
      actual > worstShort.actual + 1e-12 ||
      (Math.abs(actual - worstShort.actual) < 1e-12 && total > worstShort.total)
    ) {
      // Keep the closest miss (highest actual edge under the curve) for notBuilt copy.
      worstShort = row;
    }
  }

  if (!passing.length) {
    const shortfall = worstShort
      ? formatEdgeShortfall(worstShort.total, worstShort.actual, worstShort.req)
      : undefined;
    return {
      legs: null,
      rangeCandidates: candidates.length,
      clashCandidates: clashSkipped,
      shortfall,
    };
  }

  passing.sort(compareMainPlayCandidates);

  return {
    legs: passing[0].legs,
    rangeCandidates: candidates.length,
    clashCandidates: clashSkipped,
  };
}

function treblePrice(three: PickLeg[]): number {
  return combinedBetPrice(three);
}

function boostMainLegs(
  main: MultiBet,
  picks: PickLeg[],
  bookie: string,
  catalog: PickLeg[]
): { legs: PickLeg[] | null; fail?: string } {
  const picksById = new Map(picks.map((p) => [p.id, p]));
  const boosted: PickLeg[] = [];

  for (const id of main.legs) {
    const leg = picksById.get(id);
    if (!leg) return { legs: null, fail: `missing Main leg ${id}` };
    if (!meetsFloor(leg)) {
      return { legs: null, fail: `${leg.playerName}: below fair floor` };
    }
    const mainAtBookie =
      nearestPricedRung(leg, bookie, catalog)?.price ?? legPriceAtBookie(leg, bookie);
    let useLeg = leg;
    if (mainAtBookie != null && mainAtBookie <= 4) {
      const up = nextRung(leg, picks);
      if (up && meetsFloor(up)) useLeg = up;
    }
    const priced = asBookieLeg(useLeg, bookie, catalog);
    if (!priced) {
      return {
        legs: null,
        fail: `${leg.playerName} ${useLeg.line}+ ${useLeg.market}: no ${bookie} line`,
      };
    }
    boosted.push(priced);
  }
  if (multiHasClash(boosted)) {
    return { legs: null, fail: "Booster clash: same-game or stat conflict" };
  }
  return { legs: boosted };
}

function buildBooster(
  main: MultiBet,
  picks: PickLeg[],
  catalog: PickLeg[]
): { bet: MultiBet | null; reason: string } {
  const bookie = main.bestBookie;
  if (!bookie) {
    return { bet: null, reason: "Booster: Main Play missing bookie" };
  }
  const picksById = new Map(picks.map((p) => [p.id, p]));
  const mainLegs = main.legs
    .map((id) => picksById.get(id))
    .filter(Boolean) as PickLeg[];
  if (mainLegs.length !== main.legs.length) {
    return { bet: null, reason: "Booster leg missing" };
  }

  const boost = boostMainLegs(main, picks, bookie, catalog);
  const boosted = boost.legs;
  if (!boosted?.length) {
    const detail = boost.fail ?? "rung/clash/edge at main bookie";
    pushMultiBuildTrace({
      type: "booster",
      eligible: mainLegs.length,
      bestEdgePool: 0,
      bestBookie: bookie,
      clashCandidates: 0,
      rangeCandidates: 0,
      built: false,
      detail,
    });
    return { bet: null, reason: `Booster: ${detail}` };
  }

  const { p, fair, takeAt } = combinedPrice(boosted);
  const book = overlayForBookie(boosted, bookie, catalog);
  const triCandidates: PickLeg[][] = [];
  for (let i = 0; i < boosted.length - 2; i++) {
    for (let j = i + 1; j < boosted.length - 1; j++) {
      for (let k = j + 1; k < boosted.length; k++) {
        triCandidates.push([boosted[i], boosted[j], boosted[k]]);
      }
    }
  }
  const bestTreble = triCandidates.reduce(
    (mx, t) => Math.max(mx, comboProduct(t, bookie)),
    0
  );
  const trixieNote = bestTreble >= 60 ? " · Trixie if treble ≥60" : "";

  pushMultiBuildTrace({
    type: "booster",
    eligible: mainLegs.length,
    bestEdgePool: boosted.length,
    bestBookie: bookie,
    clashCandidates: 0,
    rangeCandidates: 1,
    built: true,
    detail: `${boosted.length} legs @ ${bookie} $${book.bestBookieTotal.toFixed(2)}`,
  });

  return {
    bet: {
      type: "booster",
      label: "Booster",
      legs: boosted.map((l) => l.id),
      combinedProbability: p,
      combinedFairPrice: fair,
      combinedTakeAt: takeAt,
      ...book,
      summary: `Main Play +1 rung when Main leg ≤$4 at bookie, else same rung${trixieNote}`,
    },
    reason: "",
  };
}

function findQ1Subset(
  teamKeys: string[],
  byTeam: Map<string, PickLeg[]>,
  minFair: number,
  maxFair: number,
  opts?: { minProbability?: number; safeOnly?: boolean }
): PickLeg[] | null {
  const candidates: PickLeg[][] = [];

  function dfs(ti: number, chosen: PickLeg[]) {
    if (chosen.length >= 3 && chosen.length <= 6) {
      const combo = combinedBetPrice(chosen);
      if (!multiHasClash(chosen)) {
        candidates.push([...chosen]);
      }
      if (chosen.length === 6) return;
    }
    if (chosen.length >= 6 || ti >= teamKeys.length) return;
    const key = teamKeys[ti];
    const legs = (byTeam.get(key) ?? []).filter((l) => {
      if (opts?.minProbability != null && l.probability < opts.minProbability) {
        return false;
      }
      if (opts?.safeOnly) return true;
      return l.fairPrice >= minFair && l.fairPrice <= maxFair;
    });
    dfs(ti + 1, chosen);
    for (const leg of legs.slice(0, 12)) {
      const next = [...chosen, leg];
      if (multiHasClash(next)) continue;
      dfs(ti + 1, next);
    }
  }
  dfs(0, []);

  if (!candidates.length) return null;
  const sortValue = maxFair <= 4 && minFair >= 2;
  candidates.sort((a, b) => {
    if (sortValue) {
      const pa = a.reduce((acc, l) => acc * l.probability, 1);
      const pb = b.reduce((acc, l) => acc * l.probability, 1);
      if (pb !== pa) return pb - pa;
    }
    const ca = combinedBetPrice(a);
    const cb = combinedBetPrice(b);
    if (cb !== ca) return cb - ca;
    return b.length - a.length;
  });
  return candidates[0];
}

function q1MultiFromLegs(
  legs: PickLeg[],
  variant: string | undefined,
  summary: string
): MultiBet {
  const { p, fair, takeAt } = combinedPrice(legs);
  const feed = bestFeedMultiQuote(legs);
  return {
    type: "q1Multi",
    label: "Q1 Multi",
    variant,
    legs: legs.map((l) => l.id),
    combinedProbability: p,
    combinedFairPrice: fair,
    combinedTakeAt: takeAt,
    bookieTotals: (feed
      ? multiBookieTotals(legs)
      : {}) as Record<string, number>,
    ...(feed
      ? {
          bestBookie: feed.bookie,
          bestBookieTotal: feed.total,
        }
      : {}),
    summary,
  };
}

function q1ExclusionSuffix(notes: string[]): string {
  if (!notes.length) return "";
  return ` · ${notes.length} Q1 leg(s) dropped (last-10 hit rate ≥20pp below model)`;
}

function bestQ1LegPerGame(
  picks: PickLeg[],
  minFair: number,
  logsByPlayer?: Map<string, PlayerGameLog[]>
): { leg: PickLeg; score: number }[] {
  const rows: { leg: PickLeg; score: number }[] = [];
  for (const l of picks) {
    if (
      !l.market.startsWith("q1") ||
      !l.starterEligible ||
      (l.projectedMinutes ?? 0) < 24 ||
      l.fairPrice < minFair ||
      !passesQ1MultiHitGap(l)
    ) {
      continue;
    }
    const logs = logsByPlayer?.get(l.playerId) ?? [];
    rows.push({ leg: l, score: q1MultiBlendP(l, logs) });
  }
  const byGame = new Map<string, { leg: PickLeg; score: number }>();
  for (const row of rows) {
    const key = row.leg.gameId;
    const cur = byGame.get(key);
    if (!cur || row.score > cur.score) byGame.set(key, row);
  }
  return [...byGame.values()].sort((a, b) => b.score - a.score);
}

function selectQ1MultiLegs(
  rankedGames: { leg: PickLeg; score: number }[]
): PickLeg[] | null {
  if (rankedGames.length < 3) return null;
  const take = Math.min(6, rankedGames.length);
  return rankedGames.slice(0, take).map((r) => r.leg);
}

function buildQ1Multi(
  picks: PickLeg[],
  q1ExclusionNotes: string[] = [],
  logsByPlayer?: Map<string, PlayerGameLog[]>
): {
  bets: MultiBet[];
  coreNotBuiltReason: string;
} {
  console.log(
    `multis filter [q1Multi]: ${formatQ1MultiFilterCounts(countQ1MultiFilters(picks, MIN_LEG_FAIR))}`
  );
  const exSuffix = q1ExclusionSuffix(q1ExclusionNotes);
  const coreRanked = bestQ1LegPerGame(picks, MIN_LEG_FAIR, logsByPlayer);
  const thinPool = `Only ${coreRanked.length} games with Q1 fair ≥${MIN_LEG_FAIR.toFixed(2)} (24+ min, −20pp, need 3–6)`;
  if (coreRanked.length < 3) {
    return {
      bets: [],
      coreNotBuiltReason: thinPool + exSuffix,
    };
  }

  const bets: MultiBet[] = [];
  let coreNotBuiltReason = `No Q1 Multi (blend p rank, 1/game, 3–6 legs)${exSuffix}`;

  const core = selectQ1MultiLegs(coreRanked);
  if (core) {
    bets.push(
      q1MultiFromLegs(
        core,
        undefined,
        "Q1 Multi: 0.3 model + 0.4 L10 + 0.3 L5 Q1; Take fair×1.08"
      )
    );
    coreNotBuiltReason = "";
    pushMultiBuildTrace({
      type: "q1Multi",
      eligible: coreRanked.length,
      bestEdgePool: core.length,
      clashCandidates: 0,
      rangeCandidates: 1,
      built: true,
      detail: "fair×1.08 take-at (no AU Q1 feed)",
    });
  }

  if (!bets.length) {
    pushMultiBuildTrace({
      type: "q1Multi",
      eligible: coreRanked.length,
      bestEdgePool: 0,
      clashCandidates: 0,
      rangeCandidates: 0,
      built: false,
      detail: thinPool,
    });
  }

  return { bets, coreNotBuiltReason };
}

function gameCrossLabel(game: SlateGame): string {
  return slateMatchupAbbrev(game);
}

function buildCrossGameSgm(
  picks: PickLeg[],
  _minEdgeFraction: number,
  catalog: PickLeg[],
  slateGames: SlateGame[]
): { bet: MultiBet | null; reason: string } {
  const structural = picks.filter(
    (l) => !l.market.startsWith("q1") && passesFormGuard(l)
  );

  const poolLegs: PickLeg[] = [];
  for (const bookie of bookiesByCoverage(structural)) {
    for (const l of structural) {
      if (qualifiesCrossGameSgmLeg(l, bookie, catalog)) poolLegs.push(l);
    }
  }
  const eligibleUnique = [...new Map(poolLegs.map((l) => [l.id, l])).values()];

  const slate =
    slateGames.length > 0
      ? slateGames
      : [...new Set(structural.map((l) => l.gameId))].map(
          (id) =>
            ({
              id,
              awayTeam: id,
              homeTeam: "",
              homeTeamId: "",
              awayTeamId: "",
              startTime: "",
              startTimeSydney: "",
              homeB2B: false,
              awayB2B: false,
              status: "scheduled",
            }) as SlateGame
        );

  let bestAcross: {
    legs: PickLeg[];
    bookie: string;
    p: number;
    total: number;
    groups: CrossGameSgmGroup[];
    gamesIncluded: number;
  } | null = null;
  let maxPool = 0;
  let maxPoolBookie = "";

  for (const bookie of bookiesByCoverage(eligibleUnique)) {
    const byGame = new Map<string, PickLeg[]>();
    for (const l of structural) {
      if (!qualifiesCrossGameSgmLeg(l, bookie, catalog)) continue;
      const priced = asBookieLeg(l, bookie, catalog);
      if (!priced) continue;
      const arr = byGame.get(l.gameId) ?? [];
      arr.push(priced);
      byGame.set(l.gameId, arr);
    }
    const pricedCount = [...byGame.values()].reduce((n, arr) => n + arr.length, 0);
    if (pricedCount > maxPool) {
      maxPool = pricedCount;
      maxPoolBookie = bookie;
    }

    const groups: CrossGameSgmGroup[] = [];
    const assembled: PickLeg[] = [];
    let gamesIncluded = 0;

    let coversAllGames = true;
    for (const game of slate) {
      const gid = game.id;
      const pool = (byGame.get(gid) ?? []).sort(sortLegs);
      const label = gameCrossLabel(game);
      const subset = pickCrossGameLegsForGame(pool.slice(0, 24));
      if (!subset?.length) {
        coversAllGames = false;
        groups.push({
          gameId: gid,
          status: "excluded",
          legs: [],
          excludedReason: crossGameExcludedReason(label, bookie, pool.length),
        });
        continue;
      }
      gamesIncluded += 1;
      groups.push({
        gameId: gid,
        status: "included",
        legs: subset.map((l) => l.id),
      });
      assembled.push(...subset);
    }

    if (!coversAllGames || gamesIncluded < slate.length) continue;
    if (gamesIncluded < CROSS_SGM_MIN_GAMES) continue;
    const total = comboProduct(assembled, bookie);
    const p = combinedProb(assembled);
    const better =
      !bestAcross ||
      gamesIncluded > bestAcross.gamesIncluded ||
      (gamesIncluded === bestAcross.gamesIncluded &&
        (total > bestAcross.total ||
          (Math.abs(total - bestAcross.total) < 1e-9 &&
            betterBookiePick(bestAcross, p, total))));
    if (better) {
      bestAcross = { legs: assembled, bookie, p, total, groups, gamesIncluded };
    }
  }

  if (!bestAcross) {
    const reason = `No cross-game SGM (no bookie covers all ${slate.length} games; pool ${maxPoolBookie}=${maxPool})`;
    pushMultiBuildTrace({
      type: "crossGameSgm",
      eligible: eligibleUnique.length,
      bestEdgePool: maxPool,
      bestBookie: maxPoolBookie,
      clashCandidates: 0,
      rangeCandidates: 0,
      built: false,
      detail: reason,
    });
    return { bet: null, reason };
  }

  const { p, fair, takeAt } = combinedPrice(bestAcross.legs);
  const oneLegGames = bestAcross.groups.filter(
    (g) => g.status === "included" && g.legs.length === 1
  ).length;
  const oneLegNote =
    oneLegGames > 0
      ? ` (${oneLegGames} game${oneLegGames > 1 ? "s" : ""} @ 1 leg — no clash-free pair)`
      : "";

  pushMultiBuildTrace({
    type: "crossGameSgm",
    eligible: eligibleUnique.length,
    bestEdgePool: maxPool,
    bestBookie: bestAcross.bookie,
    clashCandidates: 0,
    rangeCandidates: bestAcross.gamesIncluded,
    built: true,
    detail: `${bestAcross.legs.length} legs @ ${bestAcross.bookie} $${bestAcross.total.toFixed(2)}`,
  });

  return {
    bet: {
      type: "crossGameSgm",
      label: "Cross-Game SGM Multi",
      legs: bestAcross.legs.map((l) => l.id),
      combinedProbability: p,
      combinedFairPrice: fair,
      combinedTakeAt: takeAt,
      ...overlayForBookie(bestAcross.legs, bestAcross.bookie, catalog),
      crossGameGroups: bestAcross.groups,
      summary: `${bestAcross.gamesIncluded} games @ ${bestAcross.bookie}${oneLegNote}`,
    },
    reason: "",
  };
}

function buildBoostSgm(
  picks: PickLeg[],
  minEdgeFraction: number,
  catalog: PickLeg[]
): { bet: MultiBet | null; reason: string } {
  const structural = picks.filter(
    (l) =>
      l.starterEligible === true &&
      !l.market.startsWith("q1") &&
      passesFormGuard(l)
  );

  let bestAcross: {
    legs: PickLeg[];
    bookie: string;
    p: number;
    total: number;
    surplus: number;
  } | null = null;
  let maxEdge = 0;
  let maxEdgeBookie = "";
  let maxRange = 0;

  for (const bookie of bookiesByCoverage(structural)) {
    const edge = structural.filter(
      (l) =>
        legBookiePriceInBand(l, bookie, 1.5, 3.0) &&
        qualifiesCrossBoostLeg(l, bookie) &&
        legMeetsBookieEdge(l, bookie, minEdgeFraction)
    );
    const priced = edge.map((l) => asBookieLeg(l, bookie, catalog)).filter(Boolean) as PickLeg[];
    if (priced.length > maxEdge) {
      maxEdge = priced.length;
      maxEdgeBookie = bookie;
    }
    const byGame = new Map<string, PickLeg[]>();
    for (const l of priced) {
      const arr = byGame.get(l.gameId) ?? [];
      arr.push(l);
      byGame.set(l.gameId, arr);
    }

    let bookieBest: {
      legs: PickLeg[];
      p: number;
      total: number;
      edge: number;
      surplus: number;
    } | null = null;
    let rangeCands = 0;

    for (const legs of byGame.values()) {
      legs.sort(sortLegs);
      const combo = pickBestSameGameSgmCombo(
        legs.slice(0, 18),
        bookie,
        catalog,
        SGM_NO_ODDS_MIN,
        SGM_NO_ODDS_MAX
      );
      if (!combo) continue;
      rangeCands += 1;
      if (
        !bookieBest ||
        combo.surplus > bookieBest.surplus + 1e-12 ||
        (Math.abs(combo.surplus - bookieBest.surplus) < 1e-12 &&
          combo.p > bookieBest.p)
      ) {
        bookieBest = combo;
      }
    }
    maxRange = Math.max(maxRange, rangeCands);
    if (!bookieBest) continue;
    if (
      !bestAcross ||
      bookieBest.surplus > bestAcross.surplus + 1e-12 ||
      (Math.abs(bookieBest.surplus - bestAcross.surplus) < 1e-12 &&
        bookieBest.p > bestAcross.p)
    ) {
      bestAcross = {
        legs: bookieBest.legs,
        bookie,
        p: bookieBest.p,
        total: bookieBest.total,
        surplus: bookieBest.surplus,
      };
    }
  }

  if (!bestAcross) {
    const reason = `No same-game SGM @ ≥$${SGM_NO_ODDS_MIN} + edge curve (eligible ${structural.length}, best pool ${maxEdgeBookie}=${maxEdge}, games ${maxRange})`;
    pushMultiBuildTrace({
      type: "boostSgm",
      eligible: structural.length,
      bestEdgePool: maxEdge,
      bestBookie: maxEdgeBookie,
      clashCandidates: 0,
      rangeCandidates: maxRange,
      built: false,
      detail: reason,
    });
    return { bet: null, reason };
  }

  const { p, fair, takeAt } = combinedPrice(bestAcross.legs);
  pushMultiBuildTrace({
    type: "boostSgm",
    eligible: structural.length,
    bestEdgePool: maxEdge,
    bestBookie: bestAcross.bookie,
    clashCandidates: 0,
    rangeCandidates: maxRange,
    built: true,
    detail: `${bestAcross.legs.length} legs @ ${bestAcross.bookie} $${bestAcross.total.toFixed(2)}`,
  });

  return {
    bet: {
      type: "boostSgm",
      label: "Best SGM",
      legs: bestAcross.legs.map((l) => l.id),
      combinedProbability: p,
      combinedFairPrice: fair,
      combinedTakeAt: takeAt,
      ...overlayForBookie(bestAcross.legs, bestAcross.bookie, catalog),
      summary: "Best 2–5 leg same-game multi · min $2 · edge curve",
    },
    reason: "",
  };
}

function longshotLegScore(l: PickLeg): number {
  if (l.market === "td") return 4;
  if (l.market === "dd") return 3;
  if (l.market === "pts" && l.line >= 30) return 1;
  return 0;
}

function qualifiesLongshotBuildLegAt(
  l: PickLeg,
  bookie: string,
  minEdgeFraction: number
): boolean {
  if (!qualifiesLongshotLeg(l)) return false;
  if (l.market === "3pm") return false;
  if (l.market === "dd" || l.market === "td") {
    return (
      legPriceAtBookie(l, bookie) != null &&
      legMeetsBookieEdge(l, bookie, minEdgeFraction)
    );
  }
  if (l.market === "pts" && l.line >= 30) {
    return (
      l.fairPrice >= 2.5 &&
      l.fairPrice <= 20 &&
      legMeetsBookieEdge(l, bookie, minEdgeFraction)
    );
  }
  return false;
}

function buildLongshot(
  picks: PickLeg[],
  minEdgeFraction: number,
  catalog: PickLeg[]
): { bets: MultiBet[]; reason: string } {
  const candidates: {
    legs: PickLeg[];
    bookie: string;
    total: number;
    score: number;
  }[] = [];
  const bookies = bookiesByCoverage(picks);

  for (const bookie of bookies) {
    const priced = picks
      .filter((l) => qualifiesAngleLongshotAt(l, bookie, minEdgeFraction))
      .map((l) => asBookieLeg(l, bookie, catalog))
      .filter(Boolean) as PickLeg[];

    const byPlayer = new Map<string, PickLeg[]>();
    for (const leg of priced) {
      const arr = byPlayer.get(leg.playerId) ?? [];
      if (!arr.some((x) => x.market === leg.market && x.line === leg.line)) arr.push(leg);
      byPlayer.set(leg.playerId, arr);
    }
    for (const legs of byPlayer.values()) {
      if (legs.length < 2) continue;
      legs.sort((a, b) => longshotAngleScore(b) - longshotAngleScore(a));
      for (let n = 2; n <= Math.min(4, legs.length); n++) {
        const slice = legs.slice(0, n);
        if (multiHasClash(slice)) continue;
        const total = comboProduct(slice, bookie);
        if (total < 30 || total > 150) continue;
        candidates.push({
          legs: slice,
          bookie,
          total,
          score: slice.reduce((s, l) => s + longshotAngleScore(l), 0),
        });
      }
    }

    const byGame = new Map<string, PickLeg[]>();
    for (const leg of priced) {
      if (!qualifiesLongshotBuildLegAt(leg, bookie, minEdgeFraction)) continue;
      const arr = byGame.get(leg.gameId) ?? [];
      arr.push(leg);
      byGame.set(leg.gameId, arr);
    }
    const gameIds = [...byGame.keys()];
    if (gameIds.length >= 2) {
      let best: PickLeg[] | null = null;
      let bestScore = 0;
      let bestTotal = 0;
      let bestBookie = bookie;
      function dfs(gi: number, chosen: PickLeg[]) {
        if (chosen.length >= 2) {
          const combo = comboProduct(chosen, bookie);
          if (combo >= 30 && combo <= 150 && !multiHasClash(chosen)) {
            const score = chosen.reduce((s, l) => s + longshotAngleScore(l), 0);
            if (score > bestScore) {
              bestScore = score;
              bestTotal = combo;
              best = [...chosen];
            }
          }
        }
        if (chosen.length >= gameIds.length) return;
        for (let i = gi; i < gameIds.length; i++) {
          const gid = gameIds[i];
          const legs = (byGame.get(gid) ?? []).sort(
            (a, b) => longshotAngleScore(b) - longshotAngleScore(a)
          );
          for (const leg of legs.slice(0, 6)) {
            dfs(i + 1, [...chosen, leg]);
          }
        }
      }
      dfs(0, []);
      if (best) {
        candidates.push({
          legs: best,
          bookie: bestBookie,
          total: bestTotal,
          score: bestScore,
        });
      }
    }
  }

  candidates.sort((a, b) => b.score - a.score || b.total - a.total);
  const unique: typeof candidates = [];
  const seen = new Set<string>();
  for (const c of candidates) {
    const key = c.legs.map((l) => l.id).sort().join("|");
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(c);
  }

  if (!unique.length) {
    const reason =
      "No angle longshot @ one bookie ($30–150, 2–4 legs, edge or narrative)";
    pushMultiBuildTrace({
      type: "longshot",
      eligible: picks.length,
      bestEdgePool: 0,
      clashCandidates: 0,
      rangeCandidates: 0,
      built: false,
      detail: reason,
    });
    return { bets: [], reason };
  }

  const c = unique[0];
  const { p, fair, takeAt } = combinedPrice(c.legs);
  const bets: MultiBet[] = [
    {
      type: "longshot",
      label: "Longshot",
      legs: c.legs.map((l) => l.id),
      combinedProbability: p,
      combinedFairPrice: fair,
      combinedTakeAt: takeAt,
      ...overlayForBookie(c.legs, c.bookie, catalog),
      summary: `${c.legs.length} legs angle-ranked @ ${c.bookie}`,
    },
  ];

  pushMultiBuildTrace({
    type: "longshot",
    eligible: picks.length,
    bestEdgePool: unique.length,
    clashCandidates: 0,
    rangeCandidates: candidates.length,
    built: true,
    detail: `${bets.length} longshot card(s)`,
  });

  return { bets, reason: "" };
}