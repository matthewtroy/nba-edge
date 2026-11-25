import type { MultiBet, MultiType, PickLeg } from "./types.js";
import { multiHasClash } from "./clash.js";
import { bestFeedMultiQuote } from "./card-bookie.js";
import { combinedPriceForBookieWithCatalog } from "./single-bookie.js";
import {
  gateLineViolation,
  qualifiesMainPlayLeg,
  qualifiesCrossBoostLeg,
} from "./main-play-eligibility.js";
import { CROSS_SGM_BAND_MIN, CROSS_SGM_BAND_MAX } from "./same-game-sgm-search.js";
import {
  MAIN_PLAY_COMBINED_MIN,
  MAIN_PLAY_COMBINED_MAX,
} from "./pricing-config.js";
import { combinedFairAndTakeAt, DEFAULT_MIN_EDGE } from "./multi-combined.js";

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
  const allowQ1 = type === "q1Multi";
  const issues: string[] = [];
  const lineIssue = gateLineViolation(leg, allowQ1, {
    mainPlay: type === "mainPlay",
  });
  if (lineIssue) issues.push(`${multiLabel}: ${lineIssue}`);
  return issues;
}

function rungIndex(leg: PickLeg, picksById: Map<string, PickLeg>): number {
  const same = [...picksById.values()].filter(
    (p) => p.playerId === leg.playerId && p.market === leg.market
  );
  same.sort((a, b) => a.line - b.line);
  return same.findIndex((p) => p.line === leg.line);
}

function checkBoosterSteps(
  main: MultiBet | undefined,
  legs: PickLeg[],
  picksById: Map<string, PickLeg>
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
    const mainIdx = rungIndex(mainLeg, picksById);
    const boostIdx = rungIndex(boostLeg, picksById);
    if (boostIdx < mainIdx) {
      issues.push(`Booster: ${mainLeg.playerName} below Main rung`);
    }
    if (boostIdx > mainIdx + 1) {
      issues.push(`Booster: ${mainLeg.playerName} more than +1 rung above Main`);
    }
  }
  return issues;
}

function checkTypeRules(
  type: MultiType,
  legs: PickLeg[],
  label: string,
  multi: MultiBet
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
      multi.bestBookieTotal ?? bestFeedMultiQuote(legs)?.total ?? null;
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
  if (type === "booster" && fair < 1) {
    issues.push("Booster: invalid fair");
  }
  if (type === "boostSgm") {
    if (legs.length < 3 || legs.length > 4) {
      issues.push(`Best SGM: ${legs.length} legs (need 3–4)`);
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
    if (byGame.size < 2) issues.push("Cross-Game: need legs from 2+ games");
    if (byGame.size > 5) issues.push("Cross-Game: more than 5 games");
    for (const [gid, n] of byGame) {
      if (n < 1 || n > 2) {
        issues.push(`Cross-Game: game ${gid} has ${n} legs (need 1–2)`);
      }
    }
    const bookTotal =
      multi.bestBookieTotal ?? bestFeedMultiQuote(legs)?.total ?? null;
    if (bookTotal == null || bookTotal < CROSS_SGM_BAND_MIN || bookTotal > CROSS_SGM_BAND_MAX) {
      issues.push(
        `Cross-Game: bookie total ${bookTotal != null ? bookTotal.toFixed(2) : "?"} not $${CROSS_SGM_BAND_MIN}–$${CROSS_SGM_BAND_MAX}`
      );
    }
  }
  return issues;
}

export function gateMulti(
  multi: MultiBet,
  legs: PickLeg[],
  mainPlay?: MultiBet,
  picksById?: Map<string, PickLeg>
): GateResult {
  const violations: string[] = [];
  const label = multi.variant ? `${multi.label} (${multi.variant})` : multi.label;

  if (legs.length !== multi.legs.length) {
    violations.push(`${label}: missing leg data`);
    return { ok: false, violations };
  }

  if (multiHasClash(legs)) violations.push(`${label}: leg clash`);

  for (const leg of legs) {
    if (leg.fairPrice < MIN_LEG_FAIR) {
      violations.push(`${label}: ${leg.playerName} fair ${leg.fairPrice.toFixed(2)} < ${MIN_LEG_FAIR}`);
    }
    if (
      leg.tags.includes("Check news") &&
      multi.type !== "crossGameSgm" &&
      multi.type !== "boostSgm"
    ) {
      violations.push(`${label}: ${leg.playerName} has Check news`);
    }
  }

  const takeAt = expectedMultiTakeAt(legs);
  if (Math.abs(takeAt - multi.combinedTakeAt) > 0.02) {
    violations.push(`${label}: combinedTakeAt ${multi.combinedTakeAt} ≠ fair×edge ${takeAt}`);
  }

  violations.push(...checkTypeRules(multi.type, legs, label, multi));

  if (multi.type === "booster" && mainPlay && picksById) {
    violations.push(...checkBoosterSteps(mainPlay, legs, picksById));
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
        const feed = bestFeedMultiQuote(legs, catalog);
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

  for (const multi of multis) {
    const legs = multi.legs.map((id) => picksById.get(id)).filter(Boolean) as PickLeg[];
    const result = gateMulti(multi, legs, mainPlay, picksById);
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