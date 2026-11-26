import type { Market } from "./types.js";
import {
  type LegReason,
  normalizeLegReasons,
  reasonMatchesMarket,
  sortLegReasons,
} from "./leg-reason-types.js";
import { reasonTextHasBannedPhrase } from "./reason-ban.js";

const PLAUSIBILITY = {
  fga: 35,
  minutes: 48,
  pts: 60,
  reb: 25,
  ast: 20,
} as const;

function normalizeFactKey(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/\d+\.\d+/g, "#")
    .replace(/\d+/g, "#")
    .trim();
}

/** Reject reason copy with impossible stat numbers (e.g. mis-parsed ESPN rows). */
export function reasonPassesPlausibility(text: string): boolean {
  const avgSeasonDup = text.match(/^avg ([\d.]+).* \(season ([\d.]+)\)/i);
  if (
    avgSeasonDup &&
    Number(avgSeasonDup[1]).toFixed(1) === Number(avgSeasonDup[2]).toFixed(1)
  ) {
    return false;
  }
  const t = text.toLowerCase();
  if (/rank #\d+ in allowing/i.test(text)) return true;
  if (/allow [\d.]+\s+(pts|reb|ast|threes)/i.test(text) && /per game|to guards|to forwards|to centers/i.test(text)) {
    return true;
  }
  const nums = [...text.matchAll(/([\d.]+)\s*(fga|min|mins|minutes|pts|points|reb|rebounds|ast|assists)/gi)];
  for (const m of nums) {
    const v = Number(m[1]);
    if (!Number.isFinite(v)) continue;
    const unit = m[2].toLowerCase();
    if (unit.startsWith("fga") && v > PLAUSIBILITY.fga) return false;
    if ((unit.startsWith("min") || unit === "minutes") && v > PLAUSIBILITY.minutes)
      return false;
    if ((unit.startsWith("pt") || unit === "points") && v > PLAUSIBILITY.pts) return false;
    if ((unit.startsWith("reb") || unit === "rebounds") && v > PLAUSIBILITY.reb) return false;
    if ((unit.startsWith("ast") || unit === "assists") && v > PLAUSIBILITY.ast)
      return false;
  }
  const formHit = t.match(/\b(\d+)\s*\/\s*(\d+)\s*at this line/);
  if (formHit) {
    const hits = Number(formHit[1]);
    const denom = Number(formHit[2]);
    if (denom > 10 || hits > denom) return false;
  }
  return true;
}

export function gateLegReason(
  reason: LegReason,
  market: Market | string
): boolean {
  if (reasonTextHasBannedPhrase(reason.text)) return false;
  if (!reasonPassesPlausibility(reason.text)) return false;
  const stat = market.replace(/^q1/, "");
  if (reason.type === "rank" || reason.type === "form") return true;
  return reasonMatchesMarket(reason, market, stat);
}

/** Shared builder + UI gate: stat match, bans, plausibility, dedupe facts. Max 3 lines. */
function parseAvgLast10(text: string): number | null {
  const m = text.match(/^avg ([\d.]+)/i);
  if (!m) return null;
  const v = Number(m[1]);
  return Number.isFinite(v) ? v : null;
}

function parseRankAvg(text: string): number | null {
  const m = text.match(/averages ([\d.]+)/i);
  if (!m) return null;
  const v = Number(m[1]);
  return Number.isFinite(v) ? v : null;
}

/** Drop redundant "Avg last 10" when rank avg matches (1 dec) or avg ≤ line. */
export function dropRedundantAvgReasons(
  reasons: LegReason[],
  line: number
): LegReason[] {
  const rank = reasons.find((r) => r.type === "rank");
  const rankAvg = rank ? parseRankAvg(rank.text) : null;
  return reasons.filter((r) => {
    if (r.type !== "avg") return true;
    const avg = parseAvgLast10(r.text);
    if (avg == null) return true;
    if (avg <= line) return false;
    if (rankAvg != null && avg.toFixed(1) === rankAvg.toFixed(1)) return false;
    return true;
  });
}

/** Priced legs on high rungs should show at least two fact lines in UI. */
export function minReasonLinesForRung(market: Market | string, line: number): number {
  const stat = market.replace(/^q1/, "");
  if (stat === "pts" && line >= 25) return 2;
  if (stat === "ast" && line >= 7) return 2;
  if (stat === "reb" && line >= 12) return 2;
  if (stat === "3pm" && line >= 4) return 2;
  return 1;
}

export function gateLegReasons(
  reasons: unknown,
  market: Market | string,
  maxLines = 3,
  line?: number
): LegReason[] {
  const minLines = line != null ? minReasonLinesForRung(market, line) : 1;
  let sorted = sortLegReasons(normalizeLegReasons(reasons));
  if (line != null) {
    sorted = dropRedundantAvgReasons(sorted, line);
  }
  const seen = new Set<string>();
  const out: LegReason[] = [];
  for (const r of sorted) {
    if (!gateLegReason(r, market)) continue;
    const key = normalizeFactKey(r.text);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(r);
    if (out.length >= maxLines) break;
  }
  if (out.length < minLines) {
    const retry = sortLegReasons(normalizeLegReasons(reasons));
    seen.clear();
    out.length = 0;
    for (const r of retry) {
      if (!gateLegReason(r, market)) continue;
      const key = normalizeFactKey(r.text);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(r);
      if (out.length >= maxLines) break;
    }
  }
  return out;
}