import type { PlayerGameLog } from "./types.js";
import { NBA_SEASON_OPENING_UTC } from "./pricing-config.js";

const WEIGHTS = { season: 0.5, last10: 0.3, last5: 0.2 };

function logSeasonDate(date: string | undefined): string {
  if (!date) return "";
  return date.slice(0, 10);
}

/** Rates use only this-season ESPN player game logs (not league boxscore backfill). */
export function logsForModelRates(logs: PlayerGameLog[]): PlayerGameLog[] {
  return logs.filter((g) => {
    if (g.source === "boxscore") return false;
    const d = logSeasonDate(g.date);
    if (d && d < NBA_SEASON_OPENING_UTC) return false;
    return g.minutes >= 1 && g.pts + g.reb + g.ast + g.threes > 0;
  });
}

export interface PerMinuteRates {
  pts: number;
  reb: number;
  ast: number;
  threes: number;
}

export function perMinuteRates(logs: PlayerGameLog[]): PerMinuteRates | null {
  const played = logsForModelRates(logs);
  if (played.length < 3) return null;

  const avgMin =
    played.reduce((s, g) => s + g.minutes, 0) / played.length;
  if (avgMin < 12) return null;

  const blend = (getter: (g: PlayerGameLog) => number) => {
    const last5 = played.slice(0, 5);
    const last10 = played.slice(0, 10);
    const season = played;
    const rate = (arr: PlayerGameLog[]) => {
      const mins = arr.reduce((s, g) => s + g.minutes, 0);
      if (mins === 0) return 0;
      return arr.reduce((s, g) => s + getter(g), 0) / mins;
    };
    return (
      WEIGHTS.season * rate(season) +
      WEIGHTS.last10 * rate(last10) +
      WEIGHTS.last5 * rate(last5)
    );
  };

  return {
    pts: blend((g) => g.pts),
    reb: blend((g) => g.reb),
    ast: blend((g) => g.ast),
    threes: blend((g) => g.threes),
  };
}

export function projectedMinutes(logs: PlayerGameLog[]): number {
  const played = logsForModelRates(logs);
  if (played.length === 0) return 0;
  const last5 = played.slice(0, 5).map((g) => g.minutes);
  last5.sort((a, b) => a - b);
  const mid = Math.floor(last5.length / 2);
  const median =
    last5.length % 2 === 0
      ? (last5[mid - 1] + last5[mid]) / 2
      : last5[mid];
  const seasonAvg =
    played.reduce((s, g) => s + g.minutes, 0) / played.length;
  return median * 0.7 + seasonAvg * 0.3;
}

export interface ProjectedStats {
  pts: number;
  reb: number;
  ast: number;
  threes: number;
  minutes: number;
}

export function projectBaseline(
  rates: PerMinuteRates,
  minutes: number
): ProjectedStats {
  return {
    pts: rates.pts * minutes,
    reb: rates.reb * minutes,
    ast: rates.ast * minutes,
    threes: rates.threes * minutes,
    minutes,
  };
}

function logsWithQ1Stat(logs: PlayerGameLog[], stat: "pts" | "reb" | "ast"): PlayerGameLog[] {
  return logs.filter((g) => {
    if (g.minutes < 1 || g.pts <= 0) return false;
    if (stat === "pts") return g.q1Pts !== undefined;
    if (stat === "reb") return g.q1Reb !== undefined;
    return g.q1Ast !== undefined;
  });
}

export function q1Share(logs: PlayerGameLog[], stat: "pts" | "reb" | "ast"): number {
  const withQ1 = logsWithQ1Stat(logs, stat);
  if (withQ1.length < 3) return 0.26;
  let q1 = 0;
  let full = 0;
  for (const g of withQ1.slice(0, 10)) {
    if (stat === "pts") {
      q1 += g.q1Pts ?? 0;
      full += g.pts;
    } else if (stat === "reb") {
      q1 += g.q1Reb ?? 0;
      full += g.reb;
    } else {
      q1 += g.q1Ast ?? 0;
      full += g.ast;
    }
  }
  if (full <= 0) return 0.26;
  return q1 / full;
}