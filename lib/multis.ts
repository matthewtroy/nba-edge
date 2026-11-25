import type { PickLeg, MultiBet, MultiType, MultiNotBuilt, PlayerGameLog } from "./types.js";
import { q1MultiBlendP, passesQ1MultiHitGap } from "./q1-multi-probability.js";
import { nearestPricedRung } from "./nearest-bookie-line.js";
import {
  pickBestSameGameSgmCombo,
  pickBestCrossGameLegSubset,
  SGM_BAND_MIN,
  SGM_BAND_MAX,
  legEdgeDecimal,
  SGM_MIN_LEG_PRICE,
} from "./same-game-sgm-search.js";
import { legsClash, multiHasClash } from "./clash.js";
import { isMainPlayStatLine } from "./starter-eligibility.js";
import {
  qualifiesCrossBoostLeg,
  qualifiesLongshotLeg,
  qualifiesMainPlayLeg,
  mainPlayStructuralOk,
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
import { isInjuryRedistributionReason } from "./injury-reason.js";
import { logMultiBuildSummary } from "./multi-filter-log.js";
import {
  combinedFairAndTakeAt,
  DEFAULT_MIN_EDGE,
} from "./multi-combined.js";

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
  return leg.reasons.some((r) => isInjuryRedistributionReason(r)) ? 1 : 0;
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
  logsByPlayer?: Map<string, PlayerGameLog[]>
): MultiBuildResult {
  multiMinEdge = minEdgeFraction;
  resetMultiBuildTraces();
  const pool = picks.filter(meetsFloor);
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

  if (main.bet) {
    const booster = buildBooster(main.bet, pool, catalog);
    if (booster.bet) multis.push(booster.bet);
    else notBuilt.push({ type: "booster", label: LABELS.booster, reason: booster.reason });
  } else {
    notBuilt.push({ type: "booster", label: LABELS.booster, reason: "Needs a Main Play first" });
  }

  const q1Attempt = buildQ1Multi(byP, q1ExclusionNotes, logsByPlayer);
  multis.push(...q1Attempt.bets);

  const cross = buildCrossGameSgm(byP, minEdgeFraction, catalog);
  if (cross.bet) multis.push(cross.bet);
  else notBuilt.push({ type: "crossGameSgm", label: LABELS.crossGameSgm, reason: cross.reason });

  const boostSgm = buildBoostSgm(byP, minEdgeFraction, catalog);
  if (boostSgm.bet) multis.push(boostSgm.bet);
  else notBuilt.push({ type: "boostSgm", label: LABELS.boostSgm, reason: boostSgm.reason });

  const longshot = buildLongshot(byP, minEdgeFraction, catalog);
  if (longshot.bet) multis.push(longshot.bet);
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
    if (multiHasClash(legs)) {
      clashDropped.push({
        multi: m,
        reason: `Clash rule: ${multiClashSummary(legs)}`,
      });
      continue;
    }
    filtered.push(m);
  }

  const { kept, dropped: exposureDropped } = enforceExposureCapWithDrops(
    filtered,
    picksById
  );
  filtered = kept;

  const pushDrop = (multi: MultiBet, reason: string, players?: string[]) => {
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
    const legSummary = legs.map((l) => `${l.playerName} ${l.line}+ ${l.market}`).join(", ");
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
  const ensureQ1Variant = (variant: "Core" | "Longshot", reason: string) => {
    if (!reason) return;
    if (finalBets.some((m) => m.type === "q1Multi" && m.variant === variant)) return;
    if (notBuilt.some((n) => n.type === "q1Multi" && n.variant === variant)) return;
    notBuilt.push({
      type: "q1Multi",
      label: LABELS.q1Multi,
      variant,
      reason,
    });
  };
  ensureQ1Variant("Core", q1Attempt.coreNotBuiltReason);
  ensureQ1Variant("Longshot", q1Attempt.longshotNotBuiltReason);

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
    .filter(Boolean) as PickLeg[];
  const corePool = priced.filter((l) => isCoreMarket(l.market)).sort(sortLegs);
  const threesPool = priced.filter((l) => l.market === "3pm").sort(sortLegs);
  if (corePool.length >= 3) return corePool;
  return [...corePool, ...threesPool].sort((a, b) => {
    const ac = isCoreMarket(a.market) ? 1 : 0;
    const bc = isCoreMarket(b.market) ? 1 : 0;
    if (bc !== ac) return bc - ac;
    return sortLegs(a, b);
  });
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

  let best: { legs: PickLeg[]; bookie: string; p: number; total: number } | null = null;
  let maxEdgePool = 0;
  let maxEdgeBookie = "";
  let maxRange = 0;
  let maxClash = 0;

  for (const bookie of bookiesByCoverage(eligible)) {
    const banded = eligible.filter((l) =>
      legBookiePriceInBand(l, bookie, 1.4, 2.5)
    );
    const pool = mainPlayPoolAtBookie(banded, bookie, minEdgeFraction, catalog);
    if (pool.length > maxEdgePool) {
      maxEdgePool = pool.length;
      maxEdgeBookie = bookie;
    }
    if (pool.length < 3) continue;
    const found = findMainPlaySubset(pool, slateSize, bookie);
    maxRange = Math.max(maxRange, found.rangeCandidates);
    maxClash = Math.max(maxClash, found.clashCandidates);
    if (!found.legs) continue;
    const total = comboProduct(found.legs, bookie);
    const p = combinedProb(found.legs);
    if (!betterBookiePick(best, p, total)) continue;
    best = { legs: found.legs, bookie, p, total };
  }

  if (!best) {
    const reason =
      maxEdgePool < 3
        ? `No bookie with 3+ main legs at edge (best ${maxEdgeBookie}=${maxEdgePool})`
        : `No 3–5 leg main @ edge+clash+bookie total $7–$20 (edge best ${maxEdgeBookie}=${maxEdgePool}, range-cands ${maxRange})`;
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
    detail: `${best.legs.length} legs @ ${best.bookie} $${best.total.toFixed(2)}`,
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

  const structural = picks.filter(
    (l) => mainPlayStructuralOk(l) && passesFormGuard(l)
  );
  const out = attempt(structural);
  return { ...out, confluenceRelaxed: false };
}

function findMainPlaySubset(
  pool: PickLeg[],
  slateSize: number,
  bookie?: string
): { legs: PickLeg[] | null; rangeCandidates: number; clashCandidates: number } {
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
        combo >= 7 &&
        combo <= 20 &&
        threesCount(chosen) <= 1 &&
        !multiHasClash(chosen) &&
        !hasQuestionableAnchor(chosen)
      ) {
        candidates.push([...chosen]);
      } else if (
        combo >= 7 &&
        combo <= 20 &&
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
  candidates.sort((a, b) => {
    const score = (legs: PickLeg[]) =>
      legs.reduce((s, leg) => {
        let v = injuryBoostScore(leg) * 1000;
        v += last10HitsAtLine(leg) * 10;
        v += leg.probability;
        if (injuryBoostScore(leg) === 0 && last5HitsAtLine(leg) <= 2) v -= 0.5;
        return s + v;
      }, 0);
    const sa = score(a);
    const sb = score(b);
    if (sb !== sa) return sb - sa;
    const pa = combinedProb(a);
    const pb = combinedProb(b);
    if (Math.abs(pb - pa) > 1e-9) return pb - pa;
    return comboProduct(b, bookie) - comboProduct(a, bookie);
  });
  return {
    legs: candidates[0],
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
    ...(feed
      ? {
          bestBookie: feed.bookie,
          bestBookieTotal: feed.total,
          bookieTotals: multiBookieTotals(legs) as Record<string, number>,
        }
      : {}),
    summary,
  };
}

function q1ExclusionSuffix(notes: string[]): string {
  if (!notes.length) return "";
  return ` · ${notes.length} Q1 leg(s) dropped (last-10 hit rate ≥20pp below model)`;
}

function bestQ1LegPerTeam(
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
  const byTeam = new Map<string, { leg: PickLeg; score: number }>();
  for (const row of rows) {
    const key = `${row.leg.gameId}|${row.leg.team}`;
    const cur = byTeam.get(key);
    if (!cur || row.score > cur.score) byTeam.set(key, row);
  }
  return [...byTeam.values()].sort((a, b) => b.score - a.score);
}

function selectQ1MultiLegs(
  rankedTeams: { leg: PickLeg; score: number }[]
): PickLeg[] | null {
  if (rankedTeams.length < 3) return null;
  const take = Math.min(6, rankedTeams.length);
  const chosen = rankedTeams.slice(0, take).map((r) => r.leg);
  if (multiHasClash(chosen)) return null;
  return chosen;
}

function buildQ1Multi(
  picks: PickLeg[],
  q1ExclusionNotes: string[] = [],
  logsByPlayer?: Map<string, PlayerGameLog[]>
): {
  bets: MultiBet[];
  coreNotBuiltReason: string;
  longshotNotBuiltReason: string;
} {
  const exSuffix = q1ExclusionSuffix(q1ExclusionNotes);
  const coreRanked = bestQ1LegPerTeam(picks, MIN_LEG_FAIR, logsByPlayer);
  const thinPool = `Only ${coreRanked.length} teams with Q1 fair ≥${MIN_LEG_FAIR.toFixed(2)} (24+ min, −20pp, need 3–6)`;
  if (coreRanked.length < 3) {
    return {
      bets: [],
      coreNotBuiltReason: thinPool + exSuffix,
      longshotNotBuiltReason: thinPool + exSuffix,
    };
  }

  const bets: MultiBet[] = [];
  let coreNotBuiltReason = `No Q1 Multi (blend p rank, 1/team, 3–6 legs)${exSuffix}`;
  let longshotNotBuiltReason = `No Q1 Multi (Longshot) fair ≥2.50${exSuffix}`;

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
      variant: "Core",
      eligible: coreRanked.length,
      bestEdgePool: core.length,
      clashCandidates: 0,
      rangeCandidates: 1,
      built: true,
      detail: "fair×1.08 take-at (no AU Q1 feed)",
    });
  }

  const longRanked = bestQ1LegPerTeam(picks, 2.5, logsByPlayer);
  const longshot = selectQ1MultiLegs(longRanked);
  if (
    longshot &&
    (!core || longshot.map((l) => l.id).join() !== core.map((l) => l.id).join())
  ) {
    bets.push(
      q1MultiFromLegs(
        longshot,
        "Longshot",
        "Q1 Multi (Longshot): fair ≥2.50, blend-ranked, Take fair×1.08"
      )
    );
    longshotNotBuiltReason = "";
    pushMultiBuildTrace({
      type: "q1Multi",
      variant: "Longshot",
      eligible: longRanked.length,
      bestEdgePool: longshot.length,
      clashCandidates: 0,
      rangeCandidates: 1,
      built: true,
      detail: "fair×1.08 take-at (no AU Q1 feed)",
    });
  } else if (
    longshot &&
    core &&
    longshot.map((l) => l.id).join() === core.map((l) => l.id).join()
  ) {
    longshotNotBuiltReason = `Q1 Multi (Longshot) same legs as Q1 Multi (skipped duplicate)${exSuffix}`;
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

  return { bets, coreNotBuiltReason, longshotNotBuiltReason };
}

