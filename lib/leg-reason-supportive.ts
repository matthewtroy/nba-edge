import type { PickLeg } from "./types.js";
import type { LegReason } from "./leg-reason-types.js";
import { reasonTextHasBannedPhrase } from "./reason-ban.js";
import { formReasonFromLeg, avgReasonFromLeg } from "./leg-reason-minimum.js";

const LONG_SHOT_P = 0.25;

function parseFormHits(text: string): { hits: number; total: number } | null {
  const m = text.match(/\b(\d+)\s*\/\s*(\d+)\s*(?:at this line|Q1 at line)/i);
  if (!m) return null;
  return { hits: Number(m[1]), total: Number(m[2]) };
}

function parseAvgLine(text: string): number | null {
  const m = text.match(/^avg ([\d.]+)/i);
  if (!m) return null;
  const v = Number(m[1]);
  return Number.isFinite(v) ? v : null;
}

function parsePositionRank(text: string): { avg: number; rank: number } | null {
  const m = text.match(/^averages ([\d.]+).+?\b(\d+)(?:st|nd|rd|th) of \d+/i);
  if (!m) return null;
  const avg = Number(m[1]);
  const rank = Number(m[2]);
  if (!Number.isFinite(avg) || !Number.isFinite(rank)) return null;
  return { avg, rank };
}

export function rankTextIsSupportive(text: string, leg: PickLeg): boolean {
  const parsed = parsePositionRank(text);
  if (!parsed) return false;
  if (parsed.rank > 15) return false;
  return parsed.avg >= leg.line;
}

/** Vague opponent copy stays out of supportive set (named lines only). */
function injurySupportive(text: string): boolean {
  if (/^opponent missing/i.test(text)) return false;
  return /out\s*(?:→|:)|without .+ →|only big left/i.test(text);
}

export function formImpliedMinHitRate(decimalPrice?: number | null): number | null {
  if (decimalPrice == null || decimalPrice <= 1) return null;
  return 1 / decimalPrice;
}

export function formTextIsSupportive(
  text: string,
  probability: number,
  minHitRate?: number | null
): boolean {
  const parsed = parseFormHits(text);
  if (!parsed || parsed.total < 1) return false;
  const rate = parsed.hits / parsed.total;
  if (minHitRate != null && rate + 1e-9 < minHitRate) return false;
  if (probability < LONG_SHOT_P) {
    return parsed.hits >= 2 && rate > probability;
  }
  if (minHitRate != null) return true;
  return rate >= 0.6 || (parsed.total === 5 && parsed.hits === 5);
}

export function avgTextIsSupportive(text: string, leg: PickLeg): boolean {
  const avg = parseAvgLine(text);
  if (avg == null || avg < leg.line) return false;
  const logged = (leg.lastTenStatValues ?? []).filter((v) => v != null).length;
  if (/last 10/i.test(text) && logged > 0 && logged < 10) {
    return false;
  }
  return true;
}

/** Single gated reason counts as supportive for display / pool gates. */
export function isSupportiveReason(reason: LegReason, leg: PickLeg): boolean {
  if (reasonTextHasBannedPhrase(reason.text)) return false;
  const p = leg.probability ?? 0;

  switch (reason.type) {
    case "injury":
      return injurySupportive(reason.text);
    case "tracking":
    case "matchup":
    case "h2h":
      if (/^best this season:/i.test(reason.text)) return p < LONG_SHOT_P;
      return true;
    case "pace":
    case "min":
      return true;
    case "angle":
      if (/^former team vs /i.test(reason.text)) return p < LONG_SHOT_P;
      return false;
    case "context":
      return true;
    case "form":
      return formTextIsSupportive(
        reason.text,
        p,
        formImpliedMinHitRate(leg.bestPrice)
      );
    case "avg":
      return avgTextIsSupportive(reason.text, leg);
    case "rank":
      return rankTextIsSupportive(reason.text, leg);
    default:
      return false;
  }
}

export function supportiveReasons(reasons: LegReason[], leg: PickLeg): LegReason[] {
  return reasons.filter((r) => isSupportiveReason(r, leg));
}

/** Backfill at most one supportive form or avg from frozen leg fields. */
export function supportiveBackfillFromLeg(
  leg: PickLeg,
  reasons: LegReason[]
): LegReason[] {
  const has = new Set(reasons.map((r) => r.type));
  const out = [...reasons];
  const formText = formReasonFromLeg(leg);
  if (
    formText &&
    !has.has("form") &&
    formTextIsSupportive(formText, leg.probability, formImpliedMinHitRate(leg.bestPrice))
  ) {
    out.push({ type: "form", text: formText });
    has.add("form");
  }
  const avgText = avgReasonFromLeg(leg);
  if (avgText && !has.has("avg") && avgTextIsSupportive(avgText, leg)) {
    out.push({ type: "avg", text: avgText });
  }
  return out;
}

export function logSupportiveExclusionsByMarket(
  picks: PickLeg[],
  kept: PickLeg[]
): void {
  const keptIds = new Set(kept.map((p) => p.id));
  const excluded: Record<string, number> = {};
  for (const leg of picks) {
    if (keptIds.has(leg.id)) continue;
    const m = leg.market;
    excluded[m] = (excluded[m] ?? 0) + 1;
  }
  for (const [market, n] of Object.entries(excluded).sort((a, b) => a[0].localeCompare(b[0]))) {
    console.log(`supportive exclude: ${market} ${n} legs`);
  }
}