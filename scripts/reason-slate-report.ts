#!/usr/bin/env npx tsx
/** Display-path reason histogram + market samples (digits → N) for a slate on origin/data. */
import { execSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import type { PickLeg } from "../lib/types.js";
import { legRowReasonLines } from "../lib/leg-row-reasons.js";
import { sampleLegsByMarket } from "../lib/reason-histogram.js";
import { reasonTextHasBannedPhrase } from "../lib/reason-ban.js";

const date = process.argv[2] ?? "2026-11-28";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const picks = JSON.parse(
  execSync(`git show origin/data:public/data/${date}/picks.json`, {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 50_000_000,
  })
) as PickLeg[];

const lineCounts = new Map<string, number>();
let banned = 0;
for (const leg of picks) {
  for (const r of legRowReasonLines(leg)) {
    if (reasonTextHasBannedPhrase(r.text)) banned += 1;
    const normalized = r.text.replace(/\d+(\.\d+)?/g, "N");
    lineCounts.set(normalized, (lineCounts.get(normalized) ?? 0) + 1);
  }
}

const top15 = [...lineCounts.entries()]
  .sort((a, b) => b[1] - a[1])
  .slice(0, 15);

console.log(`Slate ${date} · ${picks.length} legs · banned hits ${banned}`);
console.log("\nTop 15 reason lines (digits→N):");
for (const [line, count] of top15) {
  console.log(`${count}\t${line}`);
}

const samples = sampleLegsByMarket(picks, 3);
console.log("\nSample legs (display path):");
for (const market of ["pts", "reb", "ast", "3pm"] as const) {
  console.log(`\n${market.toUpperCase()}`);
  for (const leg of samples[market] ?? []) {
    const lines = legRowReasonLines(leg).map((r) => r.text);
    console.log(`- ${leg.playerName} ${leg.line}+ — ${lines.join(" · ") || "(none)"}`);
  }
}