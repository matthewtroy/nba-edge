import type { Market, MultiBet, PickLeg, SlateGame } from "@lib/types";
import { isComboPickMarket } from "@lib/combo-markets";
import { hasValueAtBookie } from "@lib/value-at-bookie";
import { legPriceAtBookie } from "@lib/single-bookie";
import type {
  PicksFilterState,
  PicksSortKey,
} from "../hooks/usePicksFilters";

function edgeAtBookie(leg: PickLeg, bookie: string): number {
  const p = legPriceAtBookie(leg, bookie);
  if (p == null || p <= 1) return -999;
  return p / leg.fairPrice - 1;
}

function l5HitRate(leg: PickLeg): number {
  const ticks = (leg.recentVsLine ?? []).slice(0, 5);
  if (!ticks.length) return -1;
  const hits = ticks.filter((t) => t === "hit").length;
  const rated = ticks.filter((t) => t !== "na").length;
  return rated ? hits / rated : -1;
}

function tipStartMs(leg: PickLeg, slate: SlateGame[]): number {
  const game = slate.find((g) => g.id === leg.gameId);
  if (!game?.startTime) return 0;
  return Date.parse(game.startTime);
}

export function marketsOnSlate(picks: PickLeg[]): Market[] {
  const set = new Set<Market>();
  for (const p of picks) set.add(p.market);
  return [...set].sort((a, b) => a.localeCompare(b));
}

export function multiLegIdSet(multis: MultiBet[]): Set<string> {
  const ids = new Set<string>();
  for (const m of multis) {
    for (const id of m.legs) ids.add(id);
  }
  return ids;
}

export function filterAndSortPicks(input: {
  picks: PickLeg[];
  slate: SlateGame[];
  multis: MultiBet[];
  myBookie: string;
  filters: PicksFilterState;
}): PickLeg[] {
  const { picks, slate, multis, myBookie, filters } = input;
  const inMulti = multiLegIdSet(multis);
  let list = [...picks];

  if (filters.multi === "inMulti") {
    list = list.filter((l) => inMulti.has(l.id));
  }
  if (filters.market !== "all") {
    if (filters.market === "combos") {
      list = list.filter((l) => isComboPickMarket(l.market));
    } else {
      list = list.filter((l) => l.market === filters.market);
    }
  }
  if (filters.show === "value") {
    list = list.filter((l) => hasValueAtBookie(l, myBookie));
  } else if (filters.show === "high") {
    list = list.filter((l) => l.tags.includes("High probability"));
  }

  const dir = filters.sortAsc ? 1 : -1;
  const sortKey: PicksSortKey = filters.sort;
  list.sort((a, b) => {
    switch (sortKey) {
      case "prob":
        return dir * (a.probability - b.probability);
      case "price": {
        const pa = legPriceAtBookie(a, myBookie) ?? a.bestPrice ?? 0;
        const pb = legPriceAtBookie(b, myBookie) ?? b.bestPrice ?? 0;
        return dir * (pa - pb);
      }
      case "l5":
        return dir * (l5HitRate(a) - l5HitRate(b));
      case "tip":
        return dir * (tipStartMs(a, slate) - tipStartMs(b, slate));
      case "edge":
      default:
        return dir * (edgeAtBookie(a, myBookie) - edgeAtBookie(b, myBookie));
    }
  });
  return list;
}