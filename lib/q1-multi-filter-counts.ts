import type { PickLeg, PlayerGameLog } from "./types.js";
import { legHasSupportiveReason } from "./picks-supportive-filter.js";
import { passesQ1MultiHitGap } from "./q1-multi-probability.js";
import { MIN_LEG_FAIR } from "./multis.js";

export interface Q1MultiFilterCounts {
  q1Market: number;
  starter: number;
  min24: number;
  supportive: number;
  hitGap: number;
  fairMin: number;
  onePerGame: number;
}

export function countQ1MultiFilters(
  picks: PickLeg[],
  minFair = MIN_LEG_FAIR
): Q1MultiFilterCounts {
  const q1Market = picks.filter((l) => l.market.startsWith("q1"));
  const starter = q1Market.filter((l) => l.starterEligible === true);
  const min24 = starter.filter((l) => (l.projectedMinutes ?? 0) >= 24);
  const supportive = min24.filter((l) => legHasSupportiveReason(l));
  const hitGap = supportive.filter((l) => passesQ1MultiHitGap(l));
  const fairMin = hitGap.filter((l) => l.fairPrice >= minFair);
  return {
    q1Market: q1Market.length,
    starter: starter.length,
    min24: min24.length,
    supportive: supportive.length,
    hitGap: hitGap.length,
    fairMin: fairMin.length,
    onePerGame: new Set(fairMin.map((l) => l.gameId)).size,
  };
}

export function formatQ1MultiFilterCounts(c: Q1MultiFilterCounts): string {
  return `q1 q1=${c.q1Market} starter=${c.starter} min24=${c.min24} supportive=${c.supportive} hitGap=${c.hitGap} fair≥${MIN_LEG_FAIR}=${c.fairMin} games=${c.onePerGame}`;
}