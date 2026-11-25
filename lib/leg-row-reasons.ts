import type { PickLeg } from "./types.js";
import { reasonTexts } from "./leg-reason-types.js";
import { gateLegReasons } from "./reason-gate.js";

/** Up to three short reason lines for leg rows (structured reasons only). */
export function legRowReasonLines(leg: PickLeg): { text: string; injury: boolean }[] {
  const texts = reasonTexts(gateLegReasons(leg.reasons ?? [], leg.market, 3, leg.line));
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of texts) {
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
    if (out.length >= 3) break;
  }
  return out.map((text) => ({
    text,
    injury: /out →|only big|Teammate/i.test(text),
  }));
}