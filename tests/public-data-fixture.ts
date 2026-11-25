import fs from "fs";
import path from "path";
import type { MetaJson, MultiBet, MultiNotBuilt, MultisJson, PickLeg, SlateGame } from "../lib/types";

const fixtureRoot = path.join(import.meta.dirname, "fixtures");
const dataIndexPath = path.join(fixtureRoot, "data-index.json");

export function fixtureSlateDir(date: string): string {
  return path.join(fixtureRoot, date);
}

export function defaultPublishedDate(): string {
  const index = JSON.parse(fs.readFileSync(dataIndexPath, "utf8")) as { defaultDate: string };
  return index.defaultDate;
}

export function loadPublishedSlate(date = defaultPublishedDate()) {
  const dir = fixtureSlateDir(date);
  const meta = JSON.parse(fs.readFileSync(path.join(dir, "meta.json"), "utf8")) as MetaJson;
  const slate = JSON.parse(fs.readFileSync(path.join(dir, "slate.json"), "utf8")) as SlateGame[];
  const picks = JSON.parse(fs.readFileSync(path.join(dir, "picks.json"), "utf8")) as PickLeg[];
  const multisRaw = JSON.parse(fs.readFileSync(path.join(dir, "multis.json"), "utf8")) as MultisJson;
  return { meta, slate, picks, multisRaw, date };
}

export function loadPublishedMultis(date = defaultPublishedDate()): MultisJson {
  return JSON.parse(
    fs.readFileSync(path.join(fixtureSlateDir(date), "multis.json"), "utf8")
  ) as MultisJson;
}