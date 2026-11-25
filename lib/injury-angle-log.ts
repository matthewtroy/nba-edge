import type { PickLeg } from "./types.js";

export function logInjuryAngleLegs(picks: PickLeg[], slateDate?: string): void {
  const dateLabel = slateDate ?? "slate";
  const legs = picks.filter((l) => {
    const injuryReason = l.reasons.some((r) =>
      /out:|only big left|missing \d+ big/i.test(r)
    );
    if (!injuryReason) return false;
    return l.market === "pts" || l.market === "reb" || l.market === "ast";
  });
  console.log(`injury-angle legs (${dateLabel}): ${legs.length} total`);
  for (const l of legs) {
    const injuryReason =
      l.reasons.find((r) => /out:|only big left|missing \d+ big/i.test(r)) ??
      l.reasonLine ??
      "";
    const edge =
      l.bestPrice != null && l.bestPrice > 1
        ? ((l.probability - 1 / l.bestPrice) * 100).toFixed(1)
        : "n/a";
    console.log(
      `injury-angle: ${l.playerName} ${l.market} ${l.line}+ boost=${edge}pp reason=${injuryReason}`
    );
  }
}