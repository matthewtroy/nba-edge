import type { SlateGame } from "./types.js";

export const PUBLISH_NOW_MIN_GAMES = 8;

export type OddsEventRow = {
  id: string;
  home_team: string;
  away_team: string;
  commence_time?: string;
};

/** True when AU bookmakers return at least one core player prop market. */
export function eventHasAuPlayerProps(data: unknown): boolean {
  if (!data || typeof data !== "object") return false;
  const e = data as {
    bookmakers?: { markets?: { key: string; outcomes?: unknown[] }[] }[];
  };
  const core = new Set([
    "player_points",
    "player_points_alternate",
    "player_rebounds",
    "player_rebounds_alternate",
    "player_assists",
    "player_assists_alternate",
  ]);
  for (const bm of e.bookmakers ?? []) {
    for (const m of bm.markets ?? []) {
      if (core.has(m.key) && (m.outcomes?.length ?? 0) > 0) return true;
    }
  }
  return false;
}

function teamToken(name: string): string {
  return name.toLowerCase().split(" ").pop() ?? name;
}

export function matchOddsEventIdForGame(
  game: SlateGame,
  events: OddsEventRow[]
): string | undefined {
  const home = teamToken(game.homeTeam);
  const away = teamToken(game.awayTeam);
  const hit = events.find(
    (ev) =>
      teamToken(ev.home_team).includes(home) ||
      home.includes(teamToken(ev.home_team)) ||
      teamToken(ev.away_team).includes(away) ||
      away.includes(teamToken(ev.away_team))
  );
  return hit?.id;
}

/**
 * After one AU props probe, count slate games with props listed (matched events on the board).
 */
export function countPropsListedGames(
  slate: SlateGame[],
  events: OddsEventRow[],
  probedEventId: string | undefined,
  probedHasAuProps: boolean
): { listed: number; total: number } {
  const total = slate.length;
  if (!probedHasAuProps) return { listed: 0, total };
  let listed = 0;
  for (const g of slate) {
    const id = matchOddsEventIdForGame(g, events);
    if (id) listed += 1;
  }
  return { listed, total };
}

export function publishNowProbeSkipMessage(listed: number, total: number): string {
  return `publish_now skipped: props listed for ${listed}/${total} games`;
}

export function publishNowReady(listed: number, minGames = PUBLISH_NOW_MIN_GAMES): boolean {
  return listed >= minGames;
}