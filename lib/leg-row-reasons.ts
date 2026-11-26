import type { PickLeg, ReasonAtTipSnapshot } from "./types.js";
import { reasonTexts } from "./leg-reason-types.js";
import { gateLegReasons, minReasonLinesForRung } from "./reason-gate.js";

function legIsPriced(leg: PickLeg): boolean {
  return (
    (leg.bestPrice != null && leg.bestPrice > 1) ||
    (leg.bookiePrices != null &&
      Object.values(leg.bookiePrices).some((v) => v != null && v > 1))
  );
}

/** Up to three short reason lines for leg rows (structured reasons only). */
export function legRowReasonLines(
  leg: PickLeg,
  frozen?: Map<string, ReasonAtTipSnapshot>
): { text: string; injury: boolean }[] {
  const maxLines =
    legIsPriced(leg) && minReasonLinesForRung(leg.market, leg.line) >= 2 ? 3 : 3;
  const snap = frozen?.get(leg.id);
  const src = snap?.reasons ?? leg.reasons ?? [];
  const texts = reasonTexts(gateLegReasons(src, leg.market, maxLines, leg.line));
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