export type LegReasonType =
  | "injury"
  | "tracking"
  | "matchup"
  | "form"
  | "avg"
  | "pace"
  | "min"
  | "angle"
  | "other";

export interface LegReason {
  type: LegReasonType;
  text: string;
}

export const REASON_TYPE_ORDER: LegReasonType[] = [
  "injury",
  "tracking",
  "angle",
  "matchup",
  "form",
  "avg",
  "pace",
  "min",
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
  if (/out →|out:|only big|missing \d+ big|benefit|redistrib|teammate/i.test(t)) return "injury";
  if (/potential ast|shot volume|tracking/i.test(t)) return "tracking";
  if (/rank \d|worst defending|pace ·/i.test(t)) return "matchup";
  if (/\/10 hits|5\/5 hits/i.test(t)) return "form";
  if (/l10 avg/i.test(t)) return "avg";
  if (/pace /i.test(t) && !/worst defending/i.test(t)) return "pace";
  if (/minutes (up|down)/i.test(t)) return "min";
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
  return reasons.filter((r) => reasonMatchesMarket(r, market, stat));
}

function reasonMatchesMarket(r: LegReason, market: string, stat: string): boolean {
  if (r.type === "injury" || r.type === "tracking" || r.type === "angle" || r.type === "pace" || r.type === "min") {
    return true;
  }
  if (r.type === "form") return true;
  if (r.type === "matchup" || r.type === "avg") {
    const t = r.text.toLowerCase();
    if (stat === "3pm") return t.includes("three") || t.includes("3pm");
    if (stat === "pts") return t.includes("point") || t.includes(" pts") || t.includes("pts ");
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