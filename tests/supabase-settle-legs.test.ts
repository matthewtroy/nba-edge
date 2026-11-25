import { describe, expect, it } from "vitest";
import { buildCardLegUpsertRows } from "../scripts/supabase-sync";
import type { OfficialCardFile, OfficialLegSnapshot } from "../lib/official-card-time";

function snap(id: string): OfficialLegSnapshot {
  return {
    id,
    playerId: `player-${id}`,
    playerName: "Player",
    gameId: "game-1",
    team: "team-1",
    market: "pts",
    line: 20,
    publishedBookie: "TAB",
    fairPrice: 1.5,
    takeAt: 1.6,
    probability: 0.6,
    reasons: [],
  };
}

describe("settle card_legs upsert rows", () => {
  it("builds one row per published leg with results", () => {
    const card: OfficialCardFile = {
      lockedAt: "2026-01-01",
      slateDate: "2026-01-01",
      bookie: "TAB",
      multis: [{ type: "mainPlay", legs: ["l1", "l2"], combinedFairPrice: 4 }],
      notBuilt: [],
      whatChanged: [],
      injuries: [],
      legSnapshots: {
        l1: snap("l1"),
        l2: snap("l2"),
      },
    };
    const legById = new Map([
      ["l1", { result: "won", actualValue: 24 }],
      ["l2", { result: "pending", actualValue: null }],
    ]);
    const betIdByTypeVariant = new Map([["mainPlay:", { id: "bet-uuid" }]]);
    const rows = buildCardLegUpsertRows(
      card,
      legById,
      betIdByTypeVariant,
      "2026-01-02T00:00:00.000Z"
    );
    expect(rows.length).toBe(2);
    expect(rows[0].result).toBe("won");
    expect(rows[0].settled_at).toBe("2026-01-02T00:00:00.000Z");
    expect(rows[1].result).toBe("pending");
    expect(rows[1].settled_at).toBeNull();
  });
});