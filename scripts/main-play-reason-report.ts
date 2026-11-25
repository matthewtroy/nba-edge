import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import type { MultiBet, PickLeg } from "../lib/types.js";

const date = process.env.SLATE_DATE ?? "2026-11-26";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dir = path.join(root, "public", "data", date);
const picks = JSON.parse(fs.readFileSync(path.join(dir, "picks.json"), "utf8")) as PickLeg[];
const multis = JSON.parse(fs.readFileSync(path.join(dir, "multis.json"), "utf8")) as {
  bets: MultiBet[];
};
const byId = new Map(picks.map((p) => [p.id, p]));
const main = multis.bets.find((b) => b.type === "mainPlay");
const booster = multis.bets.find((b) => b.type === "booster");

function report(multi: MultiBet | undefined, label: string): void {
  if (!multi) {
    console.log(`${label}: not built`);
    return;
  }
  console.log(`${label}: ${multi.legs.length} legs @ ${multi.bestBookie ?? "?"}`);
  for (const id of multi.legs) {
    const leg = byId.get(id);
    if (!leg) {
      console.log(`  ${id}: missing pick`);
      continue;
    }
    const reason = (leg.reasonLine ?? "").trim() || "(no reasonLine)";
    console.log(`  ${leg.playerName} ${leg.market} ${leg.line}+ · ${reason}`);
  }
}

report(main, "Main Play");
report(booster, "Booster");