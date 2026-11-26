import type { PickLeg } from "./types.js";
import { legHasSupportiveReason } from "./picks-supportive-filter.js";
import { AU_BOOKMAKERS } from "./types.js";
import type { CardLegResult } from "./settle-core.js";
import type { GradedProjectionLeg } from "./graded-leg.js";

const Q1_MARKETS = new Set(["q1pts", "q1reb", "q1ast"]);

/** Singles rule: best AU price (ex bet365) at least fair × 1.08. */
export const VALUE_SINGLE_MIN_EDGE = 1.08;
export const VALUE_SINGLE_STAKE_UNITS = 1;

export function bestAuPriceExBet365(
  leg: Pick<PickLeg, "bookiePrices" | "bestBookie" | "bestPrice">
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

/** One Value single frozen at the 9pm publish (1u at the best AU price, ex bet365). */
export interface FrozenValueSingle {
  id: string;
  playerId: string;
  playerName: string;
  gameId: string;
  market: string;
  line: number;
  price: number;
  bookie: string;
  fairPrice: number;
  probability: number;
}

export function isValueSingle(leg: PickLeg): boolean {
  if (Q1_MARKETS.has(leg.market)) return false;
  if (!(leg.fairPrice > 1)) return false;
  const best = bestAuPriceExBet365(leg);
  return best != null && best.price >= leg.fairPrice * VALUE_SINGLE_MIN_EDGE;
}

function singlesSupportiveOk(leg: PickLeg): boolean {
  const hasReasonContext =
    (leg.reasons?.length ?? 0) > 0 ||
    Boolean(leg.reasonLine?.trim()) ||
    (leg.recentTenVsLine?.length ?? 0) > 0 ||
    (leg.lastTenStatValues?.length ?? 0) > 0;
  if (!hasReasonContext) return true;
  return legHasSupportiveReason(leg);
}

/** Value singles from a frozen picks copy; one per player/market/line. */
export function freezeValueSingles(picks: PickLeg[]): FrozenValueSingle[] {
  const seen = new Set<string>();
  const out: FrozenValueSingle[] = [];
  for (const leg of picks) {
    if (!isValueSingle(leg) || !singlesSupportiveOk(leg)) continue;
    const key = `${leg.playerId}:${leg.market}:${leg.line}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const best = bestAuPriceExBet365(leg)!;
    out.push({
      id: leg.id,
      playerId: leg.playerId,
      playerName: leg.playerName,
      gameId: leg.gameId,
      market: leg.market,
      line: leg.line,
      price: best.price,
      bookie: best.bookie,
      fairPrice: leg.fairPrice,
      probability: leg.probability,
    });
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

export function valueLegRowsFromSingles(
  slateDate: string,
  singles: FrozenValueSingle[],
  graded: GradedProjectionLeg[]
): ValueLegRow[] {
  const byId = new Map(graded.map((g) => [g.id, g]));
  const rows: ValueLegRow[] = [];
  for (const s of singles) {
    const g = byId.get(s.id);
    if (!g || g.result === "void" || g.result === "pending") continue;
    rows.push({
      id: s.id,
      slateDate,
      playerName: s.playerName,
      market: s.market,
      line: s.line,
      result: g.result,
      price: s.price,
      bookie: s.bookie,
      fairPrice: s.fairPrice,
      edgeVsFair: s.price / s.fairPrice - 1,
      probability: s.probability,
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
