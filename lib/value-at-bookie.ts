import type { PickLeg } from "./types.js";
import { legPriceAtBookie } from "./single-bookie.js";
import {
  LEG_ROW_BADGE_WHITELIST,
  sortLegRowBadgeTags,
  visibleLegTags,
} from "./leg-display.js";
import { passesFormGuard } from "./form-guard.js";
import { edgeFairTakeAt } from "./leg-edge-fair.js";

export function hasValueAtBookie(leg: PickLeg, bookie: string): boolean {
  if (!passesFormGuard(leg)) return false;
  const p = legPriceAtBookie(leg, bookie);
  return p != null && p >= edgeFairTakeAt(leg);
}

/** Value chip only when the card's bookie meets take-at (not another book's best). */
export function displayLegRowTags(leg: PickLeg, bookie?: string): string[] {
  return displayTagsForBookie(leg, bookie).filter((t) => t !== "Check prices");
}

/** Whitelisted badge pills for leg rows — never raw internal tags. */
export function legRowBadgeLabels(
  leg: PickLeg,
  bookie?: string,
  extra: string[] = []
): string[] {
  const labels: string[] = [];
  if (leg.tags?.includes("former_team")) labels.push("Former team");
  labels.push(
    ...visibleLegTags(leg.tags ?? []).filter((t) => LEG_ROW_BADGE_WHITELIST.has(t))
  );
  if (leg.blowoutRisk && !labels.includes("Blowout risk")) {
    labels.push("Blowout risk");
  }
  if (bookie) {
    labels.push(
      ...displayLegRowTags(leg, bookie).filter((t) => LEG_ROW_BADGE_WHITELIST.has(t))
    );
  }
  labels.push(...extra.filter((t) => LEG_ROW_BADGE_WHITELIST.has(t)));
  const seen = new Set<string>();
  const deduped: string[] = [];
  for (const label of labels) {
    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(label);
  }
  return sortLegRowBadgeTags(deduped);
}

export function displayTagsForBookie(leg: PickLeg, bookie?: string): string[] {
  const base = visibleLegTags(leg.tags).filter((t) => t !== "Value" && t !== "Check prices");
  if (leg.blowoutRisk) base.push("Blowout risk");
  if (bookie) {
    const p = legPriceAtBookie(leg, bookie);
    if (p != null && p > leg.fairPrice * 1.6) base.push("Check prices");
    if (hasValueAtBookie(leg, bookie)) base.push("Value");
  }
  return base;
}