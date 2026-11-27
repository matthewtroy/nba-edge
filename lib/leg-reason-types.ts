export type LegReasonType =
  | "injury"
  | "roleRisk"
  | "context"
  | "tracking"
  | "angle"
  | "matchup"
  | "h2h"
  | "rank"
  | "form"
  | "avg"
  | "pace"
  | "min"
  | "other";

export interface LegReason {
  type: LegReasonType;
  text: string;
}

export const REASON_TYPE_ORDER: LegReasonType[] = [
  "injury",
  "roleRisk",
  "context",
  "matchup",
  "tracking",
  "h2h",
  "form",
  "avg",
  "rank",
  "pace",
  "min",
  "angle",
  "other",
];

export function normalizeLegReason(input: unknown): LegReason | null {
  if (input == null) return null;
  if (typeof input === "string") {
    const t = input.trim();
    if (!t) return null;
    return { type: inferReasonType(t), text: t };
  }
  if (typeof input === "object" && "text" in input) {
    const o = input as { type?: string; text?: string };
    const text = (o.text ?? "").trim();
    if (!text) return null;
    const type =
      o.type && REASON_TYPE_ORDER.includes(o.type as LegReasonType)
        ? (o.type as LegReasonType)
        : inferReasonType(text);
    return { type, text };
  }
  return null;
}

export function normalizeLegReasons(input: unknown): LegReason[] {
  if (!Array.isArray(input)) return [];
  const out: LegReason[] = [];
  const seen = new Set<string>();
  for (const item of input) {
    const r = normalizeLegReason(item);
    if (!r) continue;
    const key = `${r.type}:${r.text.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(r);
  }
  return sortLegReasons(out);
}

export function inferReasonType(text: string): LegReasonType {
  const t = text.toLowerCase();
  if (/^role risk:/i.test(t)) return "roleRisk";
  if (
    /out →|out:|only big|missing \d+ big|without .+ →|benefit|redistrib|teammate/i.test(t) ||
    /(?:questionable|doubtful|probable)\s*→/i.test(t)
  )
    return "injury";
  if (/on a back-to-back/i.test(t)) return "context";
  if (/potential ast|more shots|more 3s|fga up|3pa up|tracking/i.test(t)) return "tracking";
  if (/rank #\d+ in allowing/i.test(t)) return "matchup";
  if (/allow [\d.]+\s+(pts|points|reb|rebounds|ast|assists|threes)/i.test(t)) return "matchup";
  if (/^best this season:/i.test(t)) return "h2h";
  if (/^former team vs /i.test(t)) return "angle";
  if (/vs .+ in \d+ meetings|\/\d+ .+ vs /i.test(t)) return "h2h";
  if (/averages [\d.]+\s+(pts|reb|ast)/i.test(t)) return "rank";
  if (/rank \d|worst defending|pace ·/i.test(t)) return "matchup";
  if (/\/10 at this line|5\/5 at this line/i.test(t)) return "form";
  if (/hit .+ in all \d+ vs/i.test(t) || /\d+ of \d+ .+ vs /i.test(t)) return "h2h";
  if (/meeting avg [\d.]+ .+ vs /i.test(t)) return "h2h";
  if (/^avg /i.test(t)) return "avg";
  if (/fast game/i.test(t)) return "pace";
  if (/playing more/i.test(t)) return "min";
  if (/angle|role|\+[\d.]+ min/i.test(t)) return "angle";
  return "other";
}

export function sortLegReasons(reasons: LegReason[]): LegReason[] {
  const rank = (t: LegReasonType) => {
    const i = REASON_TYPE_ORDER.indexOf(t);
    return i >= 0 ? i : 99;
  };
  return [...reasons].sort((a, b) => rank(a.type) - rank(b.type) || a.text.localeCompare(b.text));
}

export function reasonTexts(reasons: LegReason[]): string[] {
  return reasons.map((r) => r.text);
}

export function reasonText(r: LegReason | string): string {
  return typeof r === "string" ? r : r.text;
}

export function reasonsForMarket(reasons: LegReason[], market: string): LegReason[] {
  const stat = market.replace(/^q1/, "");
  return reasons.filter(
    (r) =>
      r.type === "rank" ||
      r.type === "form" ||
      reasonMatchesMarket(r, market, stat)
  );
}

export function reasonMatchesMarket(r: LegReason, market: string, stat: string): boolean {
  if (market.startsWith("q1")) {
    const t = r.text.toLowerCase();
    if (r.type === "avg" || r.type === "form") return t.includes("q1");
    if (r.type === "injury") return true;
    return false;
  }
  if (r.type === "tracking") {
    if (stat === "3pm") return /more 3s|3pa up/i.test(r.text) && !/fga/i.test(r.text);
    if (stat === "pts") return /more shots|fga up/i.test(r.text);
    if (stat === "ast") return /potential ast/i.test(r.text);
    return false;
  }
  if (
    r.type === "injury" ||
    r.type === "context" ||
    r.type === "angle" ||
    r.type === "h2h" ||
    r.type === "pace" ||
    r.type === "min" ||
    r.type === "form"
  ) {
    return true;
  }
  if (r.type === "matchup" || r.type === "avg" || r.type === "rank") {
    const t = r.text.toLowerCase();
    if (stat === "3pm") return t.includes("three") || t.includes("3pm") || t.includes("3s");
    if (stat === "pts")
      return t.includes("point") || t.includes(" pts") || t.includes("pts ");
    if (stat === "reb") return t.includes("reb");
    if (stat === "ast") return t.includes("ast") || t.includes("assist");
    if (market.startsWith("q1")) return t.includes(stat) || t.includes("q1");
    return true;
  }
  return true;
}

export function topReasonLines(reasons: LegReason[], max: number): string {
  return reasons
    .slice(0, max)
    .map((r) => r.text)
    .join(" · ");
}