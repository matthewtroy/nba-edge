import type { MultiBet, MultiType, PickLeg } from "./types.js";
import { multiHasClash } from "./clash.js";
import { exposureViolation } from "./exposure.js";
import { bestSingleBookieQuote } from "./single-bookie.js";
import {
  gateLineViolation,
  qualifiesMainPlayLeg,
} from "./main-play-eligibility.js";

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

function checkLegEligibility(type: MultiType, leg: PickLeg, multiLabel: string): string[] {
  const allowQ1 = type === "q1Multi";
  const issues: string[] = [];
  const lineIssue = gateLineViolation(leg, allowQ1);
  if (lineIssue) issues.push(`${multiLabel}: ${lineIssue}`);
  return issues;
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

  let stepped = 0;
  for (const mainLeg of mainLegs) {
    const boostLeg = legs.find(
      (l) => l.playerId === mainLeg.playerId && l.market === mainLeg.market
    );
    if (!boostLeg) {
      issues.push(`Booster: missing leg for ${mainLeg.playerName} ${mainLeg.market}`);
      continue;
    }
    if (boostLeg.line > mainLeg.line) stepped++;
    else if (boostLeg.line < mainLeg.line) {
      issues.push(`Booster: ${mainLeg.playerName} below Main rung`);
    }
  }
  if (stepped < 2) issues.push("Booster: need at least 2 legs stepped from Main");
  if (stepped > 3) issues.push("Booster: stepped more than 3 legs (max 2–3 safest)");
  return issues;
}

function checkTypeRules(
  type: MultiType,
  legs: PickLeg[],
  label: string
): string[] {
  const issues: string[] = [];
  const combo = takeAtProduct(legs);
  const fair = Math.round((1 / legs.reduce((a, l) => a * l.probability, 1)) * 100) / 100;

  for (const leg of legs) {
    issues.push(...checkLegEligibility(type, leg, label));
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
  }
  if (type === "longshot") {
    if (combo < 30 || combo > 100) issues.push(`Longshot: take-at ${combo.toFixed(2)} not 30–100`);
  }
  if (type === "crossGameSgm") {
    if (combo < 10 || combo > 30) issues.push(`Cross-Game: take-at ${combo.toFixed(2)} not 10–30`);
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
  }

  const takeAt = takeAtProduct(legs);
  if (Math.abs(takeAt - multi.combinedTakeAt) > 0.02) {
    violations.push(`${label}: combinedTakeAt ${multi.combinedTakeAt} ≠ legs ${takeAt}`);
  }

  violations.push(...checkTypeRules(multi.type, legs, label));

  if (multi.type === "booster" && mainPlay && picksById) {
    violations.push(...checkBoosterSteps(mainPlay, legs, picksById));
  }

  if (multi.combinedBestBookie === "Best mix") {
    violations.push(`${label}: forbidden Best mix bookie label`);
  }

  if (multi.combinedBestPrice != null && multi.combinedBestBookie) {
    const quote = bestSingleBookieQuote(legs, multi.combinedTakeAt);
    if (!quote || quote.bookie !== multi.combinedBestBookie) {
      violations.push(`${label}: best bookie does not match single-bookie quote`);
    } else if (quote.price < multi.combinedTakeAt) {
      violations.push(`${label}: bookie total ${quote.price} below take-at ${multi.combinedTakeAt}`);
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