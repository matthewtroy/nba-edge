import fs from "fs";
import path from "path";
import { settleMultiLegs, type CardBetResult, type CardLegResult } from "./settle-core.js";
import type { MultiBet, MultiType } from "./types.js";
import type { OfficialBetRow } from "./official-bet-settle.js";
import { profitUnitsForBet } from "./official-bet-settle.js";

export interface ManualOfficialBet {
  bestBookie?: string;
  bestBookieTotal?: number;
  legs?: string[];
  label?: string;
}

/** Extra official bet rows not on the published card (e.g. manually placed). */
export interface ManualResultsBet {
  betType: MultiType;
  label: string;
  variant?: string;
  legIds: string[];
  stakeUnits: number;
  publishedCombinedPrice: number;
  /** Settle result when not inferring from legs (optional). */
  result?: CardBetResult;
}

export interface ManualOfficialSlate extends Partial<Record<MultiType, ManualOfficialBet>> {
  manualBets?: ManualResultsBet[];
}

export interface ManualOfficialBetsFile {
  slates?: Record<string, ManualOfficialSlate>;
}

const CONFIG_REL = "config/manual-official-bets.json";

export function loadManualOfficialBets(rootDir: string): ManualOfficialBetsFile {
  const p = path.join(rootDir, CONFIG_REL);
  if (!fs.existsSync(p)) return {};
  try {
    return JSON.parse(fs.readFileSync(p, "utf8")) as ManualOfficialBetsFile;
  } catch {
    return {};
  }
}

export function applyManualOfficialBets(
  slateDate: string,
  multis: MultiBet[],
  rootDir?: string
): MultiBet[] {
  const file = loadManualOfficialBets(rootDir ?? process.cwd());
  const overrides = file.slates?.[slateDate];
  if (!overrides) return multis;
  return multis.map((m) => {
    const o = overrides[m.type] as ManualOfficialBet | undefined;
    if (!o) return m;
    return {
      ...m,
      ...(o.label ? { label: o.label } : {}),
      ...(o.legs ? { legs: o.legs } : {}),
      ...(o.bestBookie ? { bestBookie: o.bestBookie } : {}),
      ...(o.bestBookieTotal != null ? { bestBookieTotal: o.bestBookieTotal } : {}),
    };
  });
}

export function manualOfficialBetRows(
  slateDate: string,
  legResults: Map<string, CardLegResult>,
  rootDir?: string
): OfficialBetRow[] {
  const file = loadManualOfficialBets(rootDir ?? process.cwd());
  const slate = file.slates?.[slateDate];
  const extras = slate?.manualBets ?? [];
  const rows: OfficialBetRow[] = [];
  for (const bet of extras) {
    const legRes = bet.legIds.map((id) => legResults.get(id) ?? "pending");
    const result = bet.result ?? settleMultiLegs(legRes);
    const stake = bet.stakeUnits;
    const profit =
      result === "pending"
        ? null
        : profitUnitsForBet(result, stake, bet.publishedCombinedPrice);
    rows.push({
      slateDate,
      betType: bet.betType,
      label: bet.label,
      variant: bet.variant ?? "manual",
      legIds: bet.legIds,
      result,
      profitUnits: profit,
      stakeUnits: result === "pending" ? 0 : stake,
      publishedCombinedPrice: bet.publishedCombinedPrice,
    });
  }
  return rows;
}

export function slateResultsMissingManualBets(
  slateDate: string,
  existing: OfficialBetRow[],
  rootDir?: string
): boolean {
  const file = loadManualOfficialBets(rootDir ?? process.cwd());
  const configured = file.slates?.[slateDate]?.manualBets ?? [];
  if (!configured.length) return false;
  for (const bet of configured) {
    const found = existing.some(
      (row) =>
        row.variant === (bet.variant ?? "manual") &&
        row.label === bet.label &&
        row.slateDate === slateDate
    );
    if (!found) return true;
  }
  return false;
}