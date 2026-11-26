import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import type { PickLeg } from "../lib/types";
import { legRowReasonLines } from "../lib/leg-row-reasons";
import { threesVolumeFromLogs } from "../lib/player-tracking-fetch";
import { REASON_TEXT_MAX } from "../lib/leg-reason-house";

const picks26 = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), "tests/fixtures/2026-11-26/picks.json"), "utf8")
) as PickLeg[];

describe("leg reason display backfill", () => {
  it("3pm tracking copy uses 3PA", () => {
    const line = threesVolumeFromLogs([
      { gameId: "1", date: "2026-11-20", minutes: 30, pts: 20, reb: 5, ast: 4, threes: 3, fg3a: 8 },
      { gameId: "2", date: "2026-11-19", minutes: 32, pts: 18, reb: 4, ast: 5, threes: 2, fg3a: 7 },
      { gameId: "3", date: "2026-11-18", minutes: 34, pts: 22, reb: 6, ast: 3, threes: 4, fg3a: 9 },
      { gameId: "4", date: "2026-11-17", minutes: 31, pts: 15, reb: 3, ast: 6, threes: 1, fg3a: 5 },
      { gameId: "5", date: "2026-11-16", minutes: 33, pts: 19, reb: 4, ast: 5, threes: 3, fg3a: 8 },
      { gameId: "6", date: "2026-11-01", minutes: 30, pts: 14, reb: 4, ast: 4, threes: 2, fg3a: 5 },
    ]);
    expect(line).toMatch(/^3PA up:/);
  });

  for (const id of ["4683021-pts-30", "3136193-pts-25", "4066261-pts-25"]) {
    it(`fills frozen ${id} to at least two lines`, () => {
      const leg = picks26.find((p) => p.id === id)!;
      const lines = legRowReasonLines(leg);
      expect(lines.length).toBeGreaterThanOrEqual(2);
      for (const row of lines) {
        expect(row.text.length).toBeLessThanOrEqual(REASON_TEXT_MAX);
      }
    });
  }
});