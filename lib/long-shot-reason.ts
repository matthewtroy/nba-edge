import type { Market, PlayerGameLog } from "./types.js";
import { statValue } from "./leg-history.js";
import { filterH2hLogs } from "./h2h-reason.js";
import { espnSeasonYearsForH2h } from "./h2h-season-logs.js";
import { shortTeamName } from "./ordinal.js";

export function nbaSeasonFloorForDate(isoDate: string): string {
  const d = new Date(isoDate.includes("T") ? isoDate : `${isoDate}T12:00:00Z`);
  const [current] = espnSeasonYearsForH2h(d);
  return `${current - 1}-10-01`;
}

/** Long-shot extra when season high vs this opponent clears the line. */
export function seasonCeilingVsOpponentPhrase(input: {
  logs: PlayerGameLog[];
  defendingTeamId?: string;
  opponentName?: string;
  market: Market;
  line: number;
  slateDate?: string;
}): string | undefined {
  const { defendingTeamId } = input;
  if (!defendingTeamId) return undefined;
  const floor = nbaSeasonFloorForDate(
    input.slateDate ?? input.logs[0]?.date ?? new Date().toISOString()
  );
  const vs = filterH2hLogs(input.logs, defendingTeamId, input.opponentName).filter(
    (g) => g.date.slice(0, 10) >= floor
  );
  if (!vs.length) return undefined;
  let best = -Infinity;
  for (const g of vs) {
    const v = statValue(g, input.market);
    if (v != null && v > best) best = v;
  }
  if (!Number.isFinite(best) || best < input.line) return undefined;
  const opp = shortTeamName(input.opponentName ?? defendingTeamId);
  const shown = Number.isInteger(best) ? String(best) : best.toFixed(1);
  return `Best this season: ${shown} vs ${opp}`;
}

export function formerTeamReasonPhrase(
  legTags: string[] | undefined,
  opponentName: string
): string | undefined {
  const tags = legTags ?? [];
  const hasFormer = tags.some(
    (t) => t === "former_team" || t.toLowerCase() === "former team"
  );
  if (!hasFormer) return undefined;
  return `Former team vs ${shortTeamName(opponentName)}`;
}