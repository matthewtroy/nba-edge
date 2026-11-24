import type { MultiBet, MultiType, PickLeg } from "./types.js";
import { multiHasClash } from "./clash.js";
import { exposureViolation } from "./exposure.js";
const MIN_LEG_FAIR = 1.3;
import { isMainPlayStatLine } from "./starter-eligibility.js";
import { bestSingleBookieQuote } from "./single-bookie.js";

export interface GateResult {
  ok: boolean;
  violations: string[];
}

function takeAtProduct(legs: PickLeg[]): number {
  return Math.round(legs.reduce((acc, l) => acc * l.takeAt, 1) * 100) / 100;
}

function checkTypeRules(type: MultiType, legs: PickLeg[]): string[] {
  const issues: string[] = [];
  const combo = takeAtProduct(legs);
  const fair = Math.round((1 / legs.reduce((a, l) => a * l.probability, 1)) * 100) / 100;

  if (type === "mainPlay") {
    if (legs.length < 4 || legs.length > 5) issues.push(`Main Play: ${legs.length} legs (need 4–5)`);
    if (combo < 7 || combo > 10) issues.push(`Main Play: take-at product ${combo.toFixed(2)} not 7–10`);
    if (!legs.every((l) => l.fairPrice >= 1.4 && l.fairPrice <= 2.5 && l.probability >= 0.6)) {
      issues.push("Main Play: leg outside fair/p rules");
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
    if (!legs.every((l) => l.starterEligible && isMainPlayStatLine(l.market, l.line))) {
      issues.push("Cross-Game: non-starter or alt line");
    }
  }
  return issues;
}

export function gateMulti(
  multi: MultiBet,
  legs: PickLeg[]
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

  violations.push(...checkTypeRules(multi.type, legs));

  if (multi.combinedBestBookie === "Best mix") {
    violations.push(`${multi.label}: forbidden Best mix bookie label`);
  }

  if (multi.combinedBestPrice != null && multi.combinedBestBookie) {
    const quote = bestSingleBookieQuote(legs, multi.combinedTakeAt);
    if (!quote || quote.bookie !== multi.combinedBestBookie) {
      violations.push(`${multi.label}: best bookie does not match single-bookie quote`);
    } else if (quote.price < multi.combinedTakeAt) {
      violations.push(`${multi.label}: bookie total ${quote.price} below take-at ${multi.combinedTakeAt}`);
    } else if (
      multi.combinedBestPrice != null &&
      Math.abs(quote.price - multi.combinedBestPrice) > 0.02
    ) {
      violations.push(`${multi.label}: stored best price mismatch`);
    }
  }

  return { ok: violations.length === 0, violations };
}

export function gateAllMultis(
  multis: MultiBet[],
  picksById: Map<string, PickLeg>
): { multis: MultiBet[]; violations: string[] } {
  const violations: string[] = [];

  const exposure = exposureViolation(multis, picksById);
  if (!exposure.ok) {
    violations.push(
      `Exposure: player ${exposure.playerId} in ${exposure.count} multis`
    );
  }

  const cleaned: MultiBet[] = [];
  for (const multi of multis) {
    const legs = multi.legs.map((id) => picksById.get(id)).filter(Boolean) as PickLeg[];
    const result = gateMulti(multi, legs);
    violations.push(...result.violations);
    cleaned.push(multi);
  }

  return { multis: cleaned, violations };
}