import fs from "fs";
import path from "path";
import { renderGamesText } from "../lib/games-sgm.js";
import type { MultiBet, PickLeg, SlateGame } from "../lib/types.js";

const root = path.resolve(import.meta.dirname, "..");
const data = path.join(root, "public/data");

const slate = JSON.parse(fs.readFileSync(path.join(data, "slate.json"), "utf8")) as SlateGame[];
const picks = JSON.parse(fs.readFileSync(path.join(data, "picks.json"), "utf8")) as PickLeg[];
const multisRaw = JSON.parse(fs.readFileSync(path.join(data, "multis.json"), "utf8")) as {
  bets: MultiBet[];
};

let officialMultis = multisRaw.bets;
const officialPath = path.join(data, "official-card.json");
if (fs.existsSync(officialPath)) {
  const official = JSON.parse(fs.readFileSync(officialPath, "utf8")) as { multis: MultiBet[] };
  officialMultis = official.multis;
}

console.log(
  renderGamesText({
    slate,
    picks,
    multis: officialMultis,
  })
);