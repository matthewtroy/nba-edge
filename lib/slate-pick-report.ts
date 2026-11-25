import type { MultiBet, PickLeg } from "./types.js";

function legEdgePp(leg: PickLeg): number {
  if (leg.bestPrice != null && leg.bestPrice > 1) {
    return (leg.probability - 1 / leg.bestPrice) * 100;
  }
  return leg.probability * 100 - (1 / leg.fairPrice) * 100;
}

export function logSlatePickReport(
  picks: PickLeg[],
  multis: MultiBet[],
  picksById: Map<string, PickLeg>
): void {
  const main = multis.find((m) => m.type === "mainPlay");
  if (main) {
    const legs = main.legs
      .map((id) => picksById.get(id))
      .filter((l): l is PickLeg => l != null);
    console.log(
      `mainPlay: ${legs.length} legs @ ${main.bestBookie ?? "?"} $${main.bestBookieTotal?.toFixed(2) ?? "?"}`
    );
    for (const l of legs) {
      const reason = l.reasonLine ?? l.reasons[0] ?? "";
      console.log(
        `mainPlay leg: ${l.playerName} ${l.market} ${l.line}+ edge=${legEdgePp(l).toFixed(1)}pp ${reason}`
      );
    }
  } else {
    console.log("mainPlay: not built");
  }

  const top = [...picks]
    .sort((a, b) => legEdgePp(b) - legEdgePp(a))
    .slice(0, 10);
  console.log(`top edges (10):`);
  for (const l of top) {
    console.log(
      `edge: ${l.playerName} ${l.market} ${l.line}+ ${legEdgePp(l).toFixed(1)}pp · ${l.reasonLine ?? ""}`
    );
  }
}