function buildCrossGameSgm(
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
  const eligible: PickLeg[] = [];
  for (const bookie of bookiesByCoverage(structural)) {
    for (const l of structural) {
      if (qualifiesCrossBoostLeg(l, bookie)) eligible.push(l);
    }
  }
  const eligibleUnique = [...new Map(eligible.map((l) => [l.id, l])).values()];
  if (eligibleUnique.length < 4) {
    const reason = `Need 2+ games with starter main lines 1.35–2.50 @ bookie (${eligibleUnique.length} legs)`;
    pushMultiBuildTrace({
      type: "crossGameSgm",
      eligible: eligibleUnique.length,
      bestEdgePool: 0,
      clashCandidates: 0,
      rangeCandidates: 0,
      built: false,
      detail: reason,
    });
    return { bet: null, reason };
  }

  let bestAcross: {
    legs: PickLeg[];
    bookie: string;
    p: number;
    total: number;
  } | null = null;
  let maxEdge = 0;
  let maxEdgeBookie = "";
  let maxRange = 0;

  for (const bookie of bookiesByCoverage(eligibleUnique)) {
    const edge = eligibleUnique.filter(
      (l) =>
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
    const gameIds = [...new Set(structural.map((l) => l.gameId))].sort();
    const assembled: PickLeg[] = [];
    let gamesWithLegs = 0;
    for (const gid of gameIds) {
      const legs = (byGame.get(gid) ?? [])
        .filter((l) => (l.bestPrice ?? 0) >= SGM_MIN_LEG_PRICE)
        .sort(sortLegs);
      const subset = pickBestCrossGameLegSubset(legs.slice(0, 14));
      if (!subset) continue;
      gamesWithLegs += 1;
      assembled.push(...subset);
    }
    if (gamesWithLegs < 2 || assembled.length < 4) continue;
    maxRange += 1;
    const total = comboProduct(assembled, bookie);
    const p = combinedProb(assembled);
    const edgeSum = assembled.reduce((s, l) => s + legEdgeDecimal(l), 0);
    const prevEdge = bestAcross
      ? bestAcross.legs.reduce((s, l) => s + legEdgeDecimal(l), 0)
      : 0;
    if (
      !bestAcross ||
      p > bestAcross.p ||
      (Math.abs(p - bestAcross.p) < 1e-9 && edgeSum > prevEdge) ||
      (Math.abs(p - bestAcross.p) < 1e-9 &&
        Math.abs(edgeSum - prevEdge) < 1e-9 &&
        betterBookiePick(bestAcross, p, total))
    ) {
      bestAcross = { legs: assembled, bookie, p, total };
    }
  }

  if (!bestAcross) {
    const reason = `No cross-game combo @ edge (eligible ${eligibleUnique.length}, best edge-pool ${maxEdgeBookie}=${maxEdge}, range-cands ${maxRange})`;
    pushMultiBuildTrace({
      type: "crossGameSgm",
      eligible: eligibleUnique.length,
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
    type: "crossGameSgm",
    eligible: eligibleUnique.length,
    bestEdgePool: maxEdge,
    bestBookie: bestAcross.bookie,
    clashCandidates: 0,
    rangeCandidates: maxRange,
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
      summary: "2+ games, 2–3 legs/game, one bookie (toggle games on card)",
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
    } | null = null;
    let rangeCands = 0;

    for (const legs of byGame.values()) {
      legs.sort(sortLegs);
      const combo = pickBestSameGameSgmCombo(
        legs.slice(0, 18),
        bookie,
        catalog,
        SGM_BAND_MIN,
        SGM_BAND_MAX
      );
      if (!combo) continue;
      rangeCands += 1;
      if (
        !bookieBest ||
        combo.p > bookieBest.p ||
        (Math.abs(combo.p - bookieBest.p) < 1e-9 && combo.edge > bookieBest.edge)
      ) {
        bookieBest = combo;
      }
    }
    maxRange = Math.max(maxRange, rangeCands);
    if (!bookieBest) continue;
    const prevEdge = bestAcross
      ? bestAcross.legs.reduce((s, l) => s + legEdgeDecimal(l), 0)
      : 0;
    if (
      !bestAcross ||
      bookieBest.p > bestAcross.p ||
      (Math.abs(bookieBest.p - bestAcross.p) < 1e-9 &&
        bookieBest.edge > prevEdge) ||
      (Math.abs(bookieBest.p - bestAcross.p) < 1e-9 &&
        Math.abs(bookieBest.edge - prevEdge) < 1e-9 &&
        betterBookiePick(bestAcross, bookieBest.p, bookieBest.total))
    ) {
      bestAcross = {
        legs: bookieBest.legs,
        bookie,
        p: bookieBest.p,
        total: bookieBest.total,
      };
    }
  }

  if (!bestAcross) {
    const reason = `No in-band same-game SGM @ edge (eligible ${structural.length}, best pool ${maxEdgeBookie}=${maxEdge}, in-band games ${maxRange})`;
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
      summary: "Best 3–4 leg same-game multi in $7–15",
    },
    reason: "",
  };
}

function longshotLegScore(l: PickLeg): number {
  if (l.market === "td") return 4;
  if (l.market === "dd") return 3;
  if (l.market === "combo") return 2;
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
  if (l.market === "dd" || l.market === "td" || l.market === "combo") {
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
): { bet: MultiBet | null; reason: string } {
  let bestAcross: {
    legs: PickLeg[];
    bookie: string;
    p: number;
    total: number;
  } | null = null;
  let maxEdge = 0;
  let maxEdgeBookie = "";
  let maxRange = 0;
  const eligibleCount = picks.filter((l) =>
    bookiesByCoverage(picks).some((b) =>
      qualifiesLongshotBuildLegAt(l, b, minEdgeFraction)
    )
  ).length;

  const bookies = bookiesByCoverage(picks);
  for (const bookie of bookies) {
    const byGame = new Map<string, PickLeg[]>();
    for (const l of picks) {
      if (!qualifiesLongshotBuildLegAt(l, bookie, minEdgeFraction)) continue;
      const priced = asBookieLeg(l, bookie, catalog);
      if (!priced) continue;
      const arr = byGame.get(l.gameId) ?? [];
      arr.push(priced);
      byGame.set(l.gameId, arr);
    }
    const poolSize = [...byGame.values()].reduce((n, a) => n + a.length, 0);
    if (poolSize > maxEdge) {
      maxEdge = poolSize;
      maxEdgeBookie = bookie;
    }
    const gameIds = [...byGame.keys()];
    if (gameIds.length < 2) continue;

    let best: PickLeg[] | null = null;
    let bestCombo = 0;
    let rangeCands = 0;

    function dfs(gi: number, chosen: PickLeg[]) {
      if (chosen.length >= 2) {
        const combo = comboProduct(chosen, bookie);
        if (combo >= 30 && combo <= 100 && !multiHasClash(chosen)) {
          rangeCands += 1;
          if (combo > bestCombo) {
            bestCombo = combo;
            best = [...chosen];
          }
        }
      }
      if (chosen.length >= gameIds.length) return;
      for (let i = gi; i < gameIds.length; i++) {
        const gid = gameIds[i];
        const legs = (byGame.get(gid) ?? []).sort(
          (a, b) =>
            longshotLegScore(b) - longshotLegScore(a) ||
            injuryBoostScore(b) - injuryBoostScore(a) ||
            b.fairPrice - a.fairPrice
        );
        for (const leg of legs.slice(0, 8)) {
          const next = [...chosen, leg];
          if (multiHasClash(next)) continue;
          dfs(i + 1, next);
        }
      }
    }
    dfs(0, []);
    maxRange = Math.max(maxRange, rangeCands);
    if (!best || best.length < 2) continue;
    const chosenLegs = best;
    if (
      !chosenLegs.some((l) => ["dd", "td", "combo"].includes(l.market)) &&
      !chosenLegs.every((l) => l.market === "pts" && l.line >= 30)
    ) {
      continue;
    }
    const total = comboProduct(chosenLegs, bookie);
    const p = combinedProb(chosenLegs);
    if (betterBookiePick(bestAcross, p, total)) {
      bestAcross = { legs: chosenLegs, bookie, p, total };
    }
  }

  if (!bestAcross) {
    const reason =
      "No 2-game longshot @ edge (DD/TD/combo or 30+ pts priced at one AU bookie)";
    pushMultiBuildTrace({
      type: "longshot",
      eligible: eligibleCount,
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
    type: "longshot",
    eligible: eligibleCount,
    bestEdgePool: maxEdge,
    bestBookie: bestAcross.bookie,
    clashCandidates: 0,
    rangeCandidates: maxRange,
    built: true,
    detail: `${bestAcross.legs.length} legs @ ${bestAcross.bookie} $${bestAcross.total.toFixed(2)}`,
  });

  return {
    bet: {
      type: "longshot",
      label: "Longshot",
      legs: bestAcross.legs.map((l) => l.id),
      combinedProbability: p,
      combinedFairPrice: fair,
      combinedTakeAt: takeAt,
      ...overlayForBookie(bestAcross.legs, bestAcross.bookie, catalog),
      summary: "One long leg per game",
    },
    reason: "",
  };
}