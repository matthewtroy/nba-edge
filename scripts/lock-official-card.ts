#!/usr/bin/env tsx
/**
 * Re-lock official card from current public/data (e.g. after --from-live proof).
 */
import fs from "fs";
import path from "path";
import type { InjuryEntry, MetaJson, MultiBet, MultiNotBuilt, SlateGame } from "../lib/types.js";
import { OFFICIAL_CARD_BOOKIE, writeOfficialCard } from "../lib/official-card.js";

const root = path.resolve(import.meta.dirname, "..");
const outDir = path.join(root, "public/data");

function readJson<T>(file: string): T {
  return JSON.parse(fs.readFileSync(path.join(outDir, file), "utf8")) as T;
}

const now = new Date();
const slate = readJson<SlateGame[]>("slate.json");
const injuries = readJson<InjuryEntry[]>("injuries.json");
const multisRaw = readJson<{ bets: MultiBet[]; notBuilt: MultiNotBuilt[] }>("multis.json");
const meta = readJson<MetaJson>("meta.json");
const official = writeOfficialCard(outDir, {
  now,
  slate,
  multis: multisRaw.bets,
  notBuilt: multisRaw.notBuilt,
  injuries,
  meta,
  bookie: OFFICIAL_CARD_BOOKIE,
});

const metaOut = { ...meta, officialCard: {
  lockedAt: official.lockedAt,
  slateDate: official.slateDate,
  bookie: official.bookie,
} };
fs.writeFileSync(path.join(outDir, "meta.json"), JSON.stringify(metaOut, null, 2));
console.log(`Locked official card: ${official.slateDate} · ${official.multis.length} multis`);