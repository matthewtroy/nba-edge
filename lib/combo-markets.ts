import type { Market } from "./types.js";
import { positionBucket as bucketPosition } from "./position-bucket.js";

export const STAT_COMBO_MARKETS = ["ptsreb", "ptsast", "rebast", "pra"] as const;
export type StatComboMarket = (typeof STAT_COMBO_MARKETS)[number];

export const MILESTONE_COMBO_MARKETS: Market[] = ["dd", "td", "combo"];

export const ALL_COMBO_PICK_MARKETS: readonly Market[] = [
  ...STAT_COMBO_MARKETS,
  ...MILESTONE_COMBO_MARKETS,
];

export function isComboPickMarket(m: string): boolean {
  return (ALL_COMBO_PICK_MARKETS as readonly string[]).includes(m);
}

export function isStatComboMarket(m: string): m is StatComboMarket {
  return (STAT_COMBO_MARKETS as readonly string[]).includes(m);
}

export function comboContainedStats(m: string): ("pts" | "reb" | "ast")[] {
  switch (m) {
    case "ptsreb":
      return ["pts", "reb"];
    case "ptsast":
      return ["pts", "ast"];
    case "rebast":
      return ["reb", "ast"];
    case "pra":
      return ["pts", "reb", "ast"];
    case "combo":
      return ["reb", "ast"];
    default:
      return [];
  }
}

export function singleMarketTouchesStat(m: string, stat: "pts" | "reb" | "ast"): boolean {
  if (m === stat) return true;
  if (m === "q1pts" && stat === "pts") return true;
  if (m === "q1reb" && stat === "reb") return true;
  if (m === "q1ast" && stat === "ast") return true;
  return comboContainedStats(m).includes(stat);
}

export function positionBucketLabel(bucket: "G" | "F" | "C"): string {
  if (bucket === "C") return "centers";
  if (bucket === "F") return "forwards";
  return "guards";
}

export function positionLabelFromEspn(position?: string): string {
  return positionBucketLabel(bucketPosition(position));
}