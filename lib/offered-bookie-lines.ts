import fs from "fs";
import path from "path";
import type { Market, PickLeg } from "./types.js";
import {
  type CatalogMarketIndex,
  ladderForPlayerMarket,
} from "./catalog-index.js";
import { normalizePlayerName } from "./player-names.js";
import { legOddsLookupKey } from "./odds.js";
import { canonBookiePrices, resolveCanonBookie } from "./bookie-totals.js";
import type { OddsCacheFile } from "./odds-cache-file.js";

let booksByKey: Map<string, Record<string, number>> | null = null;
let cachePathOverride: string | null = null;

function mergeOddsKey(
  out: Map<string, Record<string, number>>,
  key: string,
  prices: Record<string, number>
): void {
  const canon = canonBookiePrices(prices) as Record<string, number>;
  if (!Object.keys(canon).length) return;
  const lower = key.toLowerCase();
  const prev = out.get(lower) ?? {};
  out.set(lower, { ...prev, ...canon });
  const parts = key.split("|");
  if (parts.length >= 3) {
    const norm = `${normalizePlayerName(parts[0]!)}|${parts[1]}|${parts[2]}`;
    const prevNorm = out.get(norm.toLowerCase()) ?? {};
    out.set(norm.toLowerCase(), { ...prevNorm, ...canon });
  }
}

function preferSlateDate(raw: OddsCacheFile): string | undefined {
  const fromEnv = process.env.PIPELINE_SLATE_DATE?.trim() || process.env.SLATE_TIP_DATE?.trim();
  if (fromEnv && raw.bySlateDate?.[fromEnv]) return fromEnv;
  const keys = Object.keys(raw.bySlateDate ?? {}).sort();
  return keys.at(-1);
}

function parseOddsCachePayload(raw: OddsCacheFile): Map<string, Record<string, number>> {
  const out = new Map<string, Record<string, number>>();
  const slateDate = preferSlateDate(raw);

  const snap = slateDate ? raw.bySlateDate?.[slateDate] : undefined;
  if (snap?.allOddsMap) {
    for (const [k, v] of Object.entries(snap.allOddsMap)) {
      mergeOddsKey(out, k, v);
    }
  }

  const oddsMaps = [snap?.oddsMap, raw.oddsMap].filter(Boolean) as Record<
    string,
    { price: number; bookie: string } | { price: number; bookie: string }[]
  >[];
  for (const map of oddsMaps) {
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
      if (Object.keys(merged).length) mergeOddsKey(out, key, merged);
    }
  }
  return out;
}

function parseOddsCacheFile(cachePath: string): Map<string, Record<string, number>> {
  if (!fs.existsSync(cachePath)) return new Map();
  try {
    const raw = JSON.parse(fs.readFileSync(cachePath, "utf8")) as OddsCacheFile;
    return parseOddsCachePayload(raw);
  } catch {
    return new Map();
  }
}

export function bookiePriceFromOfferedMap(
  prices: Record<string, number> | undefined,
  bookie: string
): number | undefined {
  if (!prices) return undefined;
  const canon = canonBookiePrices(prices);
  const key = resolveCanonBookie(bookie) ?? bookie;
  const p = canon[key as keyof typeof canon];
  if (p == null || p <= 1) return undefined;
  return p;
}

/** Test / pipeline hook to rebuild cache after odds-cache.json changes. */
export function resetOfferedBookieCacheForTests(): void {
  booksByKey = null;
  cachePathOverride = null;
}

export function setOfferedBookieCachePathForTests(cachePath: string | null): void {
  cachePathOverride = cachePath;
  booksByKey = null;
}

export function offeredBookiePrices(
  playerName: string,
  market: Market,
  line: number
): Record<string, number> | undefined {
  if (!booksByKey) {
    booksByKey = parseOddsCacheFile(
      cachePathOverride ?? path.join(process.cwd(), "public/data/odds-cache.json")
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

function ladderBounds(
  mainLeg: PickLeg,
  line: number,
  catalog: PickLeg[],
  index?: CatalogMarketIndex
): { lower: PickLeg; upper: PickLeg } | null {
  const ladder =
    index != null
      ? ladderForPlayerMarket(index, mainLeg.playerId, mainLeg.market)
      : catalog.filter(
          (p) => p.playerId === mainLeg.playerId && p.market === mainLeg.market
        );
  if (!ladder.length) return null;
  const lower = ladder.find((p) => p.line === mainLeg.line) ?? mainLeg;
  const upper = ladder.find((p) => p.line > mainLeg.line);
  if (!upper) return null;
  if (line <= lower.line || line >= upper.line) return null;
  return { lower, upper };
}

/** Model fair between two priced ladder legs at an intermediate bookie line. */
export function synthesizeOfferedRung(
  mainLeg: PickLeg,
  line: number,
  bookie: string,
  catalog: PickLeg[],
  index?: CatalogMarketIndex
): PickLeg | null {
  if (line <= mainLeg.line) return null;
  const prices = offeredBookiePrices(mainLeg.playerName, mainLeg.market, line);
  const price = bookiePriceFromOfferedMap(prices, bookie);
  if (price == null) return null;

  const ladder =
    index != null
      ? ladderForPlayerMarket(index, mainLeg.playerId, mainLeg.market)
      : catalog;
  const existing = ladder.find(
    (p) => p.playerId === mainLeg.playerId && p.market === mainLeg.market && p.line === line
  );
  if (existing) {
    if (bookiePriceFromOfferedMap(existing.bookiePrices, bookie) != null) {
      return {
        ...existing,
        bestPrice: bookiePriceFromOfferedMap(existing.bookiePrices, bookie),
        bestBookie: resolveCanonBookie(bookie) ?? bookie,
      };
    }
    const merged = {
      ...canonBookiePrices(existing.bookiePrices),
      ...canonBookiePrices(prices),
    } as Record<string, number>;
    if (bookiePriceFromOfferedMap(merged, bookie) == null) return existing;
    return {
      ...existing,
      bookiePrices: merged,
      bestPrice: bookiePriceFromOfferedMap(merged, bookie),
      bestBookie: resolveCanonBookie(bookie) ?? bookie,
    };
  }

  const bounds = ladderBounds(mainLeg, line, catalog, index);
  if (!bounds) return null;
  const { lower, upper } = bounds;

  const span = upper.line - lower.line;
  if (span <= 0) return null;
  const t = (line - lower.line) / span;
  const p = Math.min(
    0.94,
    Math.max(0.06, lower.probability + t * (upper.probability - lower.probability))
  );
  const fair = Math.round((1 / p) * 100) / 100;
  const takeAt = Math.round(fair * 1.08 * 100) / 100;
  const canonPrices = canonBookiePrices(prices) as Record<string, number>;
  return {
    ...lower,
    id: `${lower.playerId}-${lower.market}-${line}`,
    line,
    probability: Math.round(p * 1000) / 1000,
    modelProbability: Math.round(p * 1000) / 1000,
    fairPrice: fair,
    takeAt,
    bookiePrices: canonPrices,
    bestPrice: price,
    bestBookie: resolveCanonBookie(bookie) ?? bookie,
    tags: lower.tags.filter((t) => t !== "High probability"),
  };
}