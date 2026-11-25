import type { PickLeg } from "./types.js";
import { FEED_BOOKIES } from "./card-bookie.js";
import {
  combinedPriceForBookieWithCatalog,
  legsMissingAtBookie,
  type BookiePriceOpts,
} from "./single-bookie.js";

export interface FeedBookieOption {
  bookie: string;
  total?: number;
  missing: number;
  complete: boolean;
}

/** All feed bookies for multi switcher — full-price first, then highest total. */
export function feedBookieOptionsForMulti(
  legs: PickLeg[],
  catalog: PickLeg[],
  opts?: BookiePriceOpts
): FeedBookieOption[] {
  const rows: FeedBookieOption[] = FEED_BOOKIES.map((bookie) => {
    const missing = legsMissingAtBookie(legs, bookie, catalog, opts);
    const total = combinedPriceForBookieWithCatalog(legs, bookie, catalog, opts);
  return {
      bookie,
      total,
      missing,
      complete: missing === 0 && total != null,
    };
  });
  rows.sort((a, b) => {
    if (a.complete !== b.complete) return a.complete ? -1 : 1;
    const ta = a.total ?? 0;
    const tb = b.total ?? 0;
    return tb - ta;
  });
  return rows;
}

export function formatFeedBookieOptionLabel(row: FeedBookieOption): string {
  if (row.complete && row.total != null) {
    return `${row.bookie} · $${row.total.toFixed(2)}`;
  }
  if (row.missing > 0) {
    return `${row.bookie} · missing ${row.missing}`;
  }
  return row.bookie;
}