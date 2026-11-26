import type { Market, PickLeg } from "./types.js";
import type { LegReason } from "./leg-reason-types.js";
import { gateLegReasons } from "./reason-gate.js";
import { houseReasonLine } from "./leg-reason-house.js";

function statKey(market: Market | string): "pts" | "reb" | "ast" | "threes" | "q1pts" | "q1reb" | "q1ast" {
  if (market === "3pm") return "threes";
  if (market.startsWith("q1")) return market as "q1pts" | "q1reb" | "q1ast";
  return market as "pts" | "reb" | "ast";
}

function marketToAvgWord(market: Market | string): string {
  if (market === "q1pts") return "Q1 pts";
  if (market === "q1reb") return "Q1 reb";
  if (market === "q1ast") return "Q1 ast";
  if (market === "3pm") return "3pm";
  return String(market);
}

/** Form line from leg snapshot (no line gate). */
export function formReasonFromLeg(leg: PickLeg): string | undefined {
  const market = leg.market;
  if (market.startsWith("q1")) {
    const hit = leg.q1SeasonHitAtLine;
    if (hit && hit.total >= 1) {
      return `${hit.hits}/${hit.total} Q1 at line`;
    }
    const rate = leg.q1Last10HitRate;
    if (rate != null) {
      return `${Math.round(rate * 10)}/10 Q1 at line`;
    }
    return undefined;
  }
  const rows = (leg.recentTenVsLine ?? leg.recentVsLine ?? []).filter(
    (t) => t !== "na"
  );
  if (rows.length < 2) return undefined;
  const hits = rows.filter((t) => t === "hit").length;
  const denom = Math.min(10, rows.length);
  return `${hits}/${denom} at this line`;
}

/** Avg line from leg snapshot (no line gate). */
export function avgReasonFromLeg(leg: PickLeg): string | undefined {
  const stat = statKey(leg.market);
  const word = marketToAvgWord(leg.market);
  const values = (leg.lastTenStatValues ?? []).filter(
    (v): v is number => v != null && Number.isFinite(v)
  );
  if (values.length >= 3) {
    const n = Math.min(10, values.length);
    const avg = values.slice(0, n).reduce((s, v) => s + v, 0) / n;
    const seasonVal = seasonStat(leg, stat);
    const lastLabel = n === 10 ? "last 10" : `last ${n}`;
    const suffix =
      seasonVal != null && seasonVal.toFixed(1) !== avg.toFixed(1)
        ? ` (season ${seasonVal.toFixed(1)})`
        : "";
    return `Avg ${avg.toFixed(1)} ${word} ${lastLabel}${suffix}`;
  }
  const lastFive = leg.lastFiveAvg;
  const season = leg.seasonAvg;
  const pick = pickStat(stat, lastFive, season);
  if (pick == null) return undefined;
  const seasonVal = seasonStat(leg, stat);
  const suffix =
    seasonVal != null && seasonVal.toFixed(1) !== pick.toFixed(1)
      ? ` (season ${seasonVal.toFixed(1)})`
      : "";
  const n = Math.min(10, (leg.lastTenStatValues ?? []).filter((v) => v != null && Number.isFinite(v)).length);
  const lastLabel = n === 10 ? "last 10" : n >= 3 ? `last ${n}` : "last 10";
  return `Avg ${pick.toFixed(1)} ${word} ${lastLabel}${suffix}`;
}

function seasonStat(
  leg: PickLeg,
  stat: ReturnType<typeof statKey>
): number | undefined {
  const season = leg.seasonAvg;
  if (!season) return undefined;
  if (stat === "threes") return season.threes;
  if (stat === "pts" || stat === "q1pts") return season.pts;
  if (stat === "reb" || stat === "q1reb") return season.reb;
  if (stat === "ast" || stat === "q1ast") return season.ast;
  return undefined;
}

function pickStat(
  stat: ReturnType<typeof statKey>,
  lastFive?: PickLeg["lastFiveAvg"],
  season?: PickLeg["seasonAvg"]
): number | undefined {
  if (stat === "threes") return lastFive?.threes ?? season?.threes;
  if (stat === "pts" || stat === "q1pts") return lastFive?.pts ?? season?.pts;
  if (stat === "reb" || stat === "q1reb") return lastFive?.reb ?? season?.reb;
  if (stat === "ast" || stat === "q1ast") return lastFive?.ast ?? season?.ast;
  return undefined;
}

function hasType(reasons: LegReason[], type: LegReason["type"]): boolean {
  return reasons.some((r) => r.type === type);
}

/** Every leg row: ≥2 reasons; pad with form/avg from snapshot when fewer than two. */
export function ensureLegReasonMinimum(
  leg: PickLeg,
  reasons: LegReason[]
): LegReason[] {
  let out = gateLegReasons(reasons, leg.market, 3);
  if (out.length >= 2) {
    return out.slice(0, 3).map((r) => ({
      ...r,
      text: houseReasonLine(r.text),
    }));
  }
  const formText = formReasonFromLeg(leg);
  const avgText = avgReasonFromLeg(leg);
  if (formText && !hasType(out, "form")) {
    out.push({ type: "form", text: houseReasonLine(formText) });
  }
  if (avgText && !hasType(out, "avg")) {
    out.push({ type: "avg", text: houseReasonLine(avgText) });
  }
  out = gateLegReasons(out, leg.market, 3);
  if (out.length < 2) {
    const forced: LegReason[] = [];
    if (formText) forced.push({ type: "form", text: houseReasonLine(formText) });
    if (avgText) forced.push({ type: "avg", text: houseReasonLine(avgText) });
    for (const r of forced) {
      if (!hasType(out, r.type)) out.push(r);
    }
    out = gateLegReasons(out, leg.market, 3);
  }
  if (out.length < 2) {
    for (const r of [
      formText ? ({ type: "form" as const, text: houseReasonLine(formText) }) : null,
      avgText ? ({ type: "avg" as const, text: houseReasonLine(avgText) }) : null,
    ]) {
      if (r && !out.some((x) => x.type === r.type)) out.push(r);
    }
  }
  return out.slice(0, 3).map((r) => ({
    ...r,
    text: houseReasonLine(r.text),
  }));
}

export function legRowReasonCountShouldBeAtLeast2(
  reasons: LegReason[],
  leg: PickLeg
): boolean {
  return ensureLegReasonMinimum(leg, reasons).length >= 2;
}