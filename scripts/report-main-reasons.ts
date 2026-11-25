import fs from "fs";
import { picksByIdFromOfficialSnapshots } from "../lib/official-leg-snapshot.js";
import { combinedPriceForBookieWithCatalog, legsMissingAtBookie } from "../lib/single-bookie.js";
import {
  feedBookieOptionsForMulti,
  formatFeedBookieOptionLabel,
} from "../lib/feed-bookie-options.js";
import { legRowReasonLines } from "../lib/leg-row-reasons.js";
import type { MultiBet, PickLeg } from "../lib/types.js";

const official = JSON.parse(
  fs.readFileSync("public/data/2026-11-26/official-card.json", "utf8")
) as { legSnapshots: Record<string, unknown>; multis: MultiBet[] };
const picks = JSON.parse(
  fs.readFileSync("public/data/2026-11-26/picks.json", "utf8")
) as PickLeg[];
const map = picksByIdFromOfficialSnapshots(official.legSnapshots as never, picks);
const main = official.multis.find((m) => m.type === "mainPlay")!;
const legs = main.legs.map((id) => map.get(id)).filter(Boolean) as PickLeg[];

for (const id of main.legs) {
  const leg = map.get(id)!;
  const lines = legRowReasonLines(leg);
  console.log(
    `${leg.playerName} ${leg.market} ${leg.line}+:`,
    lines.map((l) => l.text).join(" · ") || "(none)"
  );
}
for (const b of ["Neds", "Unibet", "Sportsbet", "Ladbrokes"]) {
  const miss = legsMissingAtBookie(legs, b, picks);
  const total = combinedPriceForBookieWithCatalog(legs, b, picks);
  const label =
    total != null
      ? `Main Play @ $${total.toFixed(2)} · ${b}`
      : `${b} · ${miss} of ${legs.length} legs`;
  console.log("HEADER", label);
}
console.log(
  "DROPDOWN",
  feedBookieOptionsForMulti(legs, picks)
    .slice(0, 8)
    .map(formatFeedBookieOptionLabel)
    .join(" | ")
);