import fs from "fs";
import path from "path";
import { renderTodayText } from "../lib/today-text.js";
import type { MetaJson, MultiBet, MultiNotBuilt, PickLeg, SlateGame } from "../lib/types.js";

const root = path.resolve(import.meta.dirname, "..");
const data = path.join(root, "public/data");

const meta = JSON.parse(fs.readFileSync(path.join(data, "meta.json"), "utf8")) as MetaJson;
const slate = JSON.parse(fs.readFileSync(path.join(data, "slate.json"), "utf8")) as SlateGame[];
const picks = JSON.parse(fs.readFileSync(path.join(data, "picks.json"), "utf8")) as PickLeg[];
const multisRaw = JSON.parse(fs.readFileSync(path.join(data, "multis.json"), "utf8")) as {
  bets: MultiBet[];
  notBuilt: MultiNotBuilt[];
};

const text = renderTodayText({
  meta,
  slate,
  multis: multisRaw.bets,
  notBuilt: multisRaw.notBuilt,
  picksById: new Map(picks.map((p) => [p.id, p])),
  gateViolations: meta.gateViolations,
});

console.log(text);