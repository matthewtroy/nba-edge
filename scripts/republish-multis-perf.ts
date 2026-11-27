import fs from "fs";
import path from "path";
import { performance } from "node:perf_hooks";
import { buildMultis } from "../lib/multis.js";
import { logHeap } from "../lib/process-heap.js";
import { resetOfferedBookieCacheForTests } from "../lib/offered-bookie-lines.js";
import type { PickLeg, SlateGame } from "../lib/types.js";
import { passesFormGuard } from "../lib/form-guard.js";

const date = process.env.PIPELINE_SLATE_DATE ?? "2026-11-28";
const root = path.join(process.cwd(), "public/data", date);
const picks = JSON.parse(fs.readFileSync(path.join(root, "picks.json"), "utf8")) as PickLeg[];
const slate = JSON.parse(fs.readFileSync(path.join(root, "slate.json"), "utf8")) as SlateGame[];

process.env.PIPELINE_SLATE_DATE = date;
resetOfferedBookieCacheForTests();

const filtered = picks.filter(passesFormGuard);
const t0 = performance.now();
logHeap("before buildMultis");
const { bets, gateViolations } = buildMultis(filtered, slate.length, 300, 0.08, [], undefined, slate);
logHeap("after buildMultis");
const ms = Math.round(performance.now() - t0);

for (const b of bets) {
  if (["mainPlay", "booster", "crossGameSgm"].includes(b.type)) {
    console.log(
      `${b.type} ${b.bestBookie} $${b.bestBookieTotal?.toFixed(2)} ${b.legs.length} legs`
    );
  }
}
console.log(`gate dropped ${gateViolations.length}`);
console.log(`duration_ms=${ms}`);