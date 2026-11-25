import type { PickLeg } from "./types.js";
import { legPriceAtBookie } from "./single-bookie.js";
import { visibleLegTags } from "./leg-display.js";
import { passesFormGuard } from "./form-guard.js";

export function hasValueAtBookie(leg: PickLeg, bookie: string): boolean {
  if (!passesFormGuard(leg)) return false;
  const p = legPriceAtBookie(leg, bookie);
  return p != null && p >= leg.takeAt;
}

/** Value chip only when the card's bookie meets take-at (not another book's best). */
export function displayTagsForBookie(leg: PickLeg, bookie?: string): string[] {
  const base = visibleLegTags(leg.tags).filter((t) => t !== "Value" && t !== "Check prices");
  if (bookie) {
    const p = legPriceAtBookie(leg, bookie);
    if (p != null && p > leg.fairPrice * 1.6) base.push("Check prices");
    if (hasValueAtBookie(leg, bookie)) base.push("Value");
  }
  return base;
}