import fs from "fs";
import path from "path";
import { settleMultiLegs, type CardLegResult } from "./settle-core.js";
import type { MultiType } from "./types.js";
import { BET_LABELS, profitUnitsForBet, type OfficialBetRow } from "./official-bet-settle.js";
import { officialStakeUnits } from "./pricing-config.js";

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
}

export interface ExtraOfficialBetsFile {
  slates?: Record<string, { extraBets?: ExtraOfficialBet[] }>;
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

export function extraOfficialBetRows(
  slateDate: string,
  legResults: Map<string, CardLegResult>,
  file: ExtraOfficialBetsFile
): OfficialBetRow[] {
  const extras = file.slates?.[slateDate]?.extraBets ?? [];
  return extras.map((bet) => {
    const combined = boostedPrice(bet.price, bet.boostPct);
    const result = settleMultiLegs(bet.legIds.map((id) => legResults.get(id) ?? "pending"));
    const stake = bet.stakeUnits ?? officialStakeUnits(bet.betType, combined);
    return {
      slateDate,
      betType: bet.betType,
      label: bet.label ?? BET_LABELS[bet.betType],
      bookie: bet.bookie,
      legIds: bet.legIds,
      result,
      profitUnits: profitUnitsForBet(result, stake, combined),
      stakeUnits: result === "pending" ? 0 : stake,
      publishedCombinedPrice: combined,
    };
  });
}
