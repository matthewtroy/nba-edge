import type { MultiBet, MultiType, PickLeg } from "./types.js";
import { crossGameMultiHasClash, multiHasClash } from "./clash.js";
import { bestEdgeMultiQuote } from "./best-multi-bookie.js";
import { combinedPriceForBookieWithCatalog } from "./single-bookie.js";
import {
  gateLineViolation,
  qualifiesMainPlayLeg,
  qualifiesCrossBoostLeg,
} from "./main-play-eligibility.js";
import { qualifiesCrossGameSgmLeg } from "./cross-game-sgm-leg.js";
import { CROSS_SGM_MIN_GAMES, CROSS_LEGS_PER_GAME } from "./same-game-sgm-search.js";
import {
  MAIN_PLAY_COMBINED_MIN,
  MAIN_PLAY_COMBINED_MAX,
  DOUBLE_UP_MIN,
  DOUBLE_UP_MAX,
} from "./pricing-config.js";
import { isMainPlayStatLine } from "./starter-eligibility.js";
import { combinedFairAndTakeAt, DEFAULT_MIN_EDGE } from "./multi-combined.js";
import { legPriceAtBookie } from "./single-bookie.js";
import { legMeetsBookieEdge } from "./bookie-edge-pool.js";

const MIN_LEG_FAIR = 1.3;

export interface GateResult {
  ok: boolean;
  violations: string[];
}

function isQ1Market(market: string): boolean {
  return market.startsWith("q1");
}

function expectedMultiTakeAt(legs: PickLeg[]): number {
  return combinedFairAndTakeAt(legs, DEFAULT_MIN_EDGE).takeAt;
}

/** Product of per-leg take-ats — used only for builder range rules (7–10 etc.). */
function takeAtProduct(legs: PickLeg[]): number {
  return Math.round(legs.reduce((acc, l) => acc * l.takeAt, 1) * 100) / 100;
}

function checkLegEligibility(type: MultiType, leg: PickLeg, multiLabel: string): string[] {
  if (type === "crossGameSgm") {
    return [];
  }
  const allowQ1 = type === "q1Multi";
  const issues: string[] = [];
  const lineIssue = gateLineViolation(leg, allowQ1, {
    mainPlay: type === "mainPlay",
  });
  if (lineIssue) issues.push(`${multiLabel}: ${lineIssue}`);
  return issues;
}

type MarketRungCache = Map<string, PickLeg[]>;

function buildMarketRungCache(picksById: Map<string, PickLeg>): MarketRungCache {
  const cache: MarketRungCache = new Map();
  for (const p of picksById.values()) {
    const key = `${p.playerId}|${p.market}`;
    const arr = cache.get(key) ?? [];
    arr.push(p);
    cache.set(key, arr);
  }
  for (const arr of cache.values()) {
    arr.sort((a, b) => a.line - b.line);
  }
  return cache;
}

function marketRungs(
  leg: PickLeg,
  picksById: Map<string, PickLeg>,
  cache?: MarketRungCache
): PickLeg[] {
  const key = `${leg.playerId}|${leg.market}`;
  if (cache?.has(key)) return cache.get(key)!;
  const same = [...picksById.values()].filter(
    (p) => p.playerId === leg.playerId && p.market === leg.market
  );
  same.sort((a, b) => a.line - b.line);
  cache?.set(key, same);
  return same;
}

function rungIndex(leg: PickLeg, picksById: Map<string, PickLeg>): number {
  return marketRungs(leg, picksById).findIndex((p) => p.line === leg.line);
}

function checkBoosterSteps(
  main: MultiBet | undefined,
  legs: PickLeg[],
  picksById: Map<string, PickLeg>,
  rungCache?: MarketRungCache
): string[] {
  const issues: string[] = [];
  if (!main) {
    issues.push("Booster: no Main Play to compare");
    return issues;
  }
  const mainLegs = main.legs
    .map((id) => picksById.get(id))
    .filter(Boolean) as PickLeg[];

  for (const mainLeg of mainLegs) {
    const boostLeg = legs.find(
      (l) => l.playerId === mainLeg.playerId && l.market === mainLeg.market
    );
    if (!boostLeg) {
      issues.push(`Booster: missing leg for ${mainLeg.playerName} ${mainLeg.market}`);
      continue;
    }
    const rungs = marketRungs(mainLeg, picksById, rungCache);
    const mainIdx = rungs.findIndex((p) => p.line === mainLeg.line);
    const boostIdx = rungs.findIndex((p) => p.line === boostLeg.line);
    if (boostIdx < mainIdx) {
      issues.push(`Booster: ${mainLeg.playerName} below Main rung`);
    }
    if (boostIdx > mainIdx + 1) {
      const bookie = main.bestBookie;
      const gaps = rungs.slice(mainIdx + 1, boostIdx);
      const skipUnpricedOnly =
        bookie != null &&
        gaps.length > 0 &&
        gaps.every((r) => legPriceAtBookie(r, bookie) == null);
      if (!skipUnpricedOnly) {
        issues.push(`Booster: ${mainLeg.playerName} more than +1 rung above Main`);
      }
    }
  }
  return issues;
}

