import { normalizePlayerName } from "../../lib/player-names.js";
import { isOverOutcome, oddsApiMarketToLeg, overLineToModelRung } from "../../lib/odds.js";
import {
  ODDS_COMBO_MARKETS,
  ODDS_CORE_MARKETS,
  ODDS_THREES_MARKETS,
} from "../../lib/odds-coverage.js";
import type { SlateGame } from "../../lib/types.js";

export { ODDS_CORE_MARKETS, ODDS_THREES_MARKETS };

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
    ...ODDS_CORE_MARKETS,
    ...ODDS_THREES_MARKETS,
    ...ODDS_COMBO_MARKETS,
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
  return extractOddsBundles(events).best;
}

export function extractOddsBundles(events: unknown[]): {
  best: Map<string, { price: number; bookie: string }>;
  all: Map<string, Record<string, number>>;
} {
  const map = new Map<string, { price: number; bookie: string }>();
  const all = new Map<string, Record<string, number>>();
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
        const mKey = oddsApiMarketToLeg(market.key);
        for (const out of market.outcomes ?? []) {
          const combo = mKey === "dd" || mKey === "td";
          if (combo) {
            if (!/yes/i.test(out.name ?? "") && !isOverOutcome(out.name ?? "")) continue;
          } else if (!isOverOutcome(out.name ?? "")) continue;
          let player = out.description?.trim() ?? "";
          if (!player && out.name) {
            const m = out.name.match(/^(.+?)\s+Over/i);
            player = (m?.[1] ?? out.name.split(" ").slice(0, 2).join(" ")).trim();
          }
          if (!player) continue;
          const raw = out.point ?? Number(out.name.match(/over\s+(\d+(?:\.\d+)?)/i)?.[1]);
          if (raw == null || !Number.isFinite(raw)) continue;
          const plus = out.name.match(/(\d+)\s*\+/);
          let modelLine = plus ? Number(plus[1]) : overLineToModelRung(raw);
          if (mKey === "dd" || mKey === "td") modelLine = 1;
          if (modelLine < 1) continue;
          const key = `${normalizePlayerName(player)}|${mKey}|${modelLine}`;
          const prev = map.get(key);
          if (!prev || out.price > prev.price) {
            map.set(key, { price: out.price, bookie: bm.title });
          }
          const books = all.get(key) ?? {};
          const cur = books[bm.title];
          if (cur == null || out.price > cur) books[bm.title] = out.price;
          all.set(key, books);
        }
      }
    }
  }
  return { best: map, all };
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