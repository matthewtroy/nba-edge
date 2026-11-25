import { normalizePlayerName } from "../lib/player-names.js";
import {
  legOddsLookupKey,
  normalizeLegMarket,
  parseOddsKey,
} from "../lib/odds.js";
import type { PickLeg } from "../lib/types.js";
import type { OddsCacheFile } from "./odds-schedule.js";

export const PAGES_DATA_BASE = "https://matthewtroy.github.io/nba-edge/data/";

const DATA_FILES = [
  "meta.json",
  "slate.json",
  "injuries.json",
  "picks.json",
  "odds-cache.json",
  "odds-coverage.json",
] as const;

export type PublishedDataFile = (typeof DATA_FILES)[number];

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Published fetch failed ${res.status}: ${url}`);
  }
  return (await res.json()) as T;
}

export interface PublishedBundle {
  meta: Record<string, unknown>;
  slate: unknown;
  injuries: unknown;
  picks: PickLeg[];
  oddsCache: OddsCacheFile;
  oddsCoverage?: unknown;
  fetchedAt: string;
}

/** Download real JSON published on GitHub Pages (production parity inputs). */
export async function fetchPublishedBundle(): Promise<PublishedBundle> {
  const [meta, slate, injuries, picks, oddsCache, oddsCoverage] = await Promise.all([
    fetchJson<Record<string, unknown>>(`${PAGES_DATA_BASE}meta.json`),
    fetchJson<unknown>(`${PAGES_DATA_BASE}slate.json`),
    fetchJson<unknown>(`${PAGES_DATA_BASE}injuries.json`),
    fetchJson<PickLeg[]>(`${PAGES_DATA_BASE}picks.json`),
    fetchJson<OddsCacheFile>(`${PAGES_DATA_BASE}odds-cache.json`),
    fetchJson<unknown>(`${PAGES_DATA_BASE}odds-coverage.json`).catch(() => undefined),
  ]);

  return {
    meta,
    slate,
    injuries,
    picks,
    oddsCache,
    oddsCoverage,
    fetchedAt: new Date().toISOString(),
  };
}

/** Best + per-bookie maps from published picks and optional odds-cache overlay. */
export function oddsMapsFromPublished(
  picks: PickLeg[],
  cache?: OddsCacheFile
): {
  best: Map<string, { price: number; bookie: string }>;
  all: Map<string, Record<string, number>>;
} {
  const best = new Map<string, { price: number; bookie: string }>();
  const all = new Map<string, Record<string, number>>();

  for (const leg of picks) {
    const keys = [
      legOddsLookupKey(leg.playerName, leg.market, leg.line),
      parseOddsKey(leg.playerName, leg.market, leg.line),
      `${normalizePlayerName(leg.playerName)}|${leg.market}|${leg.line}`,
    ];
    if (leg.bestPrice != null && leg.bestBookie) {
      const v = { price: leg.bestPrice, bookie: leg.bestBookie };
      for (const k of keys) best.set(k, v);
    }
    if (leg.bookiePrices && Object.keys(leg.bookiePrices).length) {
      for (const k of keys) all.set(k, leg.bookiePrices);
    }
  }

  if (cache?.oddsMap) {
    for (const [rawKey, v] of Object.entries(cache.oddsMap)) {
      const parts = rawKey.split("|");
      if (parts.length < 3) continue;
      const [name, rawMarket, lineStr] = parts;
      const market = normalizeLegMarket(rawMarket);
      const line = Number(lineStr);
      if (!Number.isFinite(line)) continue;
      const keys = [
        legOddsLookupKey(name, market, line),
        `${normalizePlayerName(name)}|${market}|${line}`,
        parseOddsKey(name, market, line),
        rawKey,
      ];
      for (const k of keys) {
        const prev = best.get(k);
        if (!prev || v.price > prev.price) best.set(k, v);
      }
      if (market !== rawMarket) {
        const legKey = `${normalizePlayerName(name)}|${rawMarket}|${line}`;
        const prev = best.get(legKey);
        if (!prev || v.price > prev.price) best.set(legKey, v);
      }
    }
  }

  return { best, all };
}