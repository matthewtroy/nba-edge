import { normalizePlayerName } from "../../lib/player-names.js";
import type { SlateGame } from "../../lib/types.js";

export async function listOddsEvents(
  apiKey: string
): Promise<{ events: { id: string; home_team: string; away_team: string; commence_time: string }[]; remaining?: number }> {
  const url = `https://api.the-odds-api.com/v4/sports/basketball_nba/events?apiKey=${apiKey}`;
  const res = await fetch(url);
  const remaining = res.headers.get("x-requests-remaining");
  if (!res.ok) return { events: [] };
  const events = (await res.json()) as { id: string; home_team: string; away_team: string; commence_time: string }[];
  return { events, remaining: remaining ? Number(remaining) : undefined };
}

function teamToken(name: string): string {
  return name.toLowerCase().split(" ").pop() ?? name;
}

export function matchOddsEventId(game: SlateGame, events: { id: string; home_team: string; away_team: string }[]): string | undefined {
  const home = teamToken(game.homeTeam);
  const away = teamToken(game.awayTeam);
  const hit = events.find(
    (e) =>
      teamToken(e.home_team).includes(home) ||
      home.includes(teamToken(e.home_team)) ||
      (teamToken(e.away_team).includes(away) || away.includes(teamToken(e.away_team)))
  );
  return hit?.id;
}

export async function fetchOddsForEvent(
  apiKey: string,
  eventId: string
): Promise<{ data: unknown; remaining?: number }> {
  const markets = [
    "player_points",
    "player_rebounds",
    "player_assists",
    "player_threes",
    "player_points_alternate",
    "player_rebounds_alternate",
    "player_assists_alternate",
    "player_threes_alternate",
  ].join(",");
  const url = `https://api.the-odds-api.com/v4/sports/basketball_nba/events/${eventId}/odds?apiKey=${apiKey}&regions=au&oddsFormat=decimal&markets=${markets}`;
  const res = await fetch(url);
  const remaining = res.headers.get("x-requests-remaining");
  return {
    data: res.ok ? await res.json() : null,
    remaining: remaining ? Number(remaining) : undefined,
  };
}

export function extractBestOddsFlexible(events: unknown[]): Map<string, { price: number; bookie: string }> {
  const map = new Map<string, { price: number; bookie: string }>();
  for (const ev of events) {
    if (!ev) continue;
    const e = ev as {
      bookmakers?: {
        title: string;
        markets?: { key: string; outcomes?: { name: string; price: number; description?: string; point?: number }[] }[];
      }[];
    };
    for (const bm of e.bookmakers ?? []) {
      if (bm.title.toLowerCase().includes("bet365")) continue;
      for (const market of bm.markets ?? []) {
        const mKey = market.key
          .replace("player_", "")
          .replace("_alternate", "")
          .replace("threes", "3pm");
        for (const out of market.outcomes ?? []) {
          if (!out.name?.toLowerCase().includes("over")) continue;
          const player = out.description ?? "";
          if (!player) continue;
          const line = out.point ?? Number(out.name.match(/(\d+(?:\.\d+)?)/)?.[1]);
          if (!line) continue;
          const lineInt = Math.floor(line);
          const key = `${normalizePlayerName(player)}|${mKey}|${lineInt}`;
          const prev = map.get(key);
          if (!prev || out.price > prev.price) {
            map.set(key, { price: out.price, bookie: bm.title });
          }
        }
      }
    }
  }
  return map;
}

/** Map model lookup keys to normalized map */
export function oddsMapForPricing(
  normalized: Map<string, { price: number; bookie: string }>
): Map<string, { price: number; bookie: string }> {
  const map = new Map<string, { price: number; bookie: string }>();
  for (const [k, v] of normalized) {
    map.set(k, v);
    const [name, market, line] = k.split("|");
    const displayKey = `${name}|${market}|${line}`;
    map.set(displayKey, v);
  }
  return map;
}