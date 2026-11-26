import type { Market, PickLeg } from "./types.js";
import type { LegReason } from "./leg-reason-types.js";
import { gateLegReasons, minReasonLinesForRung } from "./reason-gate.js";
import { houseReasonLine, REASON_TEXT_MAX } from "./leg-reason-house.js";

function statKey(market: Market | string): "pts" | "reb" | "ast" | "threes" | "q1pts" | "q1reb" | "q1ast" {
  if (market === "3pm") return "threes";
  if (market.startsWith("q1")) return market as "q1pts" | "q1reb" | "q1ast";
  return market as "pts" | "reb" | "ast";
}

function formFromLeg(leg: PickLeg): string | undefined {
  const market = leg.market;
  if (market.startsWith("q1")) {
    const hit = leg.q1SeasonHitAtLine;
    if (hit && hit.total >= 3) {
      const rate = hit.hits / hit.total;
      if (rate >= 0.7) return `${hit.hits}/${hit.total} Q1 at line`;
    }
    const rate = leg.q1Last10HitRate;
    if (rate != null && rate >= 0.7) {
      const hits = Math.round(rate * 10);
      return `${hits}/10 Q1 at line`;
    }
    return undefined;
  }
  const rows = leg.recentTenVsLine ?? [];
  const scored = rows.filter((t) => t !== "na");
  if (scored.length < 3) return undefined;
  const hits = scored.filter((t) => t === "hit").length;
  if (hits >= 7) return `${hits}/10 at this line`;
  const l5 = (leg.recentVsLine ?? []).filter((t) => t !== "na");
  if (l5.length === 5 && l5.every((t) => t === "hit")) return "5/5 at this line";
  if (scored.length >= 3) return `${hits}/${scored.length} at this line`;
  return undefined;
}

function avgFallbackFromLeg(leg: PickLeg): string | undefined {
  const stat = statKey(leg.market);
  const lastFive = leg.lastFiveAvg;
  const season = leg.seasonAvg;
  const pick =
    stat === "threes"
      ? lastFive?.threes ?? season?.threes
      : stat === "pts"
        ? lastFive?.pts ?? season?.pts
        : stat === "reb"
          ? lastFive?.reb ?? season?.reb
          : lastFive?.ast ?? season?.ast;
  if (pick == null) return undefined;
  const seasonVal =
    stat === "threes"
      ? season?.threes
      : stat === "pts"
        ? season?.pts
        : stat === "reb"
          ? season?.reb
          : season?.ast;
  const word = marketToAvgWord(leg.market);
  const suffix = seasonVal != null ? ` (season ${seasonVal.toFixed(1)})` : "";
  return `Avg ${pick.toFixed(1)} ${word} last 5${suffix}`;
}

function avgFromLeg(leg: PickLeg): string | undefined {
  const stat = statKey(leg.market);
  const values = leg.lastTenStatValues ?? [];
  if (values.length < 5) {
    const lastFive = leg.lastFiveAvg;
    const season = leg.seasonAvg;
    if (!lastFive && !season) return undefined;
    const pick =
      stat === "threes"
        ? lastFive?.threes ?? season?.threes
        : stat === "pts"
          ? lastFive?.pts ?? season?.pts
          : stat === "reb"
            ? lastFive?.reb ?? season?.reb
            : lastFive?.ast ?? season?.ast;
    if (pick == null || pick < leg.line) return undefined;
    const seasonVal =
      stat === "threes" ? season?.threes : stat === "pts" ? season?.pts : stat === "reb" ? season?.reb : season?.ast;
    const word =
      stat === "threes"
        ? "3pm"
        : stat === "q1pts"
          ? "Q1 pts"
          : stat === "q1reb"
            ? "Q1 reb"
            : stat === "q1ast"
              ? "Q1 ast"
              : stat;
    const suffix = seasonVal != null ? ` (season ${seasonVal.toFixed(1)})` : "";
    return `Avg ${pick.toFixed(1)} ${word} last 10${suffix}`;
  }
  let sum = 0;
  let n = 0;
  for (const v of values.slice(0, 10)) {
    if (v == null || !Number.isFinite(v)) continue;
    sum += v;
    n += 1;
  }
  if (n < 5) return undefined;
  const avg = sum / n;
  if (avg < leg.line) return undefined;
  const season = leg.seasonAvg;
  const seasonStat =
    stat === "threes"
      ? season?.threes
      : stat === "pts"
        ? season?.pts
        : stat === "reb"
          ? season?.reb
          : stat === "ast"
            ? season?.ast
            : undefined;
  const word =
    stat === "threes"
      ? "3pm"
      : marketToAvgWord(leg.market);
  const suffix = seasonStat != null ? ` (season ${seasonStat.toFixed(1)})` : "";
  return `Avg ${avg.toFixed(1)} ${word} last 10${suffix}`;
}

function marketToAvgWord(market: Market | string): string {
  if (market === "q1pts") return "Q1 pts";
  if (market === "q1reb") return "Q1 reb";
  if (market === "q1ast") return "Q1 ast";
  return market.replace(/^q1/, "");
}

/** Display-only backfill for frozen slates (never mutates picks.json). */
export function backfillDisplayReasons(leg: PickLeg, reasons: LegReason[]): LegReason[] {
  if (reasons.length >= 2) {
    return reasons.map((r) => ({
      ...r,
      text: houseReasonLine(r.text, REASON_TEXT_MAX),
    }));
  }
  const min = minReasonLinesForRung(leg.market, leg.line);
  let out = [...reasons];
  const have = (type: LegReason["type"]) => out.some((r) => r.type === type);
  if (out.length < min || (!have("form") && !have("avg"))) {
    const form = formFromLeg(leg);
    if (form && !have("form")) {
      out.push({ type: "form", text: houseReasonLine(form) });
    }
    if (!have("avg") && (!have("form") || out.length < min)) {
      const avg = avgFromLeg(leg) ?? avgFallbackFromLeg(leg);
      if (avg) out.push({ type: "avg", text: houseReasonLine(avg) });
    }
  }
  if (out.length < min) {
    const form = formFromLeg(leg);
    if (form && !out.some((r) => r.type === "form")) {
      out.push({ type: "form", text: houseReasonLine(form) });
    }
    if (out.length < min) {
      const avg = avgFromLeg(leg) ?? avgFallbackFromLeg(leg);
      if (avg && !out.some((r) => r.type === "avg")) {
        out.push({ type: "avg", text: houseReasonLine(avg) });
      }
    }
  }
  let filled = gateLegReasons(out, leg.market, 3, leg.line);
  if (filled.length < min) {
    filled = gateLegReasons(filled, leg.market, 3);
  }
  return filled.map((r) => ({
    ...r,
    text: houseReasonLine(r.text, REASON_TEXT_MAX),
  }));
}