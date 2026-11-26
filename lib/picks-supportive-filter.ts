import type { PickLeg } from "./types.js";
import { ensureLegReasonMinimum } from "./leg-reason-minimum.js";

/** True when display path has ≥1 supportive line (incl. frozen backfill). */
export function legHasSupportiveReason(leg: PickLeg): boolean {
  return ensureLegReasonMinimum(leg, leg.reasons ?? []).length > 0;
}

/** UI + builders: drop legs with zero supportive reasons (Q1 exempt). */
export function filterPicksWithSupportiveReasons(picks: PickLeg[]): PickLeg[] {
  return picks.filter((leg) => leg.market.startsWith("q1") || legHasSupportiveReason(leg));
}