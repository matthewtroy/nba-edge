import type { LegSignalDetail, LegSignals, Market, PickLeg, PlayerGameLog } from "./types.js";
import { hasValueAtBookie } from "./value-at-bookie.js";
import type { DefenseRatingsBundle } from "./defense-ratings.js";
import { defenseRankFor, paceRank } from "./defense-ratings.js";

function hitRateL10(logs: PlayerGameLog[], market: Market, line: number): number | null {
  const sorted = [...logs].sort((a, b) => b.date.localeCompare(a.date));
  let hits = 0;
  let n = 0;
  for (const g of sorted.slice(0, 10)) {
    let v: number | null = null;
    if (market === "3pm") v = g.threes;
    else if (market === "pts" || market === "reb" || market === "ast") v = g[market];
    else continue;
    n += 1;
    if (v >= line) hits += 1;
  }
  if (n < 3) return null;
  return hits / n;
}

function minutesTrendOk(logs: PlayerGameLog[], seasonMinutes: number): boolean {
  const sorted = [...logs].sort((a, b) => b.date.localeCompare(a.date));
  const l5 = sorted.slice(0, 5);
  if (l5.length < 3 || seasonMinutes < 1) return false;
  const avg = l5.reduce((s, g) => s + g.minutes, 0) / l5.length;
  return avg >= seasonMinutes * 0.9;
}

function plainSignalText(
  key: "PRICE" | "MATCHUP" | "FORM" | "ANGLE",
  active: boolean,
  opts: { rank?: number; hits?: number; n?: number; injury?: boolean }
): string | undefined {
  if (!active) return undefined;
  switch (key) {
    case "PRICE":
      return "Line beats model";
    case "MATCHUP":
      return opts.rank != null ? `Soft defence rank ${opts.rank}` : "Soft matchup";
    case "FORM":
      return opts.hits != null && opts.n
        ? `Hit ${opts.hits} of last ${opts.n}`
        : "Recent form strong";
    case "ANGLE":
      return opts.injury ? "Injury uplift" : "Angle";
    default:
      return undefined;
  }
}

export function buildLegSignals(input: {
  leg: PickLeg;
  logs: PlayerGameLog[];
  seasonMinutes: number;
  defendingTeamId?: string;
  playerPosition?: string;
  defense?: DefenseRatingsBundle;
  injuryAngle: boolean;
  myBookie?: string;
}): LegSignals {
  const unavailable: string[] = [];
  const signals: LegSignals = { context: {}, unavailable: [] };

  const priceActive =
    input.leg.tags.includes("Value") ||
    (input.myBookie
      ? hasValueAtBookie(input.leg, input.myBookie)
      : input.leg.bestPrice != null && input.leg.bestPrice >= input.leg.takeAt);

  let matchupRank: number | undefined;
  if (input.defense && input.defendingTeamId) {
    matchupRank = defenseRankFor(
      input.defense,
      input.defendingTeamId,
      input.playerPosition,
      input.leg.market
    );
  } else unavailable.push("MATCHUP");
  const matchupActive = matchupRank != null && matchupRank <= 8;

  const hr = hitRateL10(input.logs, input.leg.market, input.leg.line);
  const formMinOk = minutesTrendOk(input.logs, input.seasonMinutes);
  const formActive = hr != null && hr >= 0.6 && formMinOk;
  if (hr == null) unavailable.push("FORM");
  const hits = hr != null ? Math.round(hr * Math.min(10, input.logs.length)) : undefined;
  const n = hr != null ? Math.min(10, input.logs.filter((g) => g.minutes > 0).length) : undefined;

  signals.PRICE = {
    active: priceActive,
    label: plainSignalText("PRICE", priceActive, {}),
  };
  signals.MATCHUP = {
    active: matchupActive,
    label: plainSignalText("MATCHUP", matchupActive, { rank: matchupRank }),
  };
  signals.FORM = {
    active: formActive,
    label: plainSignalText("FORM", formActive, { hits, n }),
  };
  signals.ANGLE = {
    active: input.injuryAngle,
    label: plainSignalText("ANGLE", input.injuryAngle, { injury: true }),
  };

  if (input.defense && input.defendingTeamId) {
    const pr = paceRank(input.defense, input.defendingTeamId);
    if (pr != null) signals.context!.pace = `Pace rank ${pr}`;
    else unavailable.push("pace");
  }

  const sorted = [...input.logs].sort((a, b) => b.date.localeCompare(a.date));
  const vsOpp = sorted
    .filter((g) => g.opponentTeamId === input.defendingTeamId)
    .slice(0, 3);
  if (vsOpp.length) {
    const avg =
      input.leg.market === "3pm"
        ? vsOpp.reduce((s, g) => s + g.threes, 0) / vsOpp.length
        : input.leg.market === "pts" || input.leg.market === "reb" || input.leg.market === "ast"
          ? vsOpp.reduce((s, g) => s + g[input.leg.market], 0) / vsOpp.length
          : 0;
    signals.context!.h2h = `Last 3 vs opp avg ${avg.toFixed(1)}`;
  } else unavailable.push("h2h");

  if (input.leg.b2b) signals.context!.b2b = "Back-to-back";

  signals.unavailable = unavailable;
  return signals;
}

export function confluenceFromSignals(signals: LegSignals): number {
  let n = 0;
  if (signals.PRICE?.active) n += 1;
  if (signals.MATCHUP?.active) n += 1;
  if (signals.FORM?.active) n += 1;
  if (signals.ANGLE?.active) n += 1;
  return n;
}

const STRENGTH: Record<string, number> = {
  PRICE: 4,
  MATCHUP: 3,
  FORM: 2,
  ANGLE: 1,
};

/** Plain English: two strongest active signals, ≤80 chars. */
export function reasonLineFromSignals(signals: LegSignals): string {
  const parts: { label: string; weight: number }[] = [];
  for (const key of ["PRICE", "MATCHUP", "FORM", "ANGLE"] as const) {
    const s = signals[key];
    if (s?.active && s.label) parts.push({ label: s.label, weight: STRENGTH[key] });
  }
  parts.sort((a, b) => b.weight - a.weight);
  return parts
    .slice(0, 2)
    .map((p) => p.label)
    .join(" · ")
    .slice(0, 80);
}

export function mainPlayConfluenceOk(leg: PickLeg): boolean {
  if ((leg.confluence ?? 0) < 2) return false;
  if (!leg.signals?.PRICE?.active) return false;
  return Boolean(
    leg.signals.MATCHUP?.active ||
      leg.signals.FORM?.active ||
      leg.signals.ANGLE?.active
  );
}