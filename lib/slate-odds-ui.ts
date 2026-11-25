import type { MetaJson, PickLeg } from "./types.js";
import { legPriceAtBookie } from "./single-bookie.js";
import { FEED_BOOKIES } from "./card-bookie.js";

export function legHasFeedPrice(leg: PickLeg): boolean {
  return FEED_BOOKIES.some((b) => (legPriceAtBookie(leg, b) ?? 0) > 1);
}

export function slateHasFeedOdds(picks: PickLeg[]): boolean {
  return picks.some(legHasFeedPrice);
}

/** Shown on draft slates before evening odds land (e.g. Tomorrow pre-9pm). */
export function slateOddsAvailabilityNote(
  meta: MetaJson,
  picks: PickLeg[]
): string | undefined {
  if (slateHasFeedOdds(picks)) return undefined;
  if (meta.slatePublicationStatus === "draft" || !meta.slatePublicationStatus) {
    return "Prices from 9pm";
  }
  return "Fair model only — no bookmaker feed yet";
}