function checkTypeRules(
  type: MultiType,
  legs: PickLeg[],
  label: string,
  multi: MultiBet,
  catalog?: PickLeg[]
): string[] {
  const issues: string[] = [];
  const combo = takeAtProduct(legs);
  const fair = Math.round((1 / legs.reduce((a, l) => a * l.probability, 1)) * 100) / 100;

  for (const leg of legs) {
    issues.push(...checkLegEligibility(type, leg, label));
  }

  if (type === "mainPlay") {
    if (legs.length < 3 || legs.length > 5) issues.push(`Main Play: ${legs.length} legs (need 3–5)`);
    const bookTotal =
      multi.bestBookieTotal ??
        bestEdgeMultiQuote(legs, {
          buildBookie: multi.bestBookie,
          catalog: catalog ?? legs,
        })?.total ??
        null;
    if (
      bookTotal == null ||
      bookTotal < MAIN_PLAY_COMBINED_MIN ||
      bookTotal > MAIN_PLAY_COMBINED_MAX
    ) {
      issues.push(
        `Main Play: bookie total ${bookTotal != null ? bookTotal.toFixed(2) : "?"} not $${MAIN_PLAY_COMBINED_MIN}–$${MAIN_PLAY_COMBINED_MAX}`
      );
    }
    if (!legs.every((l) => qualifiesMainPlayLeg(l, multi.bestBookie))) {
      issues.push("Main Play: leg fails starter/main-line/eligibility");
    }
  }
  if (type === "doubleUp") {
    if (legs.length < 2 || legs.length > 3) {
      issues.push(`Best Double Up: ${legs.length} legs (need 2–3)`);
    }
    const bookTotal =
      multi.bestBookieTotal ??
        bestEdgeMultiQuote(legs, {
          buildBookie: multi.bestBookie,
          catalog: catalog ?? legs,
        })?.total ??
        null;
    if (
      bookTotal == null ||
      bookTotal < DOUBLE_UP_MIN ||
      bookTotal > DOUBLE_UP_MAX
    ) {
      issues.push(
        `Best Double Up: bookie total ${bookTotal != null ? bookTotal.toFixed(2) : "?"} not $${DOUBLE_UP_MIN}–$${DOUBLE_UP_MAX}`
      );
    }
    if (
      !legs.every(
        (l) =>
          l.starterEligible === true &&
          isMainPlayStatLine(l.market, l.line) &&
          !l.market.startsWith("q1")
      )
    ) {
      issues.push("Best Double Up: leg fails starter/main-line eligibility");
    }
  }
  if (type === "booster" && fair < 1) {
    issues.push("Booster: invalid fair");
  }
  if (type === "boostSgm") {
    if (legs.length < 2 || legs.length > 5) {
      issues.push(`Best SGM: ${legs.length} legs (need 2–5)`);
    }
    const bookTotal =
      multi.bestBookieTotal ??
        bestEdgeMultiQuote(legs, {
          buildBookie: multi.bestBookie,
          catalog: catalog ?? legs,
        })?.total ??
        null;
    if (bookTotal == null || bookTotal < 2) {
      issues.push(
        `Best SGM: bookie total ${bookTotal != null ? bookTotal.toFixed(2) : "?"} below $2`
      );
    }
    if (!legs.every((l) => qualifiesCrossBoostLeg(l, multi.bestBookie))) {
      issues.push("Best SGM: leg fails starter main-line eligibility");
    }
    for (const leg of legs) {
      if ((leg.projectedMinutes ?? 0) < 24) {
        issues.push(`Best SGM: ${leg.playerName} projected ${(leg.projectedMinutes ?? 0).toFixed(0)} min (<24)`);
      }
    }
  }
  if (type === "longshot") {
    if (combo < 30 || combo > 150) issues.push(`Longshot: take-at ${combo.toFixed(2)} not 30–150`);
    if (legs.some((l) => l.market === "3pm")) {
      issues.push("Longshot: forbidden 3PM legs (use DD/TD or 30+ pts)");
    }
    const hasSpecial = legs.some((l) =>
      ["dd", "td"].includes(l.market)
    );
  if (!hasSpecial && !legs.every((l) => l.market === "pts" && l.line >= 30)) {
      issues.push("Longshot: need priced DD/TD or 30+ pts starters");
    }
  }
  if (type === "crossGameSgm") {
    const byGame = new Map<string, number>();
    for (const l of legs) {
      byGame.set(l.gameId, (byGame.get(l.gameId) ?? 0) + 1);
    }
    if (byGame.size < CROSS_SGM_MIN_GAMES) {
      issues.push(`Cross-Game: ${byGame.size} games (need ${CROSS_SGM_MIN_GAMES}+)`);
    }
    for (const [gid, n] of byGame) {
      if (n < 1 || n > CROSS_LEGS_PER_GAME) {
        issues.push(
          `Cross-Game: game ${gid} has ${n} legs (need 1–${CROSS_LEGS_PER_GAME})`
        );
      }
    }
    const bookie = multi.bestBookie ?? "";
    const pool = catalog ?? legs;
    if (
      bookie &&
      !legs.every((l) => qualifiesCrossGameSgmLeg(l, bookie, pool))
    ) {
      issues.push("Cross-Game: leg fails cross SGM eligibility");
    }
  }
  return issues;
}

