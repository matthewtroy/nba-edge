import { normalizePlayerName } from "./player-names.js";
import type { SlateGame } from "./types.js";
import type { OddsCacheFile, SlateOddsSnapshot } from "./odds-cache-file.js";

function oddsMapToRecord(
  map: Map<string, { price: number; bookie: string }>
): Record<string, { price: number; bookie: string }> {
  return Object.fromEntries(map);
}

function oddsMapFromRecord(
  record: Record<string, { price: number; bookie: string }>
): Map<string, { price: number; bookie: string }> {
  return new Map(Object.entries(record));
}

export function cacheSlateOddsSnapshot(
  cache: OddsCacheFile,
  slateDate: string,
  snapshot: SlateOddsSnapshot
): void {
  if (!cache.bySlateDate) cache.bySlateDate = {};
  cache.bySlateDate[slateDate] = snapshot;
}

export function slatePlayerNames(
  slate: SlateGame[],
  playerNames: string[],
  playerTeamIds: Map<string, string>
): Set<string> {
  const teams = new Set(slate.flatMap((g) => [g.homeTeamId, g.awayTeamId]));
  const out = new Set<string>();
  for (const name of playerNames) {
    const norm = normalizePlayerName(name);
    const tid = playerTeamIds.get(norm);
    if (tid && teams.has(tid)) out.add(norm);
  }
  return out;
}

function filterOddsMapToPlayers(
  map: Record<string, { price: number; bookie: string }>,
  players: Set<string>
): Record<string, { price: number; bookie: string }> {
  const out: Record<string, { price: number; bookie: string }> = {};
  for (const [k, v] of Object.entries(map)) {
    const player = k.split("|")[0];
    if (players.has(player) || players.has(normalizePlayerName(player))) {
      out[k] = v;
    }
  }
  return out;
}

/** Newest cached prices for a slate: global cache merged with per-slate snapshot. */
export function resolveSlateOddsMaps(
  cache: OddsCacheFile,
  slateDate: string,
  slate: SlateGame[],
  playerNames: string[],
  playerTeamIds: Map<string, string>
): {
  best: Map<string, { price: number; bookie: string }>;
  all: Map<string, Record<string, number>>;
  lastPulled?: string;
} {
  const players = slatePlayerNames(slate, playerNames, playerTeamIds);
  const merged = new Map<string, { price: number; bookie: string }>();
  const globalMap = cache.oddsMap ?? {};
  for (const [k, v] of Object.entries(filterOddsMapToPlayers(globalMap, players))) {
    merged.set(k, v);
  }

  const snap = cache.bySlateDate?.[slateDate];
  if (snap?.oddsMap) {
    for (const [k, v] of Object.entries(filterOddsMapToPlayers(snap.oddsMap, players))) {
      merged.set(k, v);
    }
  }

  const all = new Map<string, Record<string, number>>();
  if (snap?.allOddsMap) {
    for (const [k, v] of Object.entries(snap.allOddsMap)) {
      const player = k.split("|")[0];
      if (players.has(player) || players.has(normalizePlayerName(player))) {
        all.set(k, v);
      }
    }
  }

  const lastPulled = snap?.lastPulled ?? cache.lastPulled;
  return { best: merged, all, lastPulled };
}

export function snapshotFromPricingMaps(
  slateDate: string,
  best: Map<string, { price: number; bookie: string }>,
  all: Map<string, Record<string, number>>,
  lastPulled: string,
  pulledGameIds?: string[]
): SlateOddsSnapshot {
  return {
    lastPulled,
    oddsMap: oddsMapToRecord(best),
    allOddsMap: Object.fromEntries(all),
    pulledGameIds: pulledGameIds ? [...pulledGameIds] : undefined,
  };
}

export function mergePricingMaps(
  cached: Map<string, { price: number; bookie: string }>,
  fresh: Map<string, { price: number; bookie: string }>
): Map<string, { price: number; bookie: string }> {
  const out = new Map(cached);
  for (const [k, v] of fresh) out.set(k, v);
  return out;
}

export function cachedMapFromFile(cache: OddsCacheFile): Map<string, { price: number; bookie: string }> {
  return oddsMapFromRecord(cache.oddsMap ?? {});
}