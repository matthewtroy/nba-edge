import { describe, expect, it } from "vitest";
import { syncRunToSupabase, type SupabaseUpsertClient } from "../scripts/supabase-sync";
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
    await syncRunToSupabase(client, {
      slateDate: "2026-11-26",
      slate,
      injuries: [],
      players: [],
      ranking: [],
    });
    expect(client.tables.slates?.length).toBe(2);
    expect(client.tables.teams?.length).toBeGreaterThan(0);
  });
});