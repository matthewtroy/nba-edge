import fs from "fs";
import path from "path";
import {
  settleMultiLegs,
  voidAdjustedPrice,
  type CardLegResult,
} from "./settle-core.js";
import { gradeLegFromBox } from "./grading.js";
import { finalPlayerBox } from "./settle-core.js";
import type { BoxLine } from "../scripts/espn-parse.js";
import type { MultiType } from "./types.js";
import { BET_LABELS, profitUnitsForBet, type OfficialBetRow } from "./official-bet-settle.js";
import { officialStakeUnits } from "./pricing-config.js";
import { pickLegForBetId } from "./manual-leg-resolve.js";
import type { PickLeg } from "./types.js";
import type { GamesSgmBetRow } from "./games-sgm-freeze.js";

/** An official bet placed alongside the published card (e.g. a boosted bet365 SGM). */
export interface ExtraOfficialBet {
  betType: MultiType;
  /** Defaults to the bet type's standard label (Best SGM, Main Play, …). */
  label?: string;
  bookie: string;
  legIds: string[];
  /** Bookie price before any boost. */
  price: number;
  /** Profit boost percent applied to (price − 1). */
  boostPct?: number;
  /** Defaults to the stake band for the boosted price. */
  stakeUnits?: number;
  /** Per-leg decimal for void/DNP repricing when combined price is known. */
  legPrices?: Record<string, number>;
}

export interface ExtraGamesSgmBet {
  game: string;
  gameId?: string;
  bookie: string;
  price: number;
  legIds: string[];
  stakeUnits?: number;
  legPrices?: Record<string, number>;
}

export interface ExtraOfficialBetsFile {
  slates?: Record<
    string,
    { extraBets?: ExtraOfficialBet[]; extraGamesSgms?: ExtraGamesSgmBet[] }
  >;
}

export const EXTRA_OFFICIAL_BETS_PATH = "config/manual-official-bets.json";

export function loadExtraOfficialBets(rootDir: string): ExtraOfficialBetsFile {
  const p = path.join(rootDir, EXTRA_OFFICIAL_BETS_PATH);
  if (!fs.existsSync(p)) return {};
  try {
    return JSON.parse(fs.readFileSync(p, "utf8")) as ExtraOfficialBetsFile;
  } catch {
    return {};
  }
}

export function boostedPrice(price: number, boostPct = 0): number {
  return Math.round((1 + (price - 1) * (1 + boostPct / 100)) * 10000) / 10000;
}

function legResultFromBox(leg: PickLeg, box: BoxLine | undefined): CardLegResult {
  if (!box) return "pending";
  const graded = gradeLegFromBox(leg, box);
  if (graded === "void") return "void";
  if (graded === "hit") return "won";
  return "lost";
}

export function gradeExtraBetLegs(
  legIds: string[],
  picks: PickLeg[],
  boxesByGame: Map<string, Map<string, BoxLine>>,
  errors: string[]
): Map<string, CardLegResult> {
  const out = new Map<string, CardLegResult>();
  for (const id of legIds) {
    const leg = pickLegForBetId(id, picks);
    if (!leg) {
      errors.push(`extra bet leg: unresolved id ${id}`);
      out.set(id, "pending");
      continue;
    }
    const box = finalPlayerBox(boxesByGame, leg.gameId, leg.playerId);
    out.set(id, legResultFromBox(leg, box));
  }
  return out;
}

export function officialBetSignature(b: {
  betType: string;
  bookie?: string;
  legIds: string[];
}): string {
  return `${b.betType}|${b.bookie ?? ""}|${[...b.legIds].sort().join(",")}`;
}

export function dedupeExtraOfficialBets(
  published: OfficialBetRow[],
  extras: OfficialBetRow[]
): OfficialBetRow[] {
  const seen = new Set(published.map(officialBetSignature));
  return extras.filter((e) => !seen.has(officialBetSignature(e)));
}

export function extraOfficialBetRows(
  slateDate: string,
  legResults: Map<string, CardLegResult>,
  file: ExtraOfficialBetsFile,
  publishedRows: OfficialBetRow[] = []
): OfficialBetRow[] {
  const extras = file.slates?.[slateDate]?.extraBets ?? [];
  const rows = extras.map((bet) => {
    const combined = boostedPrice(bet.price, bet.boostPct);
    const result = settleMultiLegs(bet.legIds.map((id) => legResults.get(id) ?? "pending"));
    const stake = bet.stakeUnits ?? officialStakeUnits(bet.betType, combined);
    const legPrice = (id: string) => bet.legPrices?.[id];
    const hasVoid = bet.legIds.some((id) => legResults.get(id) === "void");
    const settled =
      hasVoid && combined != null
        ? voidAdjustedPrice(combined, bet.legIds, legResults, legPrice)
        : combined;
    const trackUnits = result !== "pending" && stake > 0;
    return {
      slateDate,
      betType: bet.betType,
      label: bet.label ?? BET_LABELS[bet.betType],
      bookie: bet.bookie,
      legIds: bet.legIds,
      result,
      profitUnits: trackUnits ? profitUnitsForBet(result, stake, settled ?? combined) : null,
      stakeUnits: result === "pending" ? 0 : stake,
      publishedCombinedPrice: combined,
    } satisfies OfficialBetRow;
  });
  return dedupeExtraOfficialBets(publishedRows, rows);
}

export function extraGamesSgmRows(
  slateDate: string,
  legResults: Map<string, CardLegResult>,
  file: ExtraOfficialBetsFile
): GamesSgmBetRow[] {
  const extras = file.slates?.[slateDate]?.extraGamesSgms ?? [];
  return extras.map((bet) => {
    const result = settleMultiLegs(bet.legIds.map((id) => legResults.get(id) ?? "pending"));
    const stake = bet.stakeUnits ?? officialStakeUnits("gamesSgm", bet.price);
    const hasVoid = bet.legIds.some((id) => legResults.get(id) === "void");
    const price = hasVoid
      ? voidAdjustedPrice(bet.price, bet.legIds, legResults, (id) => bet.legPrices?.[id])
      : bet.price;
    return {
      slateDate,
      gameId: bet.gameId ?? "",
      game: bet.game,
      filter: String(bet.price),
      bookie: bet.bookie,
      legIds: bet.legIds,
      result,
      profitUnits: profitUnitsForBet(result, stake, price ?? bet.price),
      stakeUnits: result === "pending" ? 0 : stake,
      publishedCombinedPrice: bet.price,
      ...(price != null && price !== bet.price ? { settledPrice: price } : {}),
    };
  });
}

export function describeExtraLegResults(
  legIds: string[],
  legResults: Map<string, CardLegResult>,
  picks: PickLeg[]
): string[] {
  return legIds.map((id) => {
    const leg = pickLegForBetId(id, picks);
    const res = legResults.get(id) ?? "pending";
    if (!leg) return `${id} · ${res}`;
    const m = leg.market === "3pm" ? "3pm" : leg.market;
    return `${leg.playerName} ${leg.line}+ ${m} · ${res}`;
  });
}