import type { PickLeg } from "./types.js";
import type { OddsCoverageJson } from "./odds-coverage.js";
import { normalizePlayerName, namesMatch } from "./player-names.js";
import { legOddsLookupKey } from "./odds.js";

export interface PricedLegCounts {
  [market: string]: { total: number; priced: number };
}

export function countPricedLegsByMarket(picks: PickLeg[]): PricedLegCounts {
  const out: PricedLegCounts = {};
  for (const p of picks) {
    const row = out[p.market] ?? { total: 0, priced: 0 };
    row.total += 1;
    if (p.bestPrice != null && p.bestPrice > 1) row.priced += 1;
    out[p.market] = row;
  }
  return out;
}

/** Duplicate normalized + display keys so pricing can resolve ESPN names */
export function expandOddsMapForPlayers(
  oddsMap: Map<string, { price: number; bookie: string }>,
  playerNames: string[]
): Map<string, { price: number; bookie: string }> {
  const expanded = new Map(oddsMap);
  for (const [key, val] of oddsMap) {
    const parts = key.split("|");
    if (parts.length < 3) continue;
    const [, market, line] = parts;
    for (const name of playerNames) {
      if (normalizePlayerName(name) === parts[0] || namesMatch(name, parts[0])) {
        expanded.set(`${name}|${market}|${line}`, val);
        expanded.set(legOddsLookupKey(name, market, Number(line)), val);
      }
    }
  }
  return expanded;
}

export function coverageAttachWarnings(
  coverage: OddsCoverageJson,
  counts: PricedLegCounts
): string[] {
  const warnings: string[] = [];
  if (coverage.eventsProbed < 1) return warnings;
  for (const mk of ["pts", "reb", "ast"] as const) {
    const cov = coverage.uniquePlayersByCoreMarket[mk] ?? 0;
    const priced = counts[mk]?.priced ?? 0;
    if (cov > 0 && priced === 0) {
      warnings.push(
        `odds attach: coverage lists ${cov} ${mk} players but 0 priced legs`
      );
    }
  }
  if (coverage.onlyThreesOffered && (counts["3pm"]?.priced ?? 0) > 0) {
    warnings.push("odds attach: only threes in API but core markets missing");
  }
  return warnings;
}

/** Pipeline debug (no secrets): stages for one star player */
export function tracePlayerOddsStages(
  playerName: string,
  stages: {
    extractedKeys: string[];
    pricingMapSize: number;
    pricedLegs: PickLeg[];
  }
): void {
  const norm = normalizePlayerName(playerName);
  const ptsKeys = stages.extractedKeys.filter(
    (k) => k.startsWith(`${norm}|`) && k.includes("|pts|")
  );
  const pricedPts = stages.pricedLegs.filter(
    (l) => namesMatch(l.playerName, playerName) && l.market === "pts" && l.bestPrice
  );
  console.log(
    `odds trace ${playerName}: extract pts keys=${ptsKeys.length} [${ptsKeys.slice(0, 3).join("; ")}] pricingMap=${stages.pricingMapSize} pricedPtsLegs=${pricedPts.length}`
  );
}