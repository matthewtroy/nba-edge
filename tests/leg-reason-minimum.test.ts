import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import type { PickLeg } from "../lib/types";
import { legRowReasonLines } from "../lib/leg-row-reasons";
import { legHasSupportiveReason } from "../lib/picks-supportive-filter";

const picks26 = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), "tests/fixtures/2026-11-26/picks.json"), "utf8")
) as PickLeg[];

const picks28 = JSON.parse(
  fs.readFileSync(
    path.join(process.cwd(), "tests/fixtures/next-slate/2026-11-28-pre-odds.json"),
    "utf8"
  )
).picks as PickLeg[];

describe("leg reason minimum (supportive only)", () => {
  for (const id of ["4683021-pts-30", "3136193-pts-25", "4066261-pts-25"]) {
    it(`display keeps supportive frozen ${id}`, () => {
      const leg = picks26.find((p) => p.id === id)!;
      const lines = legRowReasonLines(leg);
      if (legHasSupportiveReason(leg)) {
        expect(lines.length).toBeGreaterThanOrEqual(1);
        expect(lines.length).toBeLessThanOrEqual(3);
      }
    });
  }

  it("fixture 2026-11-28: kept legs have ≥1 supportive display line", () => {
    const kept = picks28.filter((p) => !p.market.startsWith("q1") && legHasSupportiveReason(p));
    expect(kept.length).toBeGreaterThan(100);
    for (const leg of kept.slice(0, 40)) {
      const n = legRowReasonLines(leg).length;
      expect(n).toBeGreaterThanOrEqual(1);
      expect(n).toBeLessThanOrEqual(3);
    }
  });
});