export function gateMulti(
  multi: MultiBet,
  legs: PickLeg[],
  mainPlay?: MultiBet,
  picksById?: Map<string, PickLeg>,
  rungCache?: MarketRungCache
): GateResult {
  const violations: string[] = [];
  const label = multi.variant ? `${multi.label} (${multi.variant})` : multi.label;

  if (legs.length !== multi.legs.length) {
    violations.push(`${label}: missing leg data`);
    return { ok: false, violations };
  }

  if (multi.type !== "q1Multi") {
    const clashes =
      multi.type === "crossGameSgm"
        ? crossGameMultiHasClash(legs)
        : multiHasClash(legs);
    if (clashes) violations.push(`${label}: leg clash`);
  }

  const bookieForLegs = multi.bestBookie ?? "";
  for (const leg of legs) {
    if (multi.type !== "crossGameSgm" && leg.fairPrice < MIN_LEG_FAIR) {
      violations.push(`${label}: ${leg.playerName} fair ${leg.fairPrice.toFixed(2)} < ${MIN_LEG_FAIR}`);
    }
    if (leg.tags.includes("Check news") && multi.type !== "boostSgm") {
      violations.push(`${label}: ${leg.playerName} has Check news`);
    }
    if (
      bookieForLegs &&
      multi.type !== "q1Multi" &&
      (multi.type === "mainPlay" ||
        multi.type === "doubleUp" ||
        multi.type === "booster" ||
        multi.type === "boostSgm" ||
        multi.type === "longshot")
    ) {
      if (!legMeetsBookieEdge(leg, bookieForLegs)) {
        violations.push(`${label}: ${leg.playerName} edge miss at ${bookieForLegs}`);
      }
    }
  }

  const takeAt = expectedMultiTakeAt(legs);
  if (Math.abs(takeAt - multi.combinedTakeAt) > 0.02) {
    violations.push(`${label}: combinedTakeAt ${multi.combinedTakeAt} ≠ fair×edge ${takeAt}`);
  }

  const catalog = picksById ? [...picksById.values()] : legs;
  violations.push(...checkTypeRules(multi.type, legs, label, multi, catalog));

  if (multi.type === "booster" && mainPlay && picksById) {
    violations.push(...checkBoosterSteps(mainPlay, legs, picksById, rungCache));
  }

  const mixedLabel =
    multi.bestBookie ?? multi.combinedBestBookie ?? "";
  if (
    mixedLabel === "Best mix" ||
    mixedLabel === "Best across books" ||
    multi.combinedBestBookie === "Best mix" ||
    multi.combinedBestBookie === "Best across books"
  ) {
    violations.push(`${label}: forbidden mixed-bookie odds label`);
  }

  if (multi.type !== "q1Multi") {
    if (multi.bestBookie && multi.bestBookieTotal != null) {
      const catalog = picksById ? [...picksById.values()] : legs;
      const total = combinedPriceForBookieWithCatalog(legs, multi.bestBookie, catalog);
      if (total == null || Math.abs(total - multi.bestBookieTotal) > 0.02) {
        const feed = bestEdgeMultiQuote(legs, {
          buildBookie: multi.bestBookie,
          catalog,
        });
        if (
          !feed ||
          feed.bookie !== multi.bestBookie ||
          Math.abs(feed.total - multi.bestBookieTotal) > 0.02
        ) {
          violations.push(`${label}: AU bookie multi total mismatch`);
        }
      }
    } else {
      violations.push(`${label}: no AU bookie multi total`);
    }
  }

  return { ok: violations.length === 0, violations };
}

export function gateAllMultis(
  multis: MultiBet[],
  picksById: Map<string, PickLeg>,
  catalog?: PickLeg[]
): {
  multis: MultiBet[];
  violations: string[];
  dropped: MultiBet[];
  droppedReasons: Map<string, string[]>;
} {
  const violations: string[] = [];
  const kept: MultiBet[] = [];
  const dropped: MultiBet[] = [];
  const droppedReasons = new Map<string, string[]>();

  const pool = catalog ?? [...picksById.values()];
  void pool;

  const mainPlay = multis.find((m) => m.type === "mainPlay");
  const rungCache = buildMarketRungCache(picksById);

  for (const multi of multis) {
    const legs = multi.legs.map((id) => picksById.get(id)).filter(Boolean) as PickLeg[];
    const result = gateMulti(multi, legs, mainPlay, picksById, rungCache);
    violations.push(...result.violations);
    if (result.ok) kept.push(multi);
    else {
      dropped.push(multi);
      const key = `${multi.type}|${multi.variant ?? ""}|${multi.legs.join(",")}`;
      droppedReasons.set(key, result.violations);
    }
  }

  return { multis: kept, violations, dropped, droppedReasons };
}