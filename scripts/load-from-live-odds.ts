import fs from "fs";
import path from "path";
import { parseOddsKey } from "../lib/odds.js";
import { normalizePlayerName } from "../lib/player-names.js";
import type { PickLeg } from "../lib/types.js";
import type { SlateOddsSnapshot } from "../lib/odds-cache-file.js";

export interface FromLiveOddsEntry {
  playerName: string;
  market: string;
  line: number;
  price: number;
  bookie: string;
  bookiePrices?: Record<string, number>;
}

export interface FromLiveOddsFile {
  pulledAt: string;
  entries: FromLiveOddsEntry[];
}

const SNAPSHOT = "fixtures/from-live-odds.json";

export function loadFromLiveOddsFile(rootDir: string): FromLiveOddsFile | null {
  const p = path.join(rootDir, SNAPSHOT);
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, "utf8")) as FromLiveOddsFile;
}

export function oddsMapsFromSnapshot(file: FromLiveOddsFile): {
  best: Map<string, { price: number; bookie: string }>;
  all: Map<string, Record<string, number>>;
} {
  const best = new Map<string, { price: number; bookie: string }>();
  const all = new Map<string, Record<string, number>>();
  for (const e of file.entries) {
    const key = parseOddsKey(e.playerName, e.market, e.line);
    const norm = `${normalizePlayerName(e.playerName)}|${e.market}|${e.line}`;
    best.set(key, { price: e.price, bookie: e.bookie });
    best.set(norm, { price: e.price, bookie: e.bookie });
    const books = e.bookiePrices ?? { [e.bookie]: e.price };
    all.set(key, books);
    all.set(norm, books);
  }
  return { best, all };
}

/** Build snapshot entries from priced legs (for GHA refresh). */
export function snapshotFromPicks(picks: PickLeg[], pulledAt: string): FromLiveOddsFile {
  const entries: FromLiveOddsEntry[] = [];
  const seen = new Set<string>();
  for (const leg of picks) {
    if (leg.bestPrice == null || !leg.bestBookie) continue;
    const k = `${leg.playerName}|${leg.market}|${leg.line}`;
    if (seen.has(k)) continue;
    seen.add(k);
    entries.push({
      playerName: leg.playerName,
      market: leg.market,
      line: leg.line,
      price: leg.bestPrice,
      bookie: leg.bestBookie,
      bookiePrices: leg.bookiePrices,
    });
  }
  return { pulledAt, entries };
}

export function slateOddsSnapshotFromPicks(
  picks: PickLeg[],
  pulledAt: string
): SlateOddsSnapshot {
  const file = snapshotFromPicks(picks, pulledAt);
  const { best, all } = oddsMapsFromSnapshot(file);
  const oddsMap: Record<string, { price: number; bookie: string }> = {};
  for (const [k, v] of best) oddsMap[k] = v;
  const allOddsMap: Record<string, Record<string, number>> = {};
  for (const [k, v] of all) allOddsMap[k] = v;
  return { lastPulled: pulledAt, oddsMap, allOddsMap };
}

export function writeFromLiveOddsSnapshot(rootDir: string, file: FromLiveOddsFile): void {
  const p = path.join(rootDir, SNAPSHOT);
  fs.writeFileSync(p, JSON.stringify(file, null, 2));
}

/** Parity odds when live API unavailable: one AU book per leg at take-at + margin. */
export function syntheticFromLiveOddsFromPicks(picks: PickLeg[]): FromLiveOddsFile {
  const books = ["Sportsbet", "TAB", "PointsBet", "Unibet"];
  const entries: FromLiveOddsEntry[] = [];
  for (const leg of picks) {
    if (leg.takeAt < 1.2) continue;
    const prices: Record<string, number> = {};
    let best = leg.takeAt;
    let bestBook = "Sportsbet";
    books.forEach((b, i) => {
      let p =
        Math.round(Math.max(leg.takeAt * 1.03, leg.takeAt + 0.05 + i * 0.02) * 100) /
        100;
      if (p < leg.takeAt) {
        p = Math.round((leg.takeAt + 0.02) * 100) / 100;
      }
      prices[b] = p;
      if (p > best) {
        best = p;
        bestBook = b;
      }
    });
    entries.push({
      playerName: leg.playerName,
      market: leg.market,
      line: leg.line,
      price: best,
      bookie: bestBook,
      bookiePrices: prices,
    });
  }
  return { pulledAt: new Date().toISOString(), entries };
}