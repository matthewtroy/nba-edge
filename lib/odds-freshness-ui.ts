import type { PickLeg, SlateGame } from "./types.js";
import { legHasFeedPrice } from "./slate-odds-ui.js";

/** Latest feed odds pull ISO for one game (from legs). */
export function gameOddsPulledIso(
  picks: PickLeg[],
  gameId: string,
  fallbackIso?: string
): string | undefined {
  const stamps = picks
    .filter((p) => p.gameId === gameId && legHasFeedPrice(p))
    .map((p) => p.oddsPulledAt)
    .filter((t): t is string => Boolean(t));
  return stamps.sort().at(-1) ?? fallbackIso;
}

/** Sydney clock label e.g. `4:16pm`. */
export function sydneyOddsClock(iso: string): string {
  return new Date(iso)
    .toLocaleString("en-AU", {
      timeZone: "Australia/Sydney",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    })
    .replace(/\s/g, "")
    .toLowerCase();
}

/**
 * Header fragment: `Odds 9:29pm (3 games) · 4:16pm (6 games)`.
 * Groups slate games by exact pull timestamp on their legs.
 */
export function formatOddsFreshnessSummary(
  picks: PickLeg[],
  slate: SlateGame[],
  fallbackIso?: string
): string | undefined {
  const byIso = new Map<string, number>();
  for (const g of slate) {
    const iso = gameOddsPulledIso(picks, g.id, fallbackIso);
    if (!iso) continue;
    byIso.set(iso, (byIso.get(iso) ?? 0) + 1);
  }
  if (!byIso.size) {
    if (fallbackIso) return `Odds ${sydneyOddsClock(fallbackIso)}`;
    return undefined;
  }
  const parts = [...byIso.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([iso, count]) => {
      const games = count === 1 ? "1 game" : `${count} games`;
      return `${sydneyOddsClock(iso)} (${games})`;
    });
  return `Odds ${parts.join(" · ")}`;
}

/** Muted game header suffix: `odds 4:16pm`. */
export function formatGameOddsAge(
  picks: PickLeg[],
  gameId: string,
  fallbackIso?: string
): string | undefined {
  const iso = gameOddsPulledIso(picks, gameId, fallbackIso);
  if (!iso) return undefined;
  return `odds ${sydneyOddsClock(iso)}`;
}