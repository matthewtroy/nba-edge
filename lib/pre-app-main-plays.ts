import fs from "fs";
import path from "path";
import { BET_LABELS, profitUnitsForBet, type OfficialBetRow } from "./official-bet-settle.js";

/** Main Plays placed before the app published official cards. */
export interface PreAppMainPlay {
  date: string;
  bookie: string;
  price: number;
  result: "won" | "lost" | "void";
  legs?: string[];
  /** Price recorded from memory; internal only, never shown. */
  oddsEstimated?: boolean;
}

export interface PreAppMainPlaysFile {
  stakeUnits?: number;
  mainPlays?: PreAppMainPlay[];
}

export const PRE_APP_MAIN_PLAYS_PATH = "config/pre-app-main-plays.json";

export function loadPreAppMainPlays(rootDir: string): PreAppMainPlaysFile {
  const p = path.join(rootDir, PRE_APP_MAIN_PLAYS_PATH);
  if (!fs.existsSync(p)) return {};
  try {
    return JSON.parse(fs.readFileSync(p, "utf8")) as PreAppMainPlaysFile;
  } catch {
    return {};
  }
}

/** Official Main Play rows for pre-app dates; dates with a published card are skipped. */
export function preAppMainPlayRows(
  file: PreAppMainPlaysFile,
  cardDates: Set<string> = new Set()
): OfficialBetRow[] {
  const stake = file.stakeUnits ?? 1;
  return (file.mainPlays ?? [])
    .filter((p) => !cardDates.has(p.date))
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((p) => ({
      slateDate: p.date,
      betType: "mainPlay",
      label: BET_LABELS.mainPlay,
      bookie: p.bookie,
      legIds: [],
      ...(p.legs?.length ? { legLabels: p.legs } : {}),
      result: p.result,
      profitUnits: profitUnitsForBet(p.result, stake, p.price),
      stakeUnits: stake,
      publishedCombinedPrice: p.price,
    }));
}
