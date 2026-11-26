import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import type { PickLeg } from "../lib/types";
import { legRowReasonLines } from "../lib/leg-row-reasons";
import { reasonTextHasBannedPhrase } from "../lib/reason-ban";
import { threesVolumeFromLogs } from "../lib/player-tracking-fetch";
import { houseReasonText } from "../lib/leg-reason-house";

const picks26 = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), "tests/fixtures/2026-11-26/picks.json"), "utf8")
) as PickLeg[];

describe("leg reason display backfill", () => {
  it("3pm tracking copy uses 3PA", () => {
    const line = threesVolumeFromLogs([
      ...Array.from({ length: 5 }, (_, i) => ({
        gameId: `l5-${i}`,
        date: `2026-11-${String(20 - i).padStart(2, "0")}`,
        minutes: 30,
        pts: 18,
        reb: 4,
        ast: 3,
        threes: 3,
        fg3a: 10,
      })),
      ...Array.from({ length: 8 }, (_, i) => ({
        gameId: `s-${i}`,
        date: `2026-10-${String(28 - i).padStart(2, "0")}`,
        minutes: 28,
        pts: 12,
        reb: 3,
        ast: 2,
        threes: 1,
        fg3a: 4,
      })),
    ]);
    expect(line).toMatch(/^More 3s:/);
  });

  it("reason copy is never length-capped", () => {
    const long = "Playing more: 38 min last 5 (34 season) · Avg 31.2 pts last 10 (season 28.4)";
    expect(houseReasonText(long)).toBe(long);
  });

  for (const id of ["4683021-pts-30", "3136193-pts-25", "4066261-pts-25"]) {
    it(`fills frozen ${id} or drops legacy-banned only copy`, () => {
      const leg = picks26.find((p) => p.id === id)!;
      const lines = legRowReasonLines(leg);
      if (lines.length === 0) {
        expect(
          (leg.reasons ?? []).every((r) => reasonTextHasBannedPhrase(String(r.text ?? r)))
        ).toBe(true);
      } else {
        expect(lines.length).toBeGreaterThanOrEqual(1);
        expect(lines.length).toBeLessThanOrEqual(3);
      }
    });
  }
});