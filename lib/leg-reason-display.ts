import type { PickLeg } from "./types.js";
import type { LegReason } from "./leg-reason-types.js";
import { ensureLegReasonMinimum } from "./leg-reason-minimum.js";

/** Display-only enrich for frozen slates (never mutates picks.json). */
export function backfillDisplayReasons(
  leg: PickLeg,
  reasons: LegReason[]
): LegReason[] {
  return ensureLegReasonMinimum(leg, reasons);
}