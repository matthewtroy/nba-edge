import type { SourceHealth } from "./types.js";
import { namesMatch, normalizePlayerName } from "./player-names.js";

export interface OddsPullResult {
  byLegKey: Map<string, { price: number; bookie: string }>;
  pulledAt: string;
  creditsRemaining?: number;
  creditsUsed?: number;
  paused: boolean;
  health: SourceHealth | string;
}

export function shouldPauseOdds(
  remaining: number | undefined,
  totalMonthly = 500
): boolean {
  if (remaining === undefined) return false;
  return remaining < totalMonthly * 0.2;
}

export function parseOddsKey(player: string, market: string, line: number): string {
  return `${player}|${market}|${line}`;
}

export function bestAuPrice(
  outcomes: { name: string; price: number; bookmaker: string }[],
  playerName: string,
  line: number
): { price: number; bookie: string } | undefined {
  const matches = outcomes.filter(
    (o) =>
      namesMatch(o.name, playerName) ||
      o.name.includes(`${line}+`) ||
      o.name.includes(`Over ${line}`)
  );
  if (matches.length === 0) return undefined;
  matches.sort((a, b) => b.price - a.price);
  return { price: matches[0].price, bookie: matches[0].bookmaker };
}

export function mapOddsMarket(market: string): string {
  const m: Record<string, string> = {
    pts: "player_points",
    reb: "player_rebounds",
    ast: "player_assists",
    "3pm": "player_threes",
  };
  return m[market] ?? market;
}