import type { MultiBet, MultiType } from "./types.js";
import type { OfficialCardFile, OfficialLegSnapshot } from "./official-card-time.js";
import {
  settleMultiLegs,
  type CardBetResult,
  type CardLegResult,
  type SettledLegRow,
} from "./settle-core.js";
import { legPriceAtBookie } from "./single-bookie.js";
import { pickLegFromSnapshot } from "./official-leg-snapshot.js";

export const BET_LABELS: Record<MultiType, string> = {
  mainPlay: "Main Play",
  booster: "Booster",
  q1Multi: "Q1 Multi",
  crossGameSgm: "Best Double Up",
  boostSgm: "Boost SGM",
  longshot: "Longshot",
};

export interface OfficialBetRow {
  slateDate: string;
  betType: MultiType;
  label: string;
  variant?: string;
  legIds: string[];
  result: CardBetResult;
  /** null when Q1 (or similar) has no published combined price — W-L only */
  profitUnits: number | null;
  stakeUnits: number;
  publishedCombinedPrice?: number;
}

function publishedLegPrice(snap: OfficialLegSnapshot): number | undefined {
  if (snap.publishedPrice != null && snap.publishedPrice > 1) return snap.publishedPrice;
  const leg = pickLegFromSnapshot(snap);
  const bookie = snap.publishedBookie;
  if (!bookie) return undefined;
  return legPriceAtBookie(leg, bookie);
}

function combinedPublishedPrice(
  multi: MultiBet,
  card: OfficialCardFile,
  legResults: Map<string, CardLegResult>
): number | undefined {
  const fromTotal = multi.bestBookieTotal ?? multi.combinedBestPrice;
  if (fromTotal != null && fromTotal > 1) return fromTotal;

  const snaps = card.legSnapshots ?? {};
  let product = 1;
  let used = 0;
  for (const id of multi.legs) {
    const snap = snaps[id];
    if (!snap) continue;
    const res = legResults.get(id) ?? "pending";
    if (res === "void" || res === "pending") continue;
    const price = publishedLegPrice(snap);
    if (price == null || price <= 1) return undefined;
    product *= price;
    used += 1;
  }
  return used > 0 ? product : undefined;
}

export function profitUnitsForBet(
  result: CardBetResult,
  stake: number,
  combinedPrice: number | undefined
): number | null {
  if (result === "pending") return null;
  if (result === "void") return 0;
  if (result === "lost") return -stake;
  if (result === "won") {
    if (combinedPrice == null || combinedPrice <= 1) return null;
    return stake * (combinedPrice - 1);
  }
  return null;
}

export function settleOfficialBets(
  card: OfficialCardFile,
  settledLegs: SettledLegRow[]
): OfficialBetRow[] {
  const legResults = new Map<string, CardLegResult>();
  for (const leg of settledLegs) {
    legResults.set(leg.id, leg.result);
  }
  const stake = 1;
  const rows: OfficialBetRow[] = [];

  for (const multi of card.multis) {
    const legRes = multi.legs.map((id) => legResults.get(id) ?? "pending");
    const result = settleMultiLegs(legRes);
    const combined = combinedPublishedPrice(multi, card, legResults);
    const trackUnits =
      result !== "pending" && !(multi.type === "q1Multi" && combined == null);
    const profit = trackUnits ? profitUnitsForBet(result, stake, combined) : null;

    rows.push({
      slateDate: card.slateDate,
      betType: multi.type,
      label: multi.label,
      variant: multi.variant,
      legIds: multi.legs,
      result,
      profitUnits: profit,
      stakeUnits: trackUnits ? stake : 0,
      publishedCombinedPrice: combined,
    });
  }
  return rows;
}