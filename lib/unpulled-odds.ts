import type { PickLeg, SlateGame } from "./types.js";
import { legHasFeedPrice } from "./slate-odds-ui.js";

export const UNPULLED_GAME_ODDS_LABEL =
  "No bookie prices pulled for this game (no strong angle)";

/** Label only games that had no API pull this run AND still have no feed prices (cached ok). */
export function gameOddsLabelsForUnpulled(
  picks: PickLeg[],
  unpulledThisRun: Set<string>
): Record<string, string> | undefined {
  if (!unpulledThisRun.size) return undefined;
  const out: Record<string, string> = {};
  for (const gameId of unpulledThisRun) {
    const legs = picks.filter((p) => p.gameId === gameId);
    if (legs.some(legHasFeedPrice)) continue;
    out[gameId] = UNPULLED_GAME_ODDS_LABEL;
  }
  return Object.keys(out).length ? out : undefined;
}

function formatSydneyShort(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("en-AU", {
    timeZone: "Australia/Sydney",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

/** Per-game book price age for meta (e.g. "Prices from 4:05pm"). */
export function gameOddsPriceAge(
  picks: PickLeg[],
  slate: SlateGame[],
  fallbackPulledAt?: string
): Record<string, string> | undefined {
  const byGame = new Map<string, string>();
  for (const g of slate) {
    const legs = picks.filter((p) => p.gameId === g.id && legHasFeedPrice(p));
    const stamps = legs
      .map((l) => l.oddsPulledAt)
      .filter((t): t is string => Boolean(t));
    const iso = stamps.sort().at(-1) ?? fallbackPulledAt;
    if (!iso) continue;
    byGame.set(g.id, `Prices from ${formatSydneyShort(iso)}`);
  }
  if (!byGame.size) return undefined;
  return Object.fromEntries(byGame);
}