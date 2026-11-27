import { RUNGS } from "./pricing.js";
import type { Market, MultiBet, PickLeg } from "./types.js";

const LADDER_MARKETS = new Set(["pts", "reb", "ast", "3pm"]);

export function isOfficialLadderLine(market: string, line: number): boolean {
  if (market === "dd" || market === "td") return line === 1;
  if (!LADDER_MARKETS.has(market)) return false;
  const key = market === "3pm" ? "3pm" : market;
  return (RUNGS[key] ?? []).includes(line);
}

/** Pick ids on official multis must be model ladder rungs; Booster may step to the next rung only. */
export function assertOfficialLadderLegs(
  bets: MultiBet[],
  picksById: Map<string, PickLeg>
): { ok: boolean; offenders: string[] } {
  const offenders: string[] = [];
  const main = bets.find((b) => b.type === "mainPlay");
  const mainByPlayerMarket = new Map<string, number>();
  if (main) {
    for (const id of main.legs) {
      const leg = picksById.get(id);
      if (!leg) continue;
      mainByPlayerMarket.set(`${leg.playerId}|${leg.market}`, leg.line);
    }
  }

  for (const bet of bets) {
    if (bet.type === "q1Multi") continue;
    for (const id of bet.legs) {
      const leg = picksById.get(id);
      if (!leg) continue;
      if (isOfficialLadderLine(leg.market, leg.line)) continue;
      if (bet.type === "booster") {
        const mainLine = mainByPlayerMarket.get(`${leg.playerId}|${leg.market}`);
        if (mainLine != null && leg.line > mainLine) continue;
      }
      offenders.push(`${bet.type}:${leg.id} ${leg.market} ${leg.line}`);
    }
  }
  return { ok: offenders.length === 0, offenders };
}