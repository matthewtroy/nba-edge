import type { MetaJson, PickLeg } from "./types.js";
import { legPriceAtBookie } from "./single-bookie.js";
import { FEED_BOOKIES } from "./card-bookie.js";

export function legHasFeedPrice(leg: PickLeg): boolean {
  return FEED_BOOKIES.some((b) => (legPriceAtBookie(leg, b) ?? 0) > 1);
}

export function slateHasFeedOdds(picks: PickLeg[]): boolean {
  return picks.some(legHasFeedPrice);
}

export const PRICES_PENDING_LABEL = "Prices at 9pm";

/** Next slate built from the model before its 9pm odds pull: legs show fair/prob, no bookie. */
export function slateAwaitingPrices(opts: {
  slateDate: string;
  todayDate: string;
  picks: PickLeg[];
  officialSlateDate?: string;
}): boolean {
  if (!opts.slateDate || opts.slateDate === opts.todayDate) return false;
  if (opts.officialSlateDate === opts.slateDate) return false;
  return opts.picks.length > 0 && !slateHasFeedOdds(opts.picks);
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