import type { Market, PickLeg, PlayerGameLog } from "./types.js";
import { lastFiveVsLine } from "./leg-history.js";
import { logsForModelRates } from "./baseline.js";

export const FORM_GAP_PP = 0.2;

function hitRateL10(logs: PlayerGameLog[], market: Market, line: number): number | null {
  const sorted = [...logs].sort((a, b) => b.date.localeCompare(a.date));
  let hits = 0;
  let n = 0;
  for (const g of sorted.slice(0, 10)) {
    let v: number | null = null;
    if (market === "3pm") v = g.threes;
    else if (market === "pts" || market === "reb" || market === "ast") v = g[market];
    else if (market === "q1pts") v = g.q1Pts ?? null;
    else if (market === "q1reb") v = g.q1Reb ?? null;
    else if (market === "q1ast") v = g.q1Ast ?? null;
    else return null;
    if (v == null) continue;
    n += 1;
    if (v >= line) hits += 1;
  }
  if (n < 3) return null;
  return hits / n;
}

export function formGuardReason(
  leg: PickLeg,
  logs: PlayerGameLog[]
): string | null {
  const modelLogs = logsForModelRates(logs);
  const hr = hitRateL10(modelLogs, leg.market, leg.line);
  if (hr != null && leg.probability - hr > FORM_GAP_PP) {
    return `last-10 ${(hr * 100).toFixed(0)}% vs ${(leg.probability * 100).toFixed(0)}%`;
  }
  const l5 = lastFiveVsLine(modelLogs, leg.market, leg.line).filter((t) => t !== "na");
  if (l5.length === 5 && l5.every((t) => t === "miss") && leg.probability < 0.5) {
    return "0/5 at line, p<50%";
  }
  return null;
}

export function applyFormGuardExclusions(
  picks: PickLeg[],
  logsByPlayer: Map<string, PlayerGameLog[]>
): number {
  let n = 0;
  for (const leg of picks) {
    const logs = logsByPlayer.get(leg.playerId) ?? [];
    const reason = formGuardReason(leg, logs);
    if (!reason) continue;
    leg.formGuardExcluded = true;
    leg.tags = leg.tags.filter((t) => t !== "Value");
    n += 1;
  }
  if (n > 0) console.log(`form guard: excluded ${n} legs`);
  return n;
}

export function passesFormGuard(leg: PickLeg): boolean {
  return leg.formGuardExcluded !== true;
}