import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import {
  gradeOfficialLeg,
  settleMultiLegs,
  settleOfficialCard,
} from "../lib/settle-core";
import { gradePickLeg } from "../lib/graded-leg";
import { slateResultsFrozen } from "../lib/settle-slate-freeze";
import { buildResultsSlice } from "../lib/results-aggregate";
import type { OfficialCardFile, OfficialLegSnapshot } from "../lib/official-card-time";
import type { PickLeg } from "../lib/types";

const boxesPath = path.join(process.cwd(), "fixtures/settle-boxes.json");
const raw = JSON.parse(fs.readFileSync(boxesPath, "utf8")) as Record<
  string,
  Record<string, { minutes: number; pts: number; reb: number; ast: number; threes: number }>
>;

function snap(
  partial: Partial<OfficialLegSnapshot> & Pick<OfficialLegSnapshot, "id" | "playerId" | "gameId" | "market" | "line">
): OfficialLegSnapshot {
  return {
    playerName: "Test",
    team: "A",
    publishedBookie: "TAB",
    fairPrice: 1.5,
    takeAt: 1.62,
    probability: 0.65,
    reasons: [],
    ...partial,
  };
}

function pick(overrides: Partial<PickLeg> & Pick<PickLeg, "id" | "playerId" | "gameId" | "market" | "line">): PickLeg {
  return {
    team: "A",
    opponent: "B",
    playerName: "Test",
    headshotUrl: "",
    probability: 0.6,
    fairPrice: 1.5,
    takeAt: 1.6,
    tags: [],
    reasons: [],
    bestPrice: 1.8,
    bestBookie: "TAB",
  ...overrides,
  };
}

describe("pending settlement", () => {
  it("unplayed leg is pending, not void", () => {
    expect(
      gradeOfficialLeg(
        snap({ id: "u", playerId: "p-x", gameId: "missing-game", market: "pts", line: 20 }),
        undefined
      ).result
    ).toBe("pending");
    const row = gradePickLeg(
      pick({ id: "p1", playerId: "p-x", gameId: "missing-game", market: "pts", line: 20 }),
      "2026-01-01",
      undefined
    );
    expect(row?.result).toBe("pending");
  });

  it("0 minutes still void", () => {
    expect(
      gradeOfficialLeg(
        snap({ id: "v", playerId: "p-void", gameId: "fixture-game-won", market: "pts", line: 20 }),
        { ...raw["fixture-game-won"]["p-void"], playerId: "p-void" }
      ).result
    ).toBe("void");
  });

  it("lost beats pending; won with pending stays pending", () => {
    expect(settleMultiLegs(["lost", "pending"])).toBe("lost");
    expect(settleMultiLegs(["won", "pending"])).toBe("pending");
    expect(settleMultiLegs(["pending", "pending"])).toBe("pending");
    expect(settleMultiLegs(["won", "void"])).toBe("won");
  });

  it("frozen settled slate is terminal", () => {
    const slice = buildResultsSlice({
      officialLegs: [
        {
          id: "l1",
          slateDate: "2026-01-01",
          betType: "mainPlay",
          playerName: "A",
          market: "pts",
          line: 20,
          result: "won",
          actualValue: 22,
          probability: 0.6,
          tags: [],
        },
      ],
      officialBets: [
        {
          slateDate: "2026-01-01",
          betType: "mainPlay",
          label: "Main",
          legIds: ["l1"],
          result: "won",
          profitUnits: 2,
          stakeUnits: 1,
        },
      ],
      valueLegRows: [],
      gradedLegs: [
        {
          id: "g1",
          slateDate: "2026-01-01",
          playerId: "p1",
          playerName: "A",
          gameId: "g",
          market: "pts",
          line: 20,
          result: "won",
          actualValue: 22,
          probability: 0.6,
          fairPrice: 1.5,
          tags: [],
        },
      ],
    });
    expect(slateResultsFrozen(slice)).toBe(true);
    const pendingSlice = {
      ...slice,
      official: {
        ...slice.official,
        bets: [{ ...slice.official.bets[0], result: "pending" as const }],
      },
    };
    expect(slateResultsFrozen(pendingSlice)).toBe(false);
  });

  it("official card with missing box scores yields pending multis", () => {
    const card: OfficialCardFile = {
      lockedAt: "2026-01-02",
      slateDate: "2026-01-02",
      bookie: "TAB",
      multis: [
        {
          type: "mainPlay",
          label: "Main",
          legs: ["l1", "l2"],
          combinedProbability: 0.2,
          combinedFairPrice: 8,
          combinedTakeAt: 9,
          summary: "test",
        },
      ],
      notBuilt: [],
      whatChanged: [],
      injuries: [],
      legSnapshots: {
        l1: snap({
          id: "l1",
          playerId: "p1",
          gameId: "no-box-game",
          market: "pts",
          line: 10,
        }),
        l2: snap({
          id: "l2",
          playerId: "p2",
          gameId: "no-box-game",
          market: "reb",
          line: 5,
        }),
      },
    };
    const settled = settleOfficialCard(card, new Map());
    expect(settled.legs.every((l) => l.result === "pending")).toBe(true);
    expect(settled.bets[0].result).toBe("pending");
  });
});