import type { SlateGame } from "../../lib/types.js";
import { mapOddsMarket } from "../../lib/odds.js";
import { normalizePlayerName } from "../../lib/player-names.js";

export async function fetchOddsForSlate(
  apiKey: string,
  games: SlateGame[]
): Promise<{
  events: unknown[];
  headers: { remaining?: number; used?: number };
}> {
  const sport = "basketball_nba";
  const regions = "au";
  const oddsFormat = "decimal";
  const markets = [
    "player_points",
    "player_rebounds",
    "player_assists",
    "player_threes",
  ].join(",");

  const events: unknown[] = [];
  let remaining: number | undefined;
  let used: number | undefined;

  for (const g of games) {
    const url = `https://api.the-odds-api.com/v4/sports/${sport}/events/${g.id}/odds?apiKey=${apiKey}&regions=${regions}&oddsFormat=${oddsFormat}&markets=${markets}`;
    const res = await fetch(url);
    const rem = res.headers.get("x-requests-remaining");
    const us = res.headers.get("x-requests-used");
    if (rem) remaining = Number(rem);
    if (us) used = Number(us);
    if (res.ok) events.push(await res.json());
  }

  return { events, headers: { remaining, used } };
}

export function extractBestOddsFromEvents(
  events: unknown[]
): Map<string, { price: number; bookie: string }> {
  const map = new Map<string, { price: number; bookie: string }>();
  for (const ev of events) {
    const e = ev as {
      bookmakers?: {
        title: string;
        markets?: { key: string; outcomes?: { name: string; price: number; description?: string }[] }[];
      }[];
    };
    for (const bm of e.bookmakers ?? []) {
      if (bm.title.toLowerCase().includes("bet365")) continue;
      for (const market of bm.markets ?? []) {
        const mKey = market.key.replace("player_", "").replace("threes", "3pm");
        for (const out of market.outcomes ?? []) {
          const player = out.description ?? out.name.split(" ")[0];
          const lineMatch = out.name.match(/(\d+)\+/);
          if (!lineMatch) continue;
          const line = Number(lineMatch[1]);
          const key = `${player}|${mKey}|${line}`;
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

export async function oddsCheckFirstGame(apiKey: string): Promise<void> {
  const url = `https://api.the-odds-api.com/v4/sports/basketball_nba/odds?apiKey=${apiKey}&regions=au&oddsFormat=decimal&markets=player_points,player_rebounds,player_assists,player_threes`;
  const res = await fetch(url);
  const remaining = res.headers.get("x-requests-remaining");
  const data = (await res.json()) as unknown[];
  const first = data[0] as { bookmakers?: { title: string; markets?: { key: string }[] }[] };
  const report = new Map<string, Set<string>>();
  for (const bm of first?.bookmakers ?? []) {
    const markets = new Set((bm.markets ?? []).map((m) => m.key));
    if (markets.size) report.set(bm.title, markets);
  }
  console.log("Remaining credits:", remaining ?? "unknown");
  for (const [book, mkts] of report) {
    console.log(`${book}: ${[...mkts].join(", ")}`);
  }
}