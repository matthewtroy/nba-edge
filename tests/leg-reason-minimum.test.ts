import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import type { PickLeg } from "../lib/types";
import { legRowReasonLines } from "../lib/leg-row-reasons";
import { reasonCountHistogram } from "../lib/reason-histogram";

const picks26 = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), "tests/fixtures/2026-11-26/picks.json"), "utf8")
) as PickLeg[];

describe("leg reason minimum (every leg ≥2)", () => {
  for (const id of ["4683021-pts-30", "3136193-pts-25", "4066261-pts-25"]) {
    it(`display fills frozen ${id} to ≥2 lines`, () => {
      const leg = picks26.find((p) => p.id === id)!;
      expect(legRowReasonLines(leg).length).toBeGreaterThanOrEqual(2);
    });
  }

  it("data branch 2026-11-26 and 2026-11-28: 0 and 1-count buckets empty", () => {
    for (const date of ["2026-11-26", "2026-11-28"] as const) {
      const picks = JSON.parse(
        execSync(`git show origin/data:public/data/${date}/picks.json`, {
          encoding: "utf8",
          maxBuffer: 50_000_000,
        })
      ) as PickLeg[];
      const hist = reasonCountHistogram(picks);
      expect(hist[0]).toBe(0);
      expect(hist[1]).toBe(0);
      expect(hist[2]! + hist[3]!).toBe(picks.length);
    }
  });
});