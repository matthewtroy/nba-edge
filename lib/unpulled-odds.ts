import type { PickLeg } from "./types.js";

export const UNPULLED_GAME_ODDS_LABEL =
  "No bookie prices pulled for this game (no strong angle)";

export function stripBookiePricesForGames(
  picks: PickLeg[],
  unpulledGameIds: Set<string>
): PickLeg[] {
  if (!unpulledGameIds.size) return picks;
  return picks.map((leg) => {
    if (!unpulledGameIds.has(leg.gameId)) return leg;
    const next = { ...leg };
    delete next.bestPrice;
    delete next.bestBookie;
    delete next.bookiePrices;
    delete next.oddsPulledAt;
    next.tags = next.tags.filter((t) => t !== "Value" && t !== "Check news");
    return next;
  });
}

export function gameOddsLabelsForUnpulled(
  unpulledGameIds: Set<string>
): Record<string, string> | undefined {
  if (!unpulledGameIds.size) return undefined;
  const out: Record<string, string> = {};
  for (const id of unpulledGameIds) {
    out[id] = UNPULLED_GAME_ODDS_LABEL;
  }
  return out;
}