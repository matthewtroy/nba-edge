import type { PickLeg, ReasonAtTipSnapshot } from "./types.js";
import { reasonTexts } from "./leg-reason-types.js";
import { gateLegReasons } from "./reason-gate.js";
import { backfillDisplayReasons } from "./leg-reason-display.js";

/** Up to three short reason lines for leg rows (structured reasons only). */
export function legRowReasonLines(
  leg: PickLeg,
  frozen?: Map<string, ReasonAtTipSnapshot>
): { text: string; injury: boolean }[] {
  const snap = frozen?.get(leg.id);
  const src = snap?.reasons ?? leg.reasons ?? [];
  const filled = backfillDisplayReasons(leg, gateLegReasons(src, leg.market, 3, leg.line));
  const texts = reasonTexts(filled);
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
    roleRisk: /^role risk:/i.test(text),
  }));
}