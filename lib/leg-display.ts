import type { Market, PickLeg, PlayerGameLog } from "./types.js";
import { injuryReasonForMarket } from "./injury-reason.js";
import type { DefenseRatingsBundle } from "./defense-ratings.js";
import {
  buildLegReasonLine,
  buildLegReasons,
} from "./leg-reason-builder.js";
import type { PlayerTrackingDay } from "./player-tracking-cache.js";
import { normalizeLegReasons, reasonTexts } from "./leg-reason-types.js";

const INTERNAL_LEG_TAGS = new Set([
  "boards shared",
  "Check news",
  "voids if out",
  "former_team",
]);

/** Tags shown on leg rows / sheets (model-only tags stay internal). */
export function visibleLegTags(tags: string[]): string[] {
  return tags.filter((t) => !INTERNAL_LEG_TAGS.has(t));
}

export const LEG_ROW_BADGE_WHITELIST = new Set([
  "Value",
  "High probability",
  "Former team",
  "Roughie",
  "Blowout risk",
  "Edited",
]);

const LEG_ROW_BADGE_ORDER = [
  "Value",
  "High probability",
  "Former team",
  "Roughie",
  "Blowout risk",
  "Edited",
] as const;

/** Badge order after injury: Value → High prob → Former team → Roughie → rest. */
export function sortLegRowBadgeTags(labels: string[]): string[] {
  const rank = (t: string) => {
    const i = LEG_ROW_BADGE_ORDER.indexOf(t as (typeof LEG_ROW_BADGE_ORDER)[number]);
    return i >= 0 ? i : LEG_ROW_BADGE_ORDER.length;
  };
  return [...labels].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
}

export function visibleLegReasons(reasons: PickLeg["reasons"]): string[] {
  return reasonTexts(normalizeLegReasons(reasons)).filter(
    (r) => r.toLowerCase() !== "boards shared" && !/voids if out/i.test(r)
  );
}

export { buildLegReasonLine, buildLegReasons };

export function mainPlayReasonBeyondRankAvg(leg: PickLeg): boolean {
  const reasons = normalizeLegReasons(leg.reasons ?? []);
  if (reasons.length) {
    return reasons.some((r) => r.type !== "rank" && r.type !== "avg");
  }
  const line = (leg.reasonLine ?? "").trim();
  if (!line) return false;
  const lower = line.toLowerCase();
  if (/^averages?\b/i.test(line) && !line.includes("·")) return false;
  if (lower.includes("averages") && !/[·/]|\d+\/\d+/.test(line)) return false;
  return line.length > 0;
}

/** @deprecated use mainPlayReasonBeyondRankAvg */
export function mainPlayReasonOk(leg: PickLeg): boolean {
  return mainPlayReasonBeyondRankAvg(leg);
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