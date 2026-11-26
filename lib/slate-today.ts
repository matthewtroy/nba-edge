import type { SlateGame } from "./types.js";

const SYDNEY = "Australia/Sydney";

export function sydneyTipDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: SYDNEY });
}

function isFinalStatus(status: string): boolean {
  const s = status.toLowerCase();
  return s.includes("final") || s === "post";
}

/** Earliest Sydney tip date that still has unfinished games; all games on that date (including final). */
export function filterSlateToTodaySydney(games: SlateGame[], _now = new Date()): SlateGame[] {
  const open = games.filter((g) => !isFinalStatus(g.status));
  const dateKeys = open.length
    ? [...new Set(open.map((g) => sydneyTipDate(g.startTime)))].sort()
  : [...new Set(games.map((g) => sydneyTipDate(g.startTime)))].sort();
  const activeDate = dateKeys[0];
  if (!activeDate) return [];

  return games.filter((g) => sydneyTipDate(g.startTime) === activeDate);
}

/**
 * Next slate for odds / official republish: earliest Sydney tip date whose first game is still in the future.
 */
export function filterSlateToNextSydney(
  games: SlateGame[],
  now = new Date()
): SlateGame[] {
  const open = games.filter((g) => !isFinalStatus(g.status));
  if (open.length === 0) return [];

  const future = open.filter((g) => new Date(g.startTime).getTime() > now.getTime());
  const base = future.length ? future : open;
  const dates = [...new Set(base.map((g) => sydneyTipDate(g.startTime)))].sort();
  if (!dates.length) return [];
  const nextDate = dates[0];
  return base.filter((g) => sydneyTipDate(g.startTime) === nextDate);
}

export function filterOpenGamesOnSydneyDate(games: SlateGame[], ymd: string): SlateGame[] {
  return games.filter(
    (g) => !isFinalStatus(g.status) && sydneyTipDate(g.startTime) === ymd
  );
}

export function tomorrowSydneyDateString(now = new Date()): string {
  const ms = now.getTime() + 86_400_000;
  return new Date(ms).toLocaleDateString("en-CA", { timeZone: SYDNEY });
}

export function slateTipDateFromGames(games: SlateGame[]): string | null {
  if (!games.length) return null;
  return sydneyTipDate(games[0].startTime);
}

export function slateTeamIds(games: SlateGame[]): Set<string> {
  const ids = new Set<string>();
  for (const g of games) {
    ids.add(g.homeTeamId);
    ids.add(g.awayTeamId);
  }
  return ids;
}