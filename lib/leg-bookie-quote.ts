import type { PickLeg } from "./types.js";
import {
  nearestPricedRung,
  type NearestBookieOpts,
  type NearestBookieQuote,
} from "./nearest-bookie-line.js";

export interface LegBookieQuoteView {
  modelLeg: PickLeg;
  bookie: string;
  quote?: NearestBookieQuote;
  offered: boolean;
  displayPrice?: number;
  lineShift?: string;
}

/** Reprice at bookie for the selected line (exact or nearest priced rung). */
export function legBookieQuoteView(
  leg: PickLeg,
  bookie: string,
  catalog: PickLeg[],
  opts?: NearestBookieOpts
): LegBookieQuoteView {
  const quote = nearestPricedRung(leg, bookie, catalog, opts);
  return {
    modelLeg: quote?.leg ?? leg,
    bookie,
    quote,
    offered: quote != null,
    displayPrice: quote?.price,
    lineShift: quote?.lineShift,
  };
}