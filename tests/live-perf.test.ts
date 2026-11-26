import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import type { MultiBet, PickLeg, SlateGame } from "../lib/types";
import { buildLiveSnapshot, createMockLiveProvider } from "../lib/live-source";
import { measureLiveTrackingMs } from "../lib/live-tracking";

const fixtureDir = path.join(process.cwd(), "tests/fixtures/espn");
const scoreboard = JSON.parse(
  fs.readFileSync(path.join(fixtureDir, "scoreboard-mini.json"), "utf8")
);
const summaryFinal = JSON.parse(
  fs.readFileSync(path.join(fixtureDir, "summary-final.json"), "utf8")
);
const official = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), "tests/fixtures/2026-11-26/official-card.json"), "utf8")
) as { legSnapshots: Record<string, Pick<PickLeg, "id" | "gameId" | "playerId" | "market" | "line">> };
const picks = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), "tests/fixtures/2026-11-26/picks.json"), "utf8")
) as PickLeg[];
const slate = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), "tests/fixtures/2026-11-26/slate.json"), "utf8")
) as SlateGame[];
const multis = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), "tests/fixtures/2026-11-26/multis.json"), "utf8")
) as { bets: MultiBet[] };

describe("live perf", () => {
  it("poll+render compute under 100ms on official fixture", async () => {
    const provider = createMockLiveProvider({
      scoreboard,
      summaries: { "fixture-game-won": summaryFinal },
    });
    const snap = await buildLiveSnapshot(provider, new Date("2026-11-26"), []);
    const legIds = new Set(Object.keys(official.legSnapshots));
    const legs = picks.filter((p) => legIds.has(p.id));
    let max = 0;
    for (let i = 0; i < 20; i += 1) {
      const ms = measureLiveTrackingMs(legs, slate, snap, multis.bets);
      max = Math.max(max, ms);
    }
    expect(max).toBeLessThan(100);
  });
});