import { describe, expect, it } from "vitest";
import {
  createSupabaseClient,
  finalizePipelineSupabaseSync,
  syncRunToSupabase,
  upsertOddsBudgetForMonth,
  type SupabaseUpsertClient,
} from "../scripts/supabase-sync";
import type { SlateGame } from "../lib/types";

function mockClient(): SupabaseUpsertClient & { tables: Record<string, unknown[]> } {
  const tables: Record<string, unknown[]> = {};
  return {
    tables,
    async upsert(table, rows, _onConflict) {
      const cur = tables[table] ?? [];
      tables[table] = [...cur, ...rows];
    },
    async fromSelect() {
      return null;
    },
    async insert(table, row) {
      tables[table] = [...(tables[table] ?? []), row];
      return { id: "pull-1" };
    },
  };
}

describe("supabase sync idempotent upsert", () => {
  it("writes teams and slates without throwing", async () => {
    const client = mockClient();
    const slate: SlateGame[] = [
      {
        id: "g1",
        startTime: "2026-11-26T02:00:00Z",
        startTimeSydney: "",
        homeTeam: "Heat",
        awayTeam: "Knicks",
        homeTeamId: "m1",
        awayTeamId: "m2",
        homeB2B: false,
        awayB2B: false,
        status: "pre",
      },
    ];
    await syncRunToSupabase(client, {
      slateDate: "2026-11-26",
      slate,
      injuries: [],
      players: [],
      ranking: [],
    });
    const { counts } = await syncRunToSupabase(client, {
      slateDate: "2026-11-26",
      slate,
      injuries: [],
      players: [],
      ranking: [],
    });
    expect(counts.slates).toBe(1);
    expect(client.tables.slates?.length).toBe(2);
    expect(client.tables.teams?.length).toBeGreaterThan(0);
  });

  it("finalize logs skip without config", async () => {
    const conn = await createSupabaseClient("/nonexistent-nba-edge-root");
    expect(conn.client).toBeNull();
    await finalizePipelineSupabaseSync("/nonexistent-nba-edge-root", []);
  });

  it("upsertOddsBudgetForMonth creates month row", async () => {
    const client = mockClient();
    await upsertOddsBudgetForMonth(client, "2026-11", {
      creditsRemaining: 400,
    });
    expect(client.tables.odds_budget?.length).toBe(1);
    expect(
      (client.tables.odds_budget?.[0] as { month_key: string }).month_key
    ).toBe("2026-11");
  });
});