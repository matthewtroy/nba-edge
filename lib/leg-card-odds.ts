import type { PickLeg } from "./types.js";
import {
  legPriceAtBookieWithCatalog,
  type BookiePriceOpts,
} from "./single-bookie.js";
import { bookieMarketLabel } from "./market-label.js";

export function legPriceAtCardBookie(
  leg: PickLeg,
  cardBookie: string,
  catalog?: PickLeg[],
  opts?: BookiePriceOpts
): number | undefined {
  if (
    cardBookie &&
    leg.bestBookie === cardBookie &&
    leg.bestPrice != null &&
    leg.bestPrice > 1 &&
    opts?.allowNearest !== false
  ) {
    return leg.bestPrice;
  }
  const p = legPriceAtBookieWithCatalog(leg, cardBookie, catalog ?? [leg], opts);
  return p != null && p > 1 ? p : undefined;
}

/** Plain-text leg line for Today/Games cards (no take-at, no best). */
export function formatLegCardLine(leg: PickLeg, cardBookie: string): string {
  const label = `${leg.playerName} ${bookieMarketLabel(leg.market, leg.line)}`;
  const price = legPriceAtCardBookie(leg, cardBookie);
  if (price == null) return `  ${label}`;
  return `  ${label} · $${price.toFixed(2)} · ${cardBookie} · Fair $${leg.fairPrice.toFixed(2)}`;
}