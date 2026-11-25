import type { Market, PickLeg, PlayerGameLog } from "./types.js";
import { injuryReasonForMarket } from "./injury-reason.js";
import type { DefenseRatingsBundle } from "./defense-ratings.js";
import {
  buildLegReasonLine,
  buildLegReasons,
} from "./leg-reason-builder.js";
import type { PlayerTrackingDay } from "./player-tracking-cache.js";
import { normalizeLegReasons, reasonTexts } from "./leg-reason-types.js";

/** Tags shown on leg rows / sheets (model-only tags stay internal). */
export function visibleLegTags(tags: string[]): string[] {
  return tags.filter((t) => t !== "boards shared");
}

export function visibleLegReasons(reasons: PickLeg["reasons"]): string[] {
  return reasonTexts(normalizeLegReasons(reasons)).filter(
    (r) => r.toLowerCase() !== "boards shared" && !/voids if out/i.test(r)
  );
}

export { buildLegReasonLine, buildLegReasons };

export function mainPlayReasonOk(leg: PickLeg): boolean {
  const line = (leg.reasonLine ?? "").trim();
  return line.length > 0;
}

/** @deprecated use buildLegReasonLine */
export function buildShortLegReason(leg: PickLeg, logs: PlayerGameLog[]): string | undefined {
  return buildLegReasonLine({
    leg,
    logs,
    seedReasons: normalizeLegReasons(leg.reasons ?? []),
  });
}

export function countLegsWithInjuryReason(picks: PickLeg[]): number {
  return picks.filter((l) => injuryReasonForMarket(l.reasons, l.market) != null).length;
}

/** Re-export for legacy imports expecting matchup helpers via buildLegReasonLine input. */
export type BuildLegReasonInput = {
  leg: PickLeg;
  logs: PlayerGameLog[];
  defense?: DefenseRatingsBundle;
  defendingTeamId?: string;
  playerTeamId?: string;
  playerPosition?: string;
  teamName?: string;
  opponentName?: string;
  tracking?: PlayerTrackingDay;
};