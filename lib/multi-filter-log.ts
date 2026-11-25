import type { MultiBet, MultiNotBuilt, MultiType, PickLeg } from "./types.js";
import { qualifiesCrossBoostLeg, qualifiesMainPlayLeg } from "./main-play-eligibility.js";
import { MIN_LEG_FAIR as MULTIS_MIN_FAIR } from "./multis.js";
import { getMultiBuildTraces } from "./multi-build-trace.js";

const TYPE_LABEL: Record<MultiType, string> = {
  mainPlay: "Main Play",
  booster: "Booster",
  q1Multi: "Q1 Multi",
  crossGameSgm: "Cross-Game SGM",
  boostSgm: "Boost SGM",
  longshot: "Longshot",
};

export function countEligibleByType(picks: PickLeg[]): Record<string, number> {
  const q1 = picks.filter(
    (l) =>
      l.market.startsWith("q1") &&
      l.starterEligible &&
      l.fairPrice >= 1.8 &&
      l.fairPrice <= 4
  );
  const crossBoost = picks.filter(qualifiesCrossBoostLeg);
  return {
    mainPlay: picks.filter(qualifiesMainPlayLeg).length,
    crossBoost: crossBoost.length,
    q1Legs: q1.length,
    q1Teams: new Set(q1.map((l) => `${l.gameId}|${l.team}`)).size,
    priced: picks.length,
  };
}

export function logMultiBuildSummary(input: {
  picks: PickLeg[];
  pool: PickLeg[];
  built: MultiBet[];
  notBuilt: MultiNotBuilt[];
}): void {
  const counts = countEligibleByType(input.picks);
  console.log(
    `multis filter: picks=${input.picks.length} pool=${input.pool.length} (fair≥${MULTIS_MIN_FAIR}) · main-eligible=${counts.mainPlay} crossBoost=${counts.crossBoost} q1Teams=${counts.q1Teams}`
  );
  for (const t of getMultiBuildTraces()) {
    const stage = `eligible=${t.eligible} edge-pool=${t.bestBookie ?? "?"}:${t.bestEdgePool} clash-skipped=${t.clashCandidates} range-cands=${t.rangeCandidates}`;
    console.log(
      `multis filter [${t.type}${t.variant ? `:${t.variant}` : ""}] stages: ${stage}`
    );
    console.log(
      `multis filter [${t.type}${t.variant ? `:${t.variant}` : ""}]: ${t.built ? "built" : "not built"} — ${t.detail}`
    );
  }
  for (const n of input.notBuilt) {
    const key = `${n.type}${n.variant ? `:${n.variant}` : ""}`;
    if (getMultiBuildTraces().some((t) => `${t.type}${t.variant ? `:${t.variant}` : ""}` === key)) {
      continue;
    }
    const label = n.variant ? `${TYPE_LABEL[n.type]} (${n.variant})` : TYPE_LABEL[n.type];
    console.log(`multis filter [${key}]: not built — ${n.reason}`);
  }
  for (const b of input.built) {
    const key = `${b.type}${b.variant ? `:${b.variant}` : ""}`;
    if (getMultiBuildTraces().some((t) => `${t.type}${t.variant ? `:${t.variant}` : ""}` === key && t.built)) {
      continue;
    }
    const total =
      b.bestBookieTotal != null && b.bestBookie
        ? `$${b.bestBookieTotal.toFixed(2)} @ ${b.bestBookie}`
        : "fair/take-at";
    console.log(`multis filter [${key}]: built — ${b.legs.length} legs · ${total}`);
  }
}