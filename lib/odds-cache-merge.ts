import type { SlateGame } from "./types.js";

export type BestOddsEntry = { price: number; bookie: string };

export function slateEarliestTipMs(slate: SlateGame[]): number | null {
  if (!slate.length) return null;
  return Math.min(...slate.map((g) => new Date(g.startTime).getTime()));
}

/** True once the earliest slate game has tipped (Sydney-agnostic UTC start). */
export function isPostTipOff(now: Date, slate: SlateGame[]): boolean {
  const tip = slateEarliestTipMs(slate);
  if (tip == null) return false;
  return now.getTime() >= tip;
}

/** Never replace a good cache with an empty/partial post-tip API response. */
export function mergeBestOddsMaps(
  previous: Map<string, BestOddsEntry>,
  incoming: Map<string, BestOddsEntry>,
  opts: { postTipOff: boolean }
): Map<string, BestOddsEntry> {
  if (incoming.size === 0) {
    return new Map(previous);
  }
  if (opts.postTipOff && incoming.size < previous.size * 0.25 && previous.size > 20) {
    return new Map(previous);
  }
  const out = new Map(previous);
  for (const [k, v] of incoming) {
    if (v.price > 1 && v.bookie) out.set(k, v);
  }
  return out;
}