import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import type { PickLeg } from "../lib/types";
import { gateLegReasons, minReasonLinesForRung } from "../lib/reason-gate";
import { legRowReasonLines } from "../lib/leg-row-reasons";

const picks = JSON.parse(
  fs.readFileSync(
    path.join(process.cwd(), "tests/fixtures/2026-11-26/picks.json"),
    "utf8"
  )
) as PickLeg[];

function pick(id: string): PickLeg {
  const leg = picks.find((p) => p.id === id);
  if (!leg) throw new Error(`missing ${id}`);
  return leg;
}

describe("rung-aware reasons", () => {
  it("expects at least two fact lines on high pts and ast rungs", () => {
    expect(minReasonLinesForRung("pts", 30)).toBe(2);
    expect(minReasonLinesForRung("ast", 7)).toBe(2);
    const kat = pick("3136195-pts-30");
    expect(legRowReasonLines(kat).length).toBeGreaterThanOrEqual(2);
    const avdijaSeed = [
      { type: "avg" as const, text: "Avg 7.4 ast last 10 (season 6.2)" },
      { type: "form" as const, text: "6/10 at this line" },
      { type: "min" as const, text: "Playing more: 34 min last 5 (30 season)" },
    ];
    expect(gateLegReasons(avdijaSeed, "ast", 3, 7).length).toBeGreaterThanOrEqual(2);
  });
});