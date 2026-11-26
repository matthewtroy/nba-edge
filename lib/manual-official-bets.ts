import fs from "fs";
import path from "path";
import type { MultiBet, MultiType } from "./types.js";

export interface ManualOfficialBet {
  bestBookie?: string;
  bestBookieTotal?: number;
  legs?: string[];
  label?: string;
}

export interface ManualOfficialBetsFile {
  slates?: Record<string, Partial<Record<MultiType, ManualOfficialBet>>>;
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
    const o = overrides[m.type];
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