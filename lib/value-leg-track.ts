import type { PickLeg } from "./types.js";
import { AU_BOOKMAKERS } from "./types.js";
import type { CardLegResult } from "./settle-core.js";
import type { GradedProjectionLeg } from "./graded-leg.js";

const Q1_MARKETS = new Set(["q1pts", "q1reb", "q1ast"]);

export function bestAuPriceExBet365(
  leg: PickLeg
): { price: number; bookie: string } | null {
  let best: { price: number; bookie: string } | null = null;
  const au = new Set<string>(AU_BOOKMAKERS);
  for (const [bookie, price] of Object.entries(leg.bookiePrices ?? {})) {
    if (bookie === "bet365") continue;
    if (!au.has(bookie)) continue;
    if (price > 1 && (!best || price > best.price)) best = { price, bookie };
  }
  if (
    leg.bestBookie &&
    leg.bestBookie !== "bet365" &&
    au.has(leg.bestBookie) &&
    leg.bestPrice != null &&
    leg.bestPrice > 1 &&
    (!best || leg.bestPrice > best.price)
  ) {
    best = { price: leg.bestPrice, bookie: leg.bestBookie };
  }
  return best;
}

/** Value at build freeze: best AU price strictly above fair; one row per player/market/line. */
export function selectValueLegsAtFreeze(picks: PickLeg[]): PickLeg[] {
  const seen = new Set<string>();
  const out: PickLeg[] = [];
  for (const leg of picks) {
    if (Q1_MARKETS.has(leg.market)) continue;
    const best = bestAuPriceExBet365(leg);
    if (!best || best.price <= leg.fairPrice) continue;
    const key = `${leg.playerId}:${leg.market}:${leg.line}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(leg);
  }
  return out;
}

export interface ValueLegRow {
  id: string;
  slateDate: string;
  playerName: string;
  market: string;
  line: number;
  result: CardLegResult;
  price: number;
  bookie: string;
  fairPrice: number;
  edgeVsFair: number;
  probability: number;
}

export function valueLegRowsFromGraded(
  freezePicks: PickLeg[],
  graded: GradedProjectionLeg[]
): ValueLegRow[] {
  const valuePicks = selectValueLegsAtFreeze(freezePicks);
  const byId = new Map(graded.map((g) => [g.id, g]));
  const rows: ValueLegRow[] = [];
  for (const leg of valuePicks) {
    const g = byId.get(leg.id);
    if (!g || g.result === "void") continue;
    const best = bestAuPriceExBet365(leg);
    if (!best) continue;
    rows.push({
      id: leg.id,
      slateDate: g.slateDate,
      playerName: leg.playerName,
      market: leg.market,
      line: leg.line,
      result: g.result,
      price: best.price,
      bookie: best.bookie,
      fairPrice: leg.fairPrice,
      edgeVsFair: best.price / leg.fairPrice - 1,
      probability: leg.probability,
    });
  }
  return rows;
}

export function edgeBand(edge: number): string {
  const pct = edge * 100;
  if (pct < 5) return "0–5%";
  if (pct < 10) return "5–10%";
  if (pct < 15) return "10–15%";
  return "15%+";
}