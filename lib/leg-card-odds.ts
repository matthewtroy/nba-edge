import type { PickLeg } from "./types.js";
import { legPriceAtBookie } from "./single-bookie.js";
import { marketLabel } from "./market-label.js";

export function legPriceAtCardBookie(
  leg: PickLeg,
  cardBookie: string
): number | undefined {
  const p = legPriceAtBookie(leg, cardBookie);
  return p != null && p > 1 ? p : undefined;
}

/** Plain-text leg line for Today/Games cards (no take-at, no best). */
export function formatLegCardLine(leg: PickLeg, cardBookie: string): string {
  const label = `${leg.playerName} ${marketLabel(leg.market, leg.line)}`;
  const price = legPriceAtCardBookie(leg, cardBookie);
  if (price == null) return `  ${label}`;
  return `  ${label} · $${price.toFixed(2)} · ${cardBookie} · Fair $${leg.fairPrice.toFixed(2)}`;
}