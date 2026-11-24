import type { MultiBet, MultiType, PickLeg } from "./types.js";
import { multiHasClash } from "./clash.js";
import { exposureViolation } from "./exposure.js";
import { isMainPlayStatLine } from "./starter-eligibility.js";
import { bestSingleBookieQuote } from "./single-bookie.js";
import { qualifiesBoostSgmLeg, qualifiesMainPlayLeg } from "./main-play-eligibility.js";

const MIN_LEG_FAIR = 1.3;

export interface GateResult {
  ok: boolean;
  violations: string[];
}

function isQ1Market(market: string): boolean {
  return market.startsWith("q1");
}

function takeAtProduct(legs: PickLeg[]): number {
  return Math.round(legs.reduce((acc, l) => acc * l.takeAt, 1) * 100) / 100;
}

function checkBoosterSteps(
  main: MultiBet | undefined,
  booster: MultiBet,
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
    if (boostLeg.line <= mainLeg.line) {
      issues.push(
        `Booster: ${mainLeg.playerName} ${mainLeg.market} not stepped (${mainLeg.line}+ → ${boostLeg.line}+)`
      );
    }
  }
  return issues;
}

function checkTypeRules(
  type: MultiType,
  legs: PickLeg[],
  mainPlay?: MultiBet
): string[] {
  const issues: string[] = [];
  const combo = takeAtProduct(legs);
  const fair = Math.round((1 / legs.reduce((a, l) => a * l.probability, 1)) * 100) / 100;

  for (const leg of legs) {
    if (type !== "q1Multi" && isQ1Market(leg.market)) {
      issues.push(`${type}: Q1 leg ${leg.playerName} only allowed in Q1 Multi`);
    }
  }

  if (type === "mainPlay") {
    if (legs.length < 4 || legs.length > 5) issues.push(`Main Play: ${legs.length} legs (need 4–5)`);
    if (combo < 7 || combo > 10) issues.push(`Main Play: take-at product ${combo.toFixed(2)} not 7–10`);
    if (!legs.every((l) => qualifiesMainPlayLeg(l))) {
      issues.push("Main Play: leg fails starter/main-line/eligibility");
    }
  }
  if (type === "booster") {
    if (fair < 30 || fair > 120) issues.push(`Booster: fair ${fair.toFixed(1)} not 30–120`);
  }
  if (type === "boostSgm") {
    if (legs.length !== 3) issues.push("Boost SGM: need 3 legs");
    if (combo < 7 || combo > 15) issues.push(`Boost SGM: take-at ${combo.toFixed(2)} not 7–15`);
    for (const leg of legs) {
      if (!qualifiesBoostSgmLeg(leg)) {
        issues.push(
          `Boost SGM: ${leg.playerName} ${leg.market} ${leg.line}+ fails starter/main-line (no Q1)`
        );
      }
    }
  }
  if (type === "longshot") {
    if (combo < 30 || combo > 100) issues.push(`Longshot: take-at ${combo.toFixed(2)} not 30–100`);
  }
  if (type === "crossGameSgm") {
    if (combo < 10 || combo > 30) issues.push(`Cross-Game: take-at ${combo.toFixed(2)} not 10–30`);
    if (!legs.every((l) => l.starterEligible && isMainPlayStatLine(l.market, l.line))) {
      issues.push("Cross-Game: non-starter or alt line");
    }
    if (legs.some((l) => isQ1Market(l.market))) issues.push("Cross-Game: Q1 leg not allowed");
  }
  if (type === "q1Multi") {
    if (!legs.every((l) => isQ1Market(l.market))) issues.push("Q1 Multi: non-Q1 leg");
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

  if (legs.length !== multi.legs.length) {
    violations.push(`${multi.label}: missing leg data`);
    return { ok: false, violations };
  }

  if (multiHasClash(legs)) violations.push(`${multi.label}: leg clash`);

  for (const leg of legs) {
    if (leg.fairPrice < MIN_LEG_FAIR) {
      violations.push(`${multi.label}: ${leg.playerName} fair ${leg.fairPrice.toFixed(2)} < ${MIN_LEG_FAIR}`);
    }
  }

  const takeAt = takeAtProduct(legs);
  if (Math.abs(takeAt - multi.combinedTakeAt) > 0.02) {
    violations.push(`${multi.label}: combinedTakeAt ${multi.combinedTakeAt} ≠ legs ${takeAt}`);
  }

  violations.push(...checkTypeRules(multi.type, legs, mainPlay));

  if (multi.type === "booster" && mainPlay && picksById) {
    violations.push(...checkBoosterSteps(mainPlay, multi, legs, picksById));
  }

  if (multi.combinedBestBookie === "Best mix") {
    violations.push(`${multi.label}: forbidden Best mix bookie label`);
  }

  if (multi.combinedBestPrice != null && multi.combinedBestBookie) {
    const quote = bestSingleBookieQuote(legs, multi.combinedTakeAt);
    if (!quote || quote.bookie !== multi.combinedBestBookie) {
      violations.push(`${multi.label}: best bookie does not match single-bookie quote`);
    } else if (quote.price < multi.combinedTakeAt) {
      violations.push(`${multi.label}: bookie total ${quote.price} below take-at ${multi.combinedTakeAt}`);
    }
  }

  return { ok: violations.length === 0, violations };
}

export function gateAllMultis(
  multis: MultiBet[],
  picksById: Map<string, PickLeg>
): { multis: MultiBet[]; violations: string[]; dropped: MultiBet[] } {
  const violations: string[] = [];
  const kept: MultiBet[] = [];
  const dropped: MultiBet[] = [];

  const exposure = exposureViolation(multis, picksById);
  if (!exposure.ok) {
    violations.push(
      `Exposure: player ${exposure.playerId} in ${exposure.count} multis`
    );
  }

  const mainPlay = multis.find((m) => m.type === "mainPlay");

  for (const multi of multis) {
    const legs = multi.legs.map((id) => picksById.get(id)).filter(Boolean) as PickLeg[];
    const result = gateMulti(multi, legs, mainPlay, picksById);
    violations.push(...result.violations);
    if (result.ok) kept.push(multi);
    else dropped.push(multi);
  }

  return { multis: kept, violations, dropped };
}