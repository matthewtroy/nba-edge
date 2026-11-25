import type { PickLeg } from "./types.js";
import { legPriceAtBookie } from "./single-bookie.js";

/** Multi fair bands (Main Play, Cross, etc.) use bookie decimal when priced at that bookie. */
export function legBookiePriceInBand(
  leg: PickLeg,
  bookie: string | undefined,
  min: number,
  max: number
): boolean {
  if (bookie) {
    const p = legPriceAtBookie(leg, bookie);
    if (p != null) return p >= min && p <= max;
  }
  return leg.fairPrice >= min && leg.fairPrice <= max;
}