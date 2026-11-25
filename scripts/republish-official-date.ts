#!/usr/bin/env tsx
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import type { InjuryEntry, MetaJson, MultiBet, MultiNotBuilt, PickLeg, SlateGame } from "../lib/types.js";
import { loadOfficialCard, writeOfficialCard } from "../lib/official-card.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const date = process.argv[2] ?? process.env.SLATE_DATE ?? "2026-11-26";
const dir = path.join(root, "public/data", date);

function read<T>(name: string): T {
  return JSON.parse(fs.readFileSync(path.join(dir, name), "utf8")) as T;
}

const now = new Date();
const existing = loadOfficialCard(dir);
const official = writeOfficialCard(dir, {
  now,
  slate: read<SlateGame[]>("slate.json"),
  multis: read<{ bets: MultiBet[]; notBuilt: MultiNotBuilt[] }>("multis.json").bets,
  notBuilt: read<{ bets: MultiBet[]; notBuilt: MultiNotBuilt[] }>("multis.json").notBuilt,
  injuries: read<InjuryEntry[]>("injuries.json"),
  meta: read<MetaJson>("meta.json"),
  picks: read<PickLeg[]>("picks.json"),
  republishedAt: now.toISOString(),
  preservePublishedAt: existing?.publishedAt,
});

const meta = read<MetaJson>("meta.json");
meta.officialCard = {
  lockedAt: official.lockedAt,
  publishedAt: official.publishedAt ?? official.lockedAt,
  republishedAt: official.republishedAt,
  slateDate: date,
  bookie: official.bookie,
};
fs.writeFileSync(path.join(dir, "meta.json"), JSON.stringify(meta, null, 2));

const main = official.multis.find((m) => m.type === "mainPlay");
console.log(
  `Republished ${date}: bookie=${official.bookie} snapshots=${Object.keys(official.legSnapshots ?? {}).length} main=${main?.bestBookie} $${main?.bestBookieTotal?.toFixed(2)}`
);