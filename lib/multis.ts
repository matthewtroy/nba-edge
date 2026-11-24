import type { PickLeg, MultiBet, MultiType, MultiNotBuilt } from "./types.js";
import { legsClash, multiClashSummary, multiHasClash } from "./clash.js";
import { isMainPlayStatLine } from "./starter-eligibility.js";
import { enforceExposureCap } from "./exposure.js";

export interface MultiBuildResult {
  bets: MultiBet[];
  notBuilt: MultiNotBuilt[];
}

export const MIN_LEG_FAIR = 1.3;

function combinedPrice(legs: PickLeg[]): {
  p: number;
  fair: number;
  takeAt: number;
} {
  const p = legs.reduce((acc, l) => acc * l.probability, 1);
  const fair = Math.round((1 / p) * 100) / 100;
  const takeAt = Math.round(legs.reduce((acc, l) => acc * l.takeAt, 1) * 100) / 100;
  return { p, fair, takeAt };
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

function bestCombinedBookie(legs: PickLeg[]): { price?: number; bookie?: string } {
  if (legs.every((l) => legMeetsTakeAt(l))) {
    const bookies = new Set(legs.map((l) => l.bestBookie).filter(Boolean));
    const bookie = bookies.size === 1 ? legs[0].bestBookie : "Best mix";
    return { price: combinedBetPrice(legs), bookie };
  }
  return {};
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
  targetProfit = 300
): MultiBuildResult {
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

  const q1 = buildQ1Multi(byP);
  if (q1.bets.length) multis.push(...q1.bets);
  else notBuilt.push({ type: "q1Multi", label: LABELS.q1Multi, reason: q1.reason });

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
  let filtered = multis.filter((m) => {
    const legs = m.legs.map((id) => picksById.get(id)).filter(Boolean) as PickLeg[];
    return legs.length === m.legs.length && !multiHasClash(legs);
  });
  const preExposure = [...filtered];
  filtered = enforceExposureCap(filtered, picksById);

  const keptTypes = new Set(filtered.map((m) => m.type));
  for (const m of preExposure) {
    if (keptTypes.has(m.type)) continue;
    if (notBuilt.some((n) => n.type === m.type && !n.variant)) continue;
    notBuilt.push({
      type: m.type,
      label: LABELS[m.type],
      variant: m.variant,
      reason: "Removed after clash check or exposure cap",
    });
  }

  if (slateSize <= 4) {
    filtered = filtered.map((m) => ({ ...m, smallSlateNote: true }));
  }

  return { bets: filtered, notBuilt };
}

export function qualifiesMainPlayLeg(leg: PickLeg): boolean {
  return (
    leg.starterEligible === true &&
    isMainPlayStatLine(leg.market, leg.line) &&
    isCoreMarket(leg.market) &&
    leg.probability >= 0.6 &&
    leg.fairPrice >= 1.4 &&
    leg.fairPrice <= 2.5 &&
    !leg.ageB2B &&
    !hasCheckNews(leg)
  );
}

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
  const book = bestCombinedBookie(best);
  const stake = Math.round((targetProfit / (combo - 1)) * 100) / 100;

  return {
    bet: {
      type: "mainPlay",
      label: "Main Play",
      legs: best.map((l) => l.id),
      combinedProbability: p,
      combinedFairPrice: fair,
      combinedTakeAt: takeAt,
      combinedBestPrice: book.price,
      combinedBestBookie: book.bookie,
      oneInX: Math.round(1 / p),
      stakeSuggestion: stake,
      summary: `${best.length} legs @ ${combo.toFixed(2)}+ combined`,
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
  legIdsToBoost: Set<string>
): PickLeg[] | null {
  const picksById = new Map(picks.map((p) => [p.id, p]));
  const boosted: PickLeg[] = [];
  for (const id of main.legs) {
    const leg = picksById.get(id);
    if (!leg || !meetsFloor(leg) || hasCheckNews(leg)) return null;
    if (!legIdsToBoost.has(id)) {
      boosted.push(leg);
      continue;
    }
    const up = nextRung(leg, picks);
    if (up && meetsFloor(up) && !hasCheckNews(up)) {
      const test = main.legs.map((mid) =>
        mid === id ? up : picksById.get(mid)!
      ) as PickLeg[];
      boosted.push(multiHasClash(test) ? leg : up);
    } else {
      boosted.push(leg);
    }
  }
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

  const allBoost = new Set(main.legs);
  let boosted =
    boostMainLegs(main, picks, allBoost) ??
    ([] as PickLeg[]);
  if (!boosted.length) {
    return { bet: null, reason: "Booster leg missing" };
  }

  let { fair } = combinedPrice(boosted);
  if (fair > 120) {
    const safest = [...mainLegs]
      .sort((a, b) => b.probability - a.probability)
      .slice(0, 3)
      .map((l) => l.id);
    const selective = new Set(safest);
    const retry = boostMainLegs(main, picks, selective);
    if (retry?.length) {
      boosted = retry;
      fair = combinedPrice(boosted).fair;
    }
  }

  if (fair < 30 || fair > 120) {
    return {
      bet: null,
      reason: `Booster combined fair ${fair.toFixed(1)} outside 30–120`,
    };
  }

  const { p, takeAt } = combinedPrice(boosted);
  const book = bestCombinedBookie(boosted);
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
      combinedBestPrice: book.price,
      combinedBestBookie: book.bookie,
      oneInX: Math.round(1 / p),
      stakeSuggestion: 5,
      summary: `Main Play +1 rung — $5 straight${trixieNote}`,
    },
    reason: "",
  };
}

function findQ1Subset(
  teamKeys: string[],
  byTeam: Map<string, PickLeg[]>,
  minFair: number,
  maxFair: number
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
    const legs = (byTeam.get(key) ?? []).filter(
      (l) => l.fairPrice >= minFair && l.fairPrice <= maxFair
    );
    dfs(ti + 1, chosen);
    for (const leg of legs.slice(0, 12)) {
      const next = [...chosen, leg];
      if (multiHasClash(next)) continue;
      dfs(ti + 1, next);
    }
  }
  dfs(0, []);

  if (!candidates.length) return null;
  candidates.sort((a, b) => {
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
  const book = bestCombinedBookie(legs);
  return {
    type: "q1Multi",
    label: "Q1 Multi",
    variant,
    legs: legs.map((l) => l.id),
    combinedProbability: p,
    combinedFairPrice: fair,
    combinedTakeAt: takeAt,
    combinedBestPrice: book.price,
    combinedBestBookie: book.bookie,
    oneInX: Math.round(1 / p),
    summary,
  };
}

function buildQ1Multi(picks: PickLeg[]): { bets: MultiBet[]; reason: string } {
  const q1 = picks.filter(
    (l) => l.market.startsWith("q1") && l.fairPrice >= 1.8 && l.fairPrice <= 4
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
  if (teamKeys.length < 3) {
    return {
      bets: [],
      reason: `Only ${teamKeys.length} teams with Q1 fair 1.80–4.00 (need 3–6)`,
    };
  }

  const bets: MultiBet[] = [];
  const safe = findQ1Subset(teamKeys, byTeam, 1.8, 2.4);
  if (safe) {
    bets.push(
      q1MultiFromLegs(safe, "Safe", "Safe Q1: fair 1.80–2.40, one leg/team")
    );
  }
  const value = findQ1Subset(teamKeys, byTeam, 2.2, 4);
  if (value && (!safe || value.map((l) => l.id).join() !== safe.map((l) => l.id).join())) {
    bets.push(
      q1MultiFromLegs(value, "Value", "Value Q1: fair 2.20–4.00, one leg/team")
    );
  }
  if (!bets.length) {
    const any = findQ1Subset(teamKeys, byTeam, 1.8, 4);
    if (any) {
      bets.push(
        q1MultiFromLegs(any, undefined, "One Q1 leg per team, fair 1.80–4.00")
      );
    }
  }
  if (!bets.length) {
    return {
      bets: [],
      reason: "No clash-free Q1 combo (3–6 teams, one leg each)",
    };
  }
  return { bets, reason: "" };
}

function buildCrossGameSgm(picks: PickLeg[]): { bet: MultiBet | null; reason: string } {
  const pool = picks.filter(
    (l) =>
      l.starterEligible &&
      isMainPlayStatLine(l.market, l.line) &&
      l.fairPrice >= 1.35 &&
      l.fairPrice <= 2.5
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
  const book = bestCombinedBookie(chosen);
  return {
    bet: {
      type: "crossGameSgm",
      label: "Cross-Game SGM Multi",
      legs: chosen.map((l) => l.id),
      combinedProbability: p,
      combinedFairPrice: fair,
      combinedTakeAt: takeAt,
      combinedBestPrice: book.price,
      combinedBestBookie: book.bookie,
      oneInX: Math.round(1 / p),
      summary: "2+ legs/game, fair 1.35–2.50 each",
    },
    reason: "",
  };
}

function buildBoostSgm(picks: PickLeg[]): { bet: MultiBet | null; reason: string } {
  const byGame = new Map<string, PickLeg[]>();
  for (const l of picks) {
    if (l.fairPrice < 1.5 || l.fairPrice > 3.0) continue;
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
  const book = bestCombinedBookie(trio);
  return {
    bet: {
      type: "boostSgm",
      label: "Boost SGM",
      legs: trio.map((l) => l.id),
      combinedProbability: p,
      combinedFairPrice: fair,
      combinedTakeAt: takeAt,
      combinedBestPrice: book.price,
      combinedBestBookie: book.bookie,
      oneInX: Math.round(1 / p),
      summary: "bet365 25% boost (needs 3 legs)",
    },
    reason: "",
  };
}

function buildLongshot(picks: PickLeg[]): { bet: MultiBet | null; reason: string } {
  const byGame = new Map<string, PickLeg[]>();
  for (const l of picks) {
    const special =
      l.market === "dd" ||
      l.market === "td" ||
      l.market === "combo" ||
      (l.market === "pts" && l.line >= 30);
    if (!special && l.fairPrice < 2.5) continue;
    if (l.fairPrice > 20) continue;
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
        (a, b) => injuryBoostScore(b) - injuryBoostScore(a) || b.fairPrice - a.fairPrice
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
    return { bet: null, reason: "Need 2+ games with long legs (fair 2.50–20)" };
  }
  const chosen = best;
  const combo = combinedBetPrice(chosen);
  const { p, fair, takeAt } = combinedPrice(chosen);
  const book = bestCombinedBookie(chosen);
  return {
    bet: {
      type: "longshot",
      label: "Longshot",
      legs: chosen.map((l) => l.id),
      combinedProbability: p,
      combinedFairPrice: fair,
      combinedTakeAt: takeAt,
      combinedBestPrice: book.price,
      combinedBestBookie: book.bookie,
      oneInX: Math.round(1 / p),
      summary: "One long leg per game",
    },
    reason: "",
  };
}