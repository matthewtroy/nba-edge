import type { PickLeg, MultiBet, MultiType, MultiNotBuilt } from "./types.js";
import { legsClash, multiHasClash } from "./clash.js";
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

export function combinedBetPrice(legs: PickLeg[]): number {
  if (legs.length > 0 && legs.every((l) => l.bestPrice != null)) {
    return Math.round(legs.reduce((acc, l) => acc * (l.bestPrice ?? 1), 1) * 100) / 100;
  }
  return Math.round(legs.reduce((acc, l) => acc * l.takeAt, 1) * 100) / 100;
}

function bestCombinedBookie(legs: PickLeg[]): { price?: number; bookie?: string } {
  if (legs.every((l) => l.bestPrice != null)) {
    return { price: combinedBetPrice(legs), bookie: legs[0].bestBookie };
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

function sortLegs(a: PickLeg, b: PickLeg): number {
  if (b.probability !== a.probability) return b.probability - a.probability;
  const e = legEdge(b) - legEdge(a);
  if (e !== 0) return e;
  return injuryBoostScore(b) - injuryBoostScore(a);
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
  if (q1.bet) multis.push(q1.bet);
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
  filtered = enforceExposureCap(filtered, picksById);

  if (slateSize <= 4) {
    const types = new Set<MultiType>();
    const kept: MultiBet[] = [];
    for (const m of filtered) {
      if (m.type === "mainPlay") {
        kept.push({ ...m, smallSlateNote: true });
        types.add(m.type);
        continue;
      }
      if (types.size < 3 && !types.has(m.type)) {
        kept.push({ ...m, smallSlateNote: true });
        types.add(m.type);
      }
    }
    filtered = kept;
  }

  return { bets: filtered, notBuilt };
}

export function qualifiesMainPlayLeg(leg: PickLeg): boolean {
  return (
    leg.probability >= 0.6 &&
    leg.fairPrice >= 1.4 &&
    leg.fairPrice <= 2.5 &&
    !leg.ageB2B
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
  const pool = picks.filter(qualifiesMainPlayLeg).sort(sortLegs);
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
      if (combo >= 7 && combo <= 10 && !multiHasClash(chosen) && !hasQuestionableAnchor(chosen)) {
        candidates.push([...chosen]);
      }
    }
    if (depth >= 5) return;
    for (const gid of gameIds) {
      for (const leg of (byGame.get(gid) ?? []).slice(0, 8)) {
        if (!canAddToGame(chosen, leg, slateSize)) continue;
        const next = [...chosen, leg];
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

function buildBooster(
  main: MultiBet,
  picks: PickLeg[]
): { bet: MultiBet | null; reason: string } {
  const picksById = new Map(picks.map((p) => [p.id, p]));
  const boosted: PickLeg[] = [];
  for (const id of main.legs) {
    const leg = picksById.get(id);
    if (!leg || !meetsFloor(leg)) return { bet: null, reason: "Booster leg missing" };
    const up = nextRung(leg, picks);
    if (up && meetsFloor(up) && !multiHasClash(boosted.concat(up))) {
      const test = main.legs.map((mid) =>
        mid === id ? up : picksById.get(mid)!
      ) as PickLeg[];
      boosted.push(multiHasClash(test) ? leg : up);
    } else boosted.push(leg);
  }

  const { p, fair, takeAt } = combinedPrice(boosted);
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

function buildQ1Multi(picks: PickLeg[]): { bet: MultiBet | null; reason: string } {
  const q1 = picks.filter((l) => l.market.startsWith("q1") && l.fairPrice >= 1.8 && l.fairPrice <= 4);
  const byTeam = new Map<string, PickLeg[]>();
  for (const l of q1) {
    const key = `${l.gameId}|${l.team}`;
    const arr = byTeam.get(key) ?? [];
    arr.push(l);
    byTeam.set(key, arr);
  }
  const legs: PickLeg[] = [];
  for (const [, arr] of byTeam) {
    arr.sort(sortLegs);
    if (arr[0]) legs.push(arr[0]);
  }
  if (legs.length < 3) {
    return { bet: null, reason: `Only ${legs.length} teams with Q1 fair 1.80–4.00 (need 3–6)` };
  }
  const use = legs.slice(0, 6);
  if (multiHasClash(use)) {
    return { bet: null, reason: "Q1 legs clash" };
  }
  const { p, fair, takeAt } = combinedPrice(use);
  const book = bestCombinedBookie(use);
  return {
    bet: {
      type: "q1Multi",
      label: "Q1 Multi",
      legs: use.map((l) => l.id),
      combinedProbability: p,
      combinedFairPrice: fair,
      combinedTakeAt: takeAt,
      combinedBestPrice: book.price,
      combinedBestBookie: book.bookie,
      oneInX: Math.round(1 / p),
      summary: "One Q1 leg per team, fair 1.80–4.00",
    },
    reason: "",
  };
}

function buildCrossGameSgm(picks: PickLeg[]): { bet: MultiBet | null; reason: string } {
  const byGame = new Map<string, PickLeg[]>();
  for (const l of picks) {
    if (l.fairPrice < 1.35 || l.fairPrice > 2.5) continue;
    const arr = byGame.get(l.gameId) ?? [];
    arr.push(l);
    byGame.set(l.gameId, arr);
  }
  if (byGame.size < 2) {
    return { bet: null, reason: "Need 2+ games with legs fair 1.35–2.50" };
  }
  const chosen: PickLeg[] = [];
  for (const [, legs] of byGame) {
    legs.sort(sortLegs);
    let added = 0;
    for (const leg of legs) {
      if (added >= 2) break;
      const cand = [...chosen, leg];
      if (multiHasClash(cand)) continue;
      chosen.push(leg);
      added++;
    }
  }
  if (chosen.length < 4) {
    return { bet: null, reason: `Only ${chosen.length} legs (need 4+, 2/game)` };
  }
  const combo = combinedBetPrice(chosen);
  if (combo < 10 || combo > 30) {
    return { bet: null, reason: `Combined ${combo.toFixed(1)} outside 10–30` };
  }
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
  for (const [, legs] of byGame) {
    legs.sort(sortLegs);
    const trio: PickLeg[] = [];
    for (const leg of legs) {
      const cand = [...trio, leg];
      if (multiHasClash(cand)) continue;
      trio.push(leg);
      if (trio.length === 3) break;
    }
    if (trio.length < 3) continue;
    const combo = combinedBetPrice(trio);
    if (combo < 7 || combo > 15) continue;
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
  return { bet: null, reason: "No same-game trio fair 1.50–3.00, combined 7–15" };
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
  const chosen: PickLeg[] = [];
  for (const [, legs] of byGame) {
    legs.sort((a, b) => injuryBoostScore(b) - injuryBoostScore(a) || b.fairPrice - a.fairPrice);
    const leg = legs[0];
    if (!leg) continue;
    const cand = [...chosen, leg];
    if (multiHasClash(cand)) continue;
    chosen.push(leg);
  }
  if (chosen.length < 2) {
    return { bet: null, reason: "Need 2+ games with long legs (fair 2.50–20)" };
  }
  const combo = combinedBetPrice(chosen);
  if (combo < 30 || combo > 100) {
    return { bet: null, reason: `Combined ${combo.toFixed(1)} outside 30–100` };
  }
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