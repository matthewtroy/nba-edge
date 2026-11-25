import fs from "fs";
import path from "path";
import { renderTodayText } from "../lib/today-text.js";
import type { OfficialCardFile } from "../lib/official-card.js";
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

let officialCard: OfficialCardFile | null = null;
const officialPath = path.join(data, "official-card.json");
if (fs.existsSync(officialPath)) {
  officialCard = JSON.parse(fs.readFileSync(officialPath, "utf8")) as OfficialCardFile;
}

const text = renderTodayText({
  meta,
  slate,
  multis: multisRaw.bets,
  notBuilt: multisRaw.notBuilt,
  picksById: new Map(picks.map((p) => [p.id, p])),
  officialCard,
});

console.log(text);