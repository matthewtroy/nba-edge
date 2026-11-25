import type { SlateGame } from "./types.js";

export function slateFirstTipStarted(slate: SlateGame[], now: Date): boolean {
  for (const g of slate) {
    const status = g.status.toLowerCase();
    if (
      status.includes("final") ||
      status.includes("progress") ||
      status.includes("in_progress") ||
      status.includes("halftime")
    ) {
      return true;
    }
    const tip = Date.parse(g.startTime);
    if (Number.isFinite(tip) && tip <= now.getTime()) return true;
  }
  return false;
}