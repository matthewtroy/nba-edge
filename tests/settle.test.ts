import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import {
  gradeOfficialLeg,
  settleMultiLegs,
  settleOfficialCard,
} from "../lib/settle-core";
import type { OfficialCardFile, OfficialLegSnapshot } from "../lib/official-card-time";

const boxesPath = path.join(process.cwd(), "fixtures/settle-boxes.json");
const raw = JSON.parse(fs.readFileSync(boxesPath, "utf8")) as Record<
  string,
  Record<string, { minutes: number; pts: number; reb: number; ast: number; threes: number; q1?: { pts: number; reb: number; ast: number } }>
>;

function box(gameId: string, playerId: string) {
  return raw[gameId][playerId];
}

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

describe("settle", () => {
  it("won / lost / void / q1", () => {
    expect(
      gradeOfficialLeg(
        snap({ id: "w", playerId: "p-won", gameId: "fixture-game-won", market: "pts", line: 20 }),
        box("fixture-game-won", "p-won")
      ).result
    ).toBe("won");
    expect(
      gradeOfficialLeg(
        snap({ id: "l", playerId: "p-lost", gameId: "fixture-game-won", market: "pts", line: 20 }),
        box("fixture-game-won", "p-lost")
      ).result
    ).toBe("lost");
    expect(
      gradeOfficialLeg(
        snap({ id: "v", playerId: "p-void", gameId: "fixture-game-won", market: "pts", line: 20 }),
        box("fixture-game-won", "p-void")
      ).result
    ).toBe("void");
    expect(
      gradeOfficialLeg(
        snap({ id: "q", playerId: "p-q1", gameId: "fixture-game-won", market: "q1pts", line: 7 }),
        box("fixture-game-won", "p-q1")
      ).result
    ).toBe("won");
  });

  it("card void leg voids multi", () => {
    expect(settleMultiLegs(["won", "void"])).toBe("void");
  });

  it("idempotent settleOfficialCard output", () => {
    const card: OfficialCardFile = {
      lockedAt: "2026-01-01",
      slateDate: "2026-01-01",
      bookie: "TAB",
      multis: [{ type: "mainPlay", legs: ["l1", "l2"], combinedFairPrice: 8 }],
      notBuilt: [],
      whatChanged: [],
      injuries: [],
      legSnapshots: {
        l1: snap({
          id: "l1",
          playerId: "p-card-hit",
          gameId: "fixture-game-void-leg",
          market: "pts",
          line: 15,
        }),
        l2: snap({
          id: "l2",
          playerId: "p-card-void",
          gameId: "fixture-game-void-leg",
          market: "reb",
          line: 5,
        }),
      },
    };
    const map = new Map([
      [
        "fixture-game-void-leg",
        new Map(
          Object.entries(raw["fixture-game-void-leg"]).map(([k, v]) => [k, v])
        ),
      ],
    ]);
    const a = settleOfficialCard(card, map);
    const b = settleOfficialCard(card, map);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(a.bets[0].result).toBe("void");
  });
});