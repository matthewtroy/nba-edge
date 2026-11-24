import fs from "fs";
import path from "path";
import type {
  InjuryEntry,
  PickLeg,
  SlateGame,
  MultiBet,
  MetaJson,
  HistoryJson,
} from "../lib/types.js";
import { toSydney } from "../lib/sydney.js";
import { parseOddsKey } from "../lib/odds.js";
import { loadAliasMap } from "../lib/player-names.js";
import { runModel, type ModelPlayer } from "./model-engine.js";
import type { MultiBuildResult } from "../lib/multis.js";

interface FixtureRoot {
  date: string;
  games: Omit<SlateGame, "startTimeSydney">[];
  injuries: InjuryEntry[];
  players: ModelPlayer[];
  fakeOdds?: { playerName: string; market: string; line: number; price: number; bookie: string }[];
  whatChanged?: string[];
}

export function runModelFromFixture(rootDir: string, minEdge = 1.08): {
  slate: SlateGame[];
  injuries: InjuryEntry[];
  picks: PickLeg[];
  multis: MultiBet[];
  multisPayload: MultiBuildResult;
  meta: MetaJson;
  whatChanged: string[];
} {
  loadAliasMap(rootDir);
  const raw = JSON.parse(
    fs.readFileSync(path.join(rootDir, "fixtures/raw-slate.json"), "utf8")
  ) as FixtureRoot;

  const slate: SlateGame[] = raw.games.map((g) => ({
    ...g,
    startTimeSydney: toSydney(g.startTime),
  }));

  const oddsMap = new Map<string, { price: number; bookie: string }>();
  const oddsAt = new Date().toISOString();
  for (const o of raw.fakeOdds ?? []) {
    oddsMap.set(parseOddsKey(o.playerName, o.market, o.line), {
      price: o.price,
      bookie: o.bookie,
    });
  }

  const rosterIds = new Set(raw.players.map((p) => p.id));

  const modelOut = runModel({
    rootDir,
    slate,
    injuries: raw.injuries,
    players: raw.players,
    rosterIds,
    oddsMap,
    oddsPulledAt: oddsAt,
    minEdge,
    whatChanged: raw.whatChanged ?? [],
    metaSources: {
      espn: "ok",
      nbaOfficial: "ok",
      odds: raw.fakeOdds?.length ? "ok" : "stale",
    },
  });

  return {
    slate,
    injuries: raw.injuries,
    picks: modelOut.picks,
    multis: modelOut.multis,
    multisPayload: modelOut.multisPayload,
    meta: modelOut.meta,
    whatChanged: modelOut.whatChanged,
  };
}

export function loadHistory(rootDir: string): HistoryJson {
  const p = path.join(rootDir, "public/data/history.json");
  if (fs.existsSync(p)) {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  }
  return { legs: [], multis: [], calibration: [] };
}