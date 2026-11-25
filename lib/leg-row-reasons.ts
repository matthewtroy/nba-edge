import type { PickLeg } from "./types.js";
import { injuryReasonForMarket } from "./injury-reason.js";
import { isInjuryRedistributionReason } from "./injury-reason.js";

function dedupeStatReasons(lines: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const line of lines) {
    const key = line.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(line);
  }
  return out;
}

function shortenReason(text: string): string {
  return text
    .replace(/rank (\d+)(st|nd|rd|th) worst defending/gi, "D#$1 vs")
    .replace(/L10 avg ([\d.]+) (pts|reb|ast|3pm) vs (\d+)\+ line/, "$2 avg $1 vs $3+")
    .replace(/Minutes (up|down) ([\d.]+) last 5 vs prior 5/, "Min $1 $2 L5")
    .replace(/\s+/g, " ")
    .trim();
}

/** Up to two short reason lines for leg rows (wrap, no ellipsis). */
export function legRowReasonLines(leg: PickLeg): { text: string; injury: boolean }[] {
  const raw: string[] = [];
  const inj = injuryReasonForMarket(leg.reasons, leg.market);
  if (inj) raw.push(shortenReason(inj));
  for (const r of leg.reasons) {
    if (raw.length >= 3) break;
    if (!r?.trim()) continue;
    if (isInjuryRedistributionReason(r) && injuryReasonForMarket([r], leg.market)) continue;
    if (leg.reasonLine && shortenReason(r) === shortenReason(leg.reasonLine)) continue;
    raw.push(shortenReason(r));
  }
  if (leg.reasonLine && !raw.includes(shortenReason(leg.reasonLine))) {
    raw.unshift(shortenReason(leg.reasonLine));
  }
  const deduped = dedupeStatReasons(raw);
  return deduped.slice(0, 2).map((text) => ({
    text,
    injury: /out →|only big left|missing \d+ big|Teammate/i.test(text),
  }));
}