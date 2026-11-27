import type { PickLeg } from "./types.js";
import { FEED_BOOKIES } from "./card-bookie.js";
import {
  combinedPriceForBookieWithCatalog,
  legPriceAtBookieWithCatalog,
} from "./single-bookie.js";
import { multiBookieTotals } from "./bookie-totals.js";
import {
  bookieHighProbMeetsFair,
  bookiePriceMeetsMinEdge,
} from "./pricing-config.js";
import { edgeFairPrice } from "./leg-edge-fair.js";

export type BestEdgeMultiOpts = {
  buildBookie?: string;
  catalog?: PickLeg[];
  bookies?: readonly string[];
  /** Every leg must pass this at the candidate bookie (default: book edge rules). */
  legQualifies?: (leg: PickLeg, bookie: string) => boolean;
};

export function legMeetsBookieEdgeWithCatalog(
  leg: PickLeg,
  bookie: string,
  catalog: PickLeg[]
): boolean {
  const price = legPriceAtBookieWithCatalog(leg, bookie, catalog);
  if (price == null || price <= 1) return false;
  const fair = edgeFairPrice(leg);
  if (bookiePriceMeetsMinEdge(price, fair)) return true;
  return bookieHighProbMeetsFair(price, fair, leg.probability);
}

/** After legs are fixed: highest total at one AU bookie where every leg is priced and passes edge rules; tie → build bookie. */
export function bestEdgeMultiQuote(
  legs: PickLeg[],
  opts?: BestEdgeMultiOpts
): { bookie: string; total: number } | undefined {
  if (!legs.length) return undefined;
  const pool = opts?.catalog ?? legs;
  const bookies = opts?.bookies ?? FEED_BOOKIES;
  const qualifies =
    opts?.legQualifies ??
    ((leg, bookie) => legMeetsBookieEdgeWithCatalog(leg, bookie, pool));

  let maxTotal = -1;
  const atMax: { bookie: string; total: number }[] = [];

  for (const bookie of bookies) {
    const total = combinedPriceForBookieWithCatalog(legs, bookie, pool);
    if (total == null) continue;
    if (!legs.every((leg) => qualifies(leg, bookie))) continue;
    if (total > maxTotal + 1e-9) {
      maxTotal = total;
      atMax.length = 0;
      atMax.push({ bookie, total });
    } else if (Math.abs(total - maxTotal) < 1e-9) {
      atMax.push({ bookie, total });
    }
  }

  if (!atMax.length) return undefined;
  if (opts?.buildBookie) {
    const tie = atMax.find((r) => r.bookie === opts.buildBookie);
    if (tie) return tie;
  }
  return atMax[0];
}

export function bookieTotalsForLegs(legs: PickLeg[]): Record<string, number> {
  return multiBookieTotals(legs) as Record<string, number>;
}