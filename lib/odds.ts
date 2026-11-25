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

/** The Odds API market key → model leg market */
export function oddsApiMarketToLeg(apiMarket: string): string {
  const base = apiMarket.replace("player_", "").replace("_alternate", "");
  const map: Record<string, string> = {
    points: "pts",
    rebounds: "reb",
    assists: "ast",
    threes: "3pm",
    double_double: "dd",
    triple_double: "td",
  };
  return map[base] ?? base;
}

/** Cache / legacy map keys may use `points` instead of model `pts`. */
export function normalizeLegMarket(market: string): string {
  const base = market.toLowerCase().replace("player_", "").replace("_alternate", "");
  const map: Record<string, string> = {
    points: "pts",
    rebounds: "reb",
    assists: "ast",
    threes: "3pm",
    pts: "pts",
    reb: "reb",
    ast: "ast",
    "3pm": "3pm",
  };
  return map[base] ?? market;
}

export function legOddsLookupKey(
  playerName: string,
  market: string,
  line: number
): string {
  return `${normalizePlayerName(playerName)}|${market}|${line}`;
}

/** Bookie "Over" point → model X+ rung (Over 0.5 → 1+, Over 1.5 → 2+, Over 24.5 → 25+). */
export function overLineToModelRung(bookieLine: number): number {
  if (!Number.isFinite(bookieLine) || bookieLine < 0) return 0;
  const frac = Math.abs((bookieLine % 1) - 0.5);
  if (frac < 1e-6 || frac > 1 - 1e-6) {
    return Math.floor(bookieLine) + 1;
  }
  return Math.ceil(bookieLine);
}

export function isOverOutcome(name: string): boolean {
  const n = name.toLowerCase();
  if (n.includes("under")) return false;
  return n.includes("over") || /\d+\s*\+/.test(name);
}