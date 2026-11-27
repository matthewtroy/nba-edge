import fs from "fs";
import path from "path";
import type { Market, PickLeg } from "./types.js";
import { normalizePlayerName } from "./player-names.js";
import { legOddsLookupKey } from "./odds.js";
import { canonBookiePrices } from "./bookie-totals.js";

let booksByKey: Map<string, Record<string, number>> | null = null;

function parseOddsCacheFile(cachePath: string): Map<string, Record<string, number>> {
  const out = new Map<string, Record<string, number>>();
  if (!fs.existsSync(cachePath)) return out;
  const raw = JSON.parse(fs.readFileSync(cachePath, "utf8")) as {
    oddsMap?: Record<string, { price: number; bookie: string } | { price: number; bookie: string }[]>;
  };
  const map = raw.oddsMap ?? {};
  for (const [key, val] of Object.entries(map)) {
    const rows = Array.isArray(val) ? val : [val];
    const merged: Record<string, number> = {};
    for (const row of rows) {
      if (!row?.bookie || row.price <= 1) continue;
      const canon = canonBookiePrices({ [row.bookie]: row.price });
      for (const [b, p] of Object.entries(canon)) {
        if (p > (merged[b] ?? 0)) merged[b] = p;
      }
    }
    if (Object.keys(merged).length) {
      out.set(key.toLowerCase(), merged);
      const parts = key.split("|");
      if (parts.length >= 3) {
        const norm = `${normalizePlayerName(parts[0]!)}|${parts[1]}|${parts[2]}`;
        const prev = out.get(norm) ?? {};
        out.set(norm, { ...prev, ...merged });
      }
    }
  }
  return out;
}

export function offeredBookiePrices(
  playerName: string,
  market: Market,
  line: number
): Record<string, number> | undefined {
  if (!booksByKey) {
    booksByKey = parseOddsCacheFile(
      path.join(process.cwd(), "public/data/odds-cache.json")
    );
  }
  const keys = [
    legOddsLookupKey(playerName, market, line),
    `${playerName}|${market}|${line}`,
    `${normalizePlayerName(playerName)}|${market}|${line}`,
  ];
  for (const k of keys) {
    const hit = booksByKey.get(k.toLowerCase());
    if (hit) return hit;
  }
  return undefined;
}

/** Model fair between two priced ladder legs at an intermediate bookie line. */
export function synthesizeOfferedRung(
  mainLeg: PickLeg,
  line: number,
  bookie: string,
  catalog: PickLeg[]
): PickLeg | null {
  if (line <= mainLeg.line) return null;
  const prices = offeredBookiePrices(mainLeg.playerName, mainLeg.market, line);
  const price = prices?.[bookie] ?? prices?.[bookie.toLowerCase()];
  if (price == null || price <= 1) return null;

  const existing = catalog.find(
    (p) =>
      p.playerId === mainLeg.playerId &&
      p.market === mainLeg.market &&
      p.line === line
  );
  if (existing) return existing;

  const lower =
    catalog.find(
      (p) =>
        p.playerId === mainLeg.playerId &&
        p.market === mainLeg.market &&
        p.line === mainLeg.line
    ) ?? mainLeg;
  const upper = catalog
    .filter(
      (p) =>
        p.playerId === mainLeg.playerId &&
        p.market === mainLeg.market &&
        p.line > mainLeg.line
    )
    .sort((a, b) => a.line - b.line)[0];
  if (!upper) return null;

  const span = upper.line - lower.line;
  if (span <= 0) return null;
  const t = (line - lower.line) / span;
  const p = Math.min(
    0.94,
    Math.max(0.06, lower.probability + t * (upper.probability - lower.probability))
  );
  const fair = Math.round((1 / p) * 100) / 100;
  const takeAt = Math.round(fair * 1.08 * 100) / 100;
  return {
    ...lower,
    id: `${lower.playerId}-${lower.market}-${line}`,
    line,
    probability: Math.round(p * 1000) / 1000,
    modelProbability: Math.round(p * 1000) / 1000,
    fairPrice: fair,
    takeAt,
    bookiePrices: prices,
    bestPrice: price,
    bestBookie: bookie,
    tags: lower.tags.filter((t) => t !== "High probability"),
  };
}