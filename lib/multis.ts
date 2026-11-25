import type { PickLeg, MultiBet, MultiType, MultiNotBuilt } from "./types.js";
import { legsClash, multiHasClash } from "./clash.js";
import { isMainPlayStatLine } from "./starter-eligibility.js";
import {
  qualifiesCrossBoostLeg,
  qualifiesLongshotLeg,
  qualifiesMainPlayLeg,
} from "./main-play-eligibility.js";
import { enforceExposureCapWithDrops } from "./exposure.js";
import { bestFeedMultiQuote } from "./card-bookie.js";
import { multiBookieTotals } from "./bookie-totals.js";
import { multiClashSummary } from "./clash.js";
import { gateAllMultis } from "./multi-gate.js";
import {
  combinedFairAndTakeAt,
  DEFAULT_MIN_EDGE,
} from "./multi-combined.js";

export interface MultiBuildResult {
  bets: MultiBet[];
  notBuilt: MultiNotBuilt[];
  gateViolations: string[];
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

export function combinedBetPrice(legs: PickLeg[]): number {
  if (legs.length > 0 && legs.every((l) => legMeetsTakeAt(l))) {
    return Math.round(legs.reduce((acc, l) => acc * (l.bestPrice ?? 1), 1) * 100) / 100;
  }
  return Math.round(legs.reduce((acc, l) => acc * l.takeAt, 1) * 100) / 100;
}

const NO_AU_MULTI = "No single AU bookie prices every leg";

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
  return leg.reasons.some((r) => / out/i.test(r)) ? 1 : 0;
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
  if (b.probability !== a.probability) return b.probability - a.probability;
  return legEdge(b) - legEdge(a);
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
  boostSgm: "Boost SGM",
  longshot: "Longshot",
};

export function buildMultis(
  picks: PickLeg[],
  slateSize: number,
  targetProfit = 300,
  minEdgeFraction = DEFAULT_MIN_EDGE
): MultiBuildResult {
  multiMinEdge = minEdgeFraction;
  const pool = picks.filter(meetsFloor);
  const byP = [...pool].sort(sortLegs);
  const notBuilt: MultiNotBuilt[] = [];
  const multis: MultiBet[] = [];

  const main = buildMainPlay(byP, targetProfit, slateSize);
  if (main.bet) multis.push(main.bet);
  else notBuilt.push({ type: "mainPlay", label: LABELS.mainPlay, reason: main.reason });

  if (main.bet) {
    const booster = buildBooster(main.bet, pool);
    if (booster.bet) multis.push(booster.bet);
    else notBuilt.push({ type: "booster", label: LABELS.booster, reason: booster.reason });
  } else {
    notBuilt.push({ type: "booster", label: LABELS.booster, reason: "Needs a Main Play first" });
  }

  const q1Attempt = buildQ1Multi(byP);
  multis.push(...q1Attempt.bets);

  const cross = buildCrossGameSgm(byP);
  if (cross.bet) multis.push(cross.bet);
  else notBuilt.push({ type: "crossGameSgm", label: LABELS.crossGameSgm, reason: cross.reason });

  const boostSgm = buildBoostSgm(byP);
  if (boostSgm.bet) multis.push(boostSgm.bet);
  else notBuilt.push({ type: "boostSgm", label: LABELS.boostSgm, reason: boostSgm.reason });

  const longshot = buildLongshot(byP);
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

  const keptKeys = new Set(
    filtered.map((m) => `${m.type}|${m.variant ?? ""}`)
  );

  const pushDrop = (multi: MultiBet, reason: string) => {
    const key = `${multi.type}|${multi.variant ?? ""}`;
    if (keptKeys.has(key)) return;
    if (notBuilt.some((n) => n.type === multi.type && n.variant === multi.variant)) return;
    notBuilt.push({
      type: multi.type,
      label: LABELS[multi.type],
      variant: multi.variant,
      reason,
    });
  };

  for (const d of clashDropped) pushDrop(d.multi, d.reason);
  for (const d of exposureDropped) pushDrop(d.multi, d.reason);

  const gated = gateAllMultis(filtered, picksById);
  for (const m of gated.dropped) {
    const legs = m.legs.map((id) => picksById.get(id)).filter(Boolean) as PickLeg[];
    const legSummary = legs.map((l) => `${l.playerName} ${l.line}+ ${l.market}`).join(", ");
    const key = `${m.type}|${m.variant ?? ""}|${m.legs.join(",")}`;
    const detail =
      (gated.droppedReasons.get(key) ?? []).slice(0, 3).join("; ") || "rule gate";
    pushDrop(m, `Gate: ${detail} (legs: ${legSummary})`);
  }

  const finalBets = gated.multis;
  const ensureQ1Variant = (variant: "Safe" | "Value", reason: string) => {
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
  ensureQ1Variant("Safe", q1Attempt.safeNotBuiltReason);
  ensureQ1Variant("Value", q1Attempt.valueNotBuiltReason);

  return {
    bets: finalBets,
    notBuilt,
    gateViolations: gated.violations,
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

function buildMainPlay(
  picks: PickLeg[],
  targetProfit: number,
  slateSize: number
): { bet: MultiBet | null; reason: string } {
  const eligible = picks.filter(qualifiesMainPlayLeg);
  const corePool = eligible.filter((l) => isCoreMarket(l.market)).sort(sortLegs);
  const threesPool = eligible.filter((l) => l.market === "3pm").sort(sortLegs);
  let pool = corePool;
  if (pool.length < 4) {
    pool = [...corePool, ...threesPool].sort((a, b) => {
      const ac = isCoreMarket(a.market) ? 1 : 0;
      const bc = isCoreMarket(b.market) ? 1 : 0;
      if (bc !== ac) return bc - ac;
      return sortLegs(a, b);
    });
  }
  if (pool.length < 4) {
    return {
      bet: null,
      reason: `Only ${pool.length} legs meet fair 1.40–2.50, p≥0.60 (need 4–5)`,
    };
  }

  const best = findMainPlaySubset(pool, slateSize);
  if (!best) {
    return { bet: null, reason: "No 4–5 leg combo: combined 7–10, no clashes" };
  }
  if (hasQuestionableAnchor(best)) {
    return { bet: null, reason: "Questionable player would anchor Main Play" };
  }

  const combo = combinedBetPrice(best);
  if (combo < 7 || combo > 10) {
    return { bet: null, reason: `Combined ${combo.toFixed(2)} outside 7–10` };
  }

  const { p, fair, takeAt } = combinedPrice(best);
  const book = singleBookieOverlay(best);
  if (!book) return { bet: null, reason: NO_AU_MULTI };

  return {
    bet: {
      type: "mainPlay",
      label: "Main Play",
      legs: best.map((l) => l.id),
      combinedProbability: p,
      combinedFairPrice: fair,
      combinedTakeAt: takeAt,
      ...book,
      summary: `${best.length} starter main lines`,
    },
    reason: "",
  };
}

function findMainPlaySubset(pool: PickLeg[], slateSize: number): PickLeg[] | null {
  const byGame = new Map<string, PickLeg[]>();
  for (const leg of pool) {
    const arr = byGame.get(leg.gameId) ?? [];
    arr.push(leg);
    byGame.set(leg.gameId, arr);
  }
  const gameIds = [...byGame.keys()];
  const candidates: PickLeg[][] = [];

  function dfs(depth: number, chosen: PickLeg[]) {
    if (depth >= 4 && depth <= 5) {
      const combo = combinedBetPrice(chosen);
      if (
        combo >= 7 &&
        combo <= 10 &&
        threesCount(chosen) <= 1 &&
        !multiHasClash(chosen) &&
        !hasQuestionableAnchor(chosen)
      ) {
        candidates.push([...chosen]);
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

  if (!candidates.length) return null;
  candidates.sort((a, b) => combinedBetPrice(b) - combinedBetPrice(a));
  return candidates[0];
}

function treblePrice(three: PickLeg[]): number {
  return combinedBetPrice(three);
}

function boostMainLegs(
  main: MultiBet,
  picks: PickLeg[],
  stepLegIds: Set<string>
): PickLeg[] | null {
  const picksById = new Map(picks.map((p) => [p.id, p]));
  const boosted: PickLeg[] = [];

  for (const id of main.legs) {
    const leg = picksById.get(id);
    if (!leg || !meetsFloor(leg) || hasCheckNews(leg)) return null;
    if (stepLegIds.has(id)) {
      const up = nextRung(leg, picks);
      if (
        up &&
        up.fairPrice <= 4 &&
        meetsFloor(up) &&
        !hasCheckNews(up)
      ) {
        boosted.push(up);
      } else {
        boosted.push(leg);
      }
    } else {
      boosted.push(leg);
    }
  }
  if (multiHasClash(boosted)) return null;
  return boosted;
}

function buildBooster(
  main: MultiBet,
  picks: PickLeg[]
): { bet: MultiBet | null; reason: string } {
  const picksById = new Map(picks.map((p) => [p.id, p]));
  const mainLegs = main.legs
    .map((id) => picksById.get(id))
    .filter(Boolean) as PickLeg[];
  if (mainLegs.length !== main.legs.length) {
    return { bet: null, reason: "Booster leg missing" };
  }

  const boosted = boostMainLegs(main, picks, new Set(main.legs));
  if (!boosted?.length) {
    return { bet: null, reason: "Booster: could not resolve Main legs (rung/clash)" };
  }

  const { p, fair, takeAt } = combinedPrice(boosted);
  const book = singleBookieOverlay(boosted);
  if (!book) return { bet: null, reason: NO_AU_MULTI };
  const triCandidates: PickLeg[][] = [];
  for (let i = 0; i < boosted.length - 2; i++) {
    for (let j = i + 1; j < boosted.length - 1; j++) {
      for (let k = j + 1; k < boosted.length; k++) {
        triCandidates.push([boosted[i], boosted[j], boosted[k]]);
      }
    }
  }
  const bestTreble = triCandidates.reduce((mx, t) => Math.max(mx, treblePrice(t)), 0);
  const trixieNote = bestTreble >= 60 ? " · Trixie if treble ≥60" : "";

  return {
    bet: {
      type: "booster",
      label: "Booster",
      legs: boosted.map((l) => l.id),
      combinedProbability: p,
      combinedFairPrice: fair,
      combinedTakeAt: takeAt,
      ...book,
      summary: `Main Play +1 rung where fair ≤4, else same rung${trixieNote}`,
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
): MultiBet | null {
  const { p, fair, takeAt } = combinedPrice(legs);
  const book = singleBookieOverlay(legs);
  if (!book) return null;
  return {
    type: "q1Multi",
    label: "Q1 Multi",
    variant,
    legs: legs.map((l) => l.id),
    combinedProbability: p,
    combinedFairPrice: fair,
    combinedTakeAt: takeAt,
    ...book,
    summary,
  };
}

function buildQ1Multi(picks: PickLeg[]): {
  bets: MultiBet[];
  safeNotBuiltReason: string;
  valueNotBuiltReason: string;
} {
  const q1 = picks.filter(
    (l) =>
      l.market.startsWith("q1") &&
      l.starterEligible &&
      l.fairPrice >= 1.8 &&
      l.fairPrice <= 4
  );
  const byTeam = new Map<string, PickLeg[]>();
  for (const l of q1) {
    const key = `${l.gameId}|${l.team}`;
    const arr = byTeam.get(key) ?? [];
    arr.push(l);
    byTeam.set(key, arr);
  }
  for (const arr of byTeam.values()) arr.sort(sortLegs);
  const teamKeys = [...byTeam.keys()].sort();
  const thinPool = `Only ${teamKeys.length} teams with Q1 fair 1.80–4.00 (need 3–6)`;
  if (teamKeys.length < 3) {
    return {
      bets: [],
      safeNotBuiltReason: thinPool,
      valueNotBuiltReason: thinPool,
    };
  }

  const bets: MultiBet[] = [];
  let safeNotBuiltReason =
    "No Safe Q1 subset (p≥0.70, 3–6 teams, one leg/team)";
  let valueNotBuiltReason =
    "No Value Q1 subset (fair 2.20–4.00, 3–6 teams, one leg/team)";

  const safe = findQ1Subset(teamKeys, byTeam, 0, 0, {
    minProbability: 0.7,
    safeOnly: true,
  });
  if (safe) {
    const safeBet = q1MultiFromLegs(safe, "Safe", "Safe Q1: p≥0.70, one leg/team");
    if (safeBet) {
      bets.push(safeBet);
      safeNotBuiltReason = "";
    } else {
      safeNotBuiltReason = NO_AU_MULTI;
    }
  }
  const value = findQ1Subset(teamKeys, byTeam, 2.2, 4);
  if (value && (!safe || value.map((l) => l.id).join() !== safe.map((l) => l.id).join())) {
    const valueBet = q1MultiFromLegs(
      value,
      "Value",
      "Value Q1: fair 2.20–4.00, one leg/team"
    );
    if (valueBet) {
      bets.push(valueBet);
      valueNotBuiltReason = "";
    } else {
      valueNotBuiltReason = NO_AU_MULTI;
    }
  } else if (value && safe && value.map((l) => l.id).join() === safe.map((l) => l.id).join()) {
    valueNotBuiltReason = "Value Q1 same legs as Safe (skipped duplicate)";
  }

  return { bets, safeNotBuiltReason, valueNotBuiltReason };
}

function buildCrossGameSgm(picks: PickLeg[]): { bet: MultiBet | null; reason: string } {
  const pool = picks.filter(
    (l) => qualifiesCrossBoostLeg(l) && l.fairPrice >= 1.35 && l.fairPrice <= 2.5
  );
  const byGame = new Map<string, PickLeg[]>();
  for (const l of pool) {
    const arr = byGame.get(l.gameId) ?? [];
    arr.push(l);
    byGame.set(l.gameId, arr);
  }
  if (byGame.size < 2) {
    return {
      bet: null,
      reason: "Need 2+ games with starter main lines fair 1.35–2.50",
    };
  }
  const gameIds = [...byGame.keys()];
  let best: PickLeg[] | null = null;
  let bestCombo = 0;

  function dfs(gi: number, chosen: PickLeg[], perGame: Map<string, number>) {
    if (chosen.length >= 4) {
      const combo = combinedBetPrice(chosen);
      if (combo >= 10 && combo <= 30 && !multiHasClash(chosen)) {
        if (combo > bestCombo) {
          bestCombo = combo;
          best = [...chosen];
        }
      }
    }
    if (chosen.length >= 6) return;
    for (let i = gi; i < gameIds.length; i++) {
      const gid = gameIds[i];
      const count = perGame.get(gid) ?? 0;
      if (count >= 2) continue;
      const legs = (byGame.get(gid) ?? []).sort(sortLegs);
      for (const leg of legs.slice(0, 10)) {
        const next = [...chosen, leg];
        if (multiHasClash(next)) continue;
        perGame.set(gid, count + 1);
        dfs(i, next, perGame);
        perGame.set(gid, count);
      }
    }
  }
  dfs(0, [], new Map());

  if (!best || best.length < 4) {
    return {
      bet: null,
      reason: `No cross-game combo: 4+ legs, 2/game, combined 10–30 (${pool.length} starter lines)`,
    };
  }
  const chosen = best;
  const combo = combinedBetPrice(chosen);
  const { p, fair, takeAt } = combinedPrice(chosen);
  const book = singleBookieOverlay(chosen);
  if (!book) return { bet: null, reason: NO_AU_MULTI };
  return {
    bet: {
      type: "crossGameSgm",
      label: "Cross-Game SGM Multi",
      legs: chosen.map((l) => l.id),
      combinedProbability: p,
      combinedFairPrice: fair,
      combinedTakeAt: takeAt,
      ...book,
      summary: "2+ legs/game, fair 1.35–2.50 each",
    },
    reason: "",
  };
}

function buildBoostSgm(picks: PickLeg[]): { bet: MultiBet | null; reason: string } {
  const byGame = new Map<string, PickLeg[]>();
  for (const l of picks) {
    if (l.fairPrice < 1.5 || l.fairPrice > 3.0) continue;
    if (!qualifiesCrossBoostLeg(l)) continue;
    const arr = byGame.get(l.gameId) ?? [];
    arr.push(l);
    byGame.set(l.gameId, arr);
  }
  let bestTrio: PickLeg[] | null = null;
  let bestCombo = 0;

  for (const legs of byGame.values()) {
    legs.sort(sortLegs);
    const pool = legs.slice(0, 14);
    function dfs(idx: number, chosen: PickLeg[]) {
      if (chosen.length === 3) {
        const combo = combinedBetPrice(chosen);
        if (combo >= 7 && combo <= 15 && !multiHasClash(chosen) && combo > bestCombo) {
          bestCombo = combo;
          bestTrio = [...chosen];
        }
        return;
      }
      for (let i = idx; i < pool.length; i++) {
        const next = [...chosen, pool[i]];
        if (multiHasClash(next)) continue;
        dfs(i + 1, next);
      }
    }
    dfs(0, []);
  }

  if (!bestTrio) {
    return { bet: null, reason: "No same-game trio fair 1.50–3.00, combined 7–15" };
  }
  const trio = bestTrio;
  const { p, fair, takeAt } = combinedPrice(trio);
  const book = singleBookieOverlay(trio);
  if (!book) return { bet: null, reason: NO_AU_MULTI };
  return {
    bet: {
      type: "boostSgm",
      label: "Boost SGM",
      legs: trio.map((l) => l.id),
      combinedProbability: p,
      combinedFairPrice: fair,
      combinedTakeAt: takeAt,
      ...book,
      summary: "Same-game trio for boost offer (3 legs)",
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

function qualifiesLongshotBuildLeg(l: PickLeg): boolean {
  if (!qualifiesLongshotLeg(l)) return false;
  if (l.market === "3pm") return false;
  if (l.market === "dd" || l.market === "td" || l.market === "combo") {
    return l.bestPrice != null && l.bestPrice > 1;
  }
  if (l.market === "pts" && l.line >= 30) {
    return l.fairPrice >= 2.5 && l.fairPrice <= 20;
  }
  return false;
}

function buildLongshot(picks: PickLeg[]): { bet: MultiBet | null; reason: string } {
  const byGame = new Map<string, PickLeg[]>();
  for (const l of picks) {
    if (!qualifiesLongshotBuildLeg(l)) continue;
    const arr = byGame.get(l.gameId) ?? [];
    arr.push(l);
    byGame.set(l.gameId, arr);
  }
  const gameIds = [...byGame.keys()];
  let best: PickLeg[] | null = null;
  let bestCombo = 0;

  function dfs(gi: number, chosen: PickLeg[]) {
    if (chosen.length >= 2) {
      const combo = combinedBetPrice(chosen);
      if (combo >= 30 && combo <= 100 && !multiHasClash(chosen) && combo > bestCombo) {
        bestCombo = combo;
        best = [...chosen];
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

  if (!best || best.length < 2) {
    return {
      bet: null,
      reason:
        "No 2-game longshot: need starter DD/TD/combo with odds feed (or 30+ pts), no 3PM micro",
    };
  }
  const chosenLegs = best as PickLeg[];
  if (
    !chosenLegs.some((l) => ["dd", "td", "combo"].includes(l.market)) &&
    !chosenLegs.every((l) => l.market === "pts" && l.line >= 30)
  ) {
    return {
      bet: null,
      reason: "Longshot rejected: no priced DD/TD/combo starter legs",
    };
  }
  const combo = combinedBetPrice(chosenLegs);
  const { p, fair, takeAt } = combinedPrice(chosenLegs);
  const book = singleBookieOverlay(chosenLegs);
  if (!book) return { bet: null, reason: NO_AU_MULTI };
  return {
    bet: {
      type: "longshot",
      label: "Longshot",
      legs: chosenLegs.map((l) => l.id),
      combinedProbability: p,
      combinedFairPrice: fair,
      combinedTakeAt: takeAt,
      ...book,
      summary: "One long leg per game",
    },
    reason: "",
  };
}