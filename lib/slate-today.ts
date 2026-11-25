import type { SlateGame } from "./types.js";

const SYDNEY = "Australia/Sydney";

export function sydneyTipDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: SYDNEY });
}

function isFinalStatus(status: string): boolean {
  const s = status.toLowerCase();
  return s.includes("final") || s === "post";
}

/** Earliest Sydney tip date that still has unfinished games; exclude later dates */
export function filterSlateToTodaySydney(games: SlateGame[], _now = new Date()): SlateGame[] {
  const open = games.filter((g) => !isFinalStatus(g.status));
  if (open.length === 0) return [];

  const unfinishedDates = [...new Set(open.map((g) => sydneyTipDate(g.startTime)))].sort();
  const activeDate = unfinishedDates[0];

  return open.filter((g) => sydneyTipDate(g.startTime) === activeDate);
}

/** Second-earliest Sydney tip date among open games (tomorrow prep). */
export function filterSlateToNextSydney(games: SlateGame[]): SlateGame[] {
  const open = games.filter((g) => !isFinalStatus(g.status));
  if (open.length === 0) return [];

  const dates = [...new Set(open.map((g) => sydneyTipDate(g.startTime)))].sort();
  if (dates.length < 2) return [];
  const nextDate = dates[1];
  return open.filter((g) => sydneyTipDate(g.startTime) === nextDate);
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