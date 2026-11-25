import type { PickLeg } from "./types.js";
import { normalizeLegReasons, reasonTexts, sortLegReasons } from "./leg-reason-types.js";

/** Up to two short reason lines for leg rows (structured reasons only). */
export function legRowReasonLines(leg: PickLeg): { text: string; injury: boolean }[] {
  const texts = reasonTexts(
    sortLegReasons(normalizeLegReasons(leg.reasons ?? []))
  );
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of texts) {
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
    if (out.length >= 2) break;
  }
  return out.map((text) => ({
    text,
    injury: /out →|only big|Teammate/i.test(text),
  }));
}