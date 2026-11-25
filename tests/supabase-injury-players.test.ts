import { describe, expect, it, vi, afterEach } from "vitest";
import {
  isEspnPlayerId,
  syncRunToSupabase,
  type SupabaseUpsertClient,
} from "../scripts/supabase-sync";
import type { InjuryEntry, SlateGame } from "../lib/types";
import type { ModelPlayer } from "../scripts/model-engine";

function mockClient(): SupabaseUpsertClient & {
  tables: Record<string, unknown[]>;
  failTable?: string;
} {
  const tables: Record<string, unknown[]> = {};
  return {
    tables,
    failTable: undefined,
    async upsert(table, rows, _onConflict) {
      if (this.failTable === table) throw new Error(`mock ${table} down`);
      tables[table] = [...(tables[table] ?? []), ...rows];
    },
    async fromSelect<T>() {
      return { id: "pull-1" } as T;
    },
    async insert(table, row) {
      tables[table] = [...(tables[table] ?? []), row];
      return { id: "pull-1" };
    },
  };
}

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

describe("supabase injury players", () => {
  it("stores off-slate injured player before injury_reports", async () => {
    const client = mockClient();
    const injuries: InjuryEntry[] = [
      {
        playerId: "4066648",
        playerName: "Off Slate Star",
        teamId: "m99",
        teamName: "Far Team",
        gameId: "g99",
        status: "Out",
        source: "ESPN",
        updatedAt: "2026-11-25T00:00:00Z",
      },
    ];
    const { counts, failed } = await syncRunToSupabase(client, {
      slateDate: "2026-11-26",
      slate,
      injuries,
      players: [] as ModelPlayer[],
      ranking: [],
    });
    expect(failed).toEqual([]);
    expect(counts.injuries).toBe(1);
    expect(counts.players).toBe(1);
    expect(client.tables.players?.some((p) => (p as { id: string }).id === "4066648")).toBe(
      true
    );
  });

  it("continues after a table failure", async () => {
    const client = mockClient();
    client.failTable = "games";
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { failed } = await syncRunToSupabase(client, {
      slateDate: "2026-11-26",
      slate,
      injuries: [],
      players: [],
      ranking: [],
    });
    expect(failed).toContain("games");
    expect(client.tables.teams?.length).toBeGreaterThan(0);
    warn.mockRestore();
  });
});

describe("isEspnPlayerId", () => {
  it("accepts numeric espn ids only", () => {
    expect(isEspnPlayerId("4066648")).toBe(true);
    expect(isEspnPlayerId("x")).toBe(false);
    expect(isEspnPlayerId("")).toBe(false);
    expect(isEspnPlayerId(undefined)).toBe(false);
    expect(isEspnPlayerId(null)).toBe(false);
    expect(isEspnPlayerId(4066648)).toBe(false);
  });
});

describe("supabase invalid injury id", () => {
  it("skips and counts undefined playerId without throwing", async () => {
    const client = mockClient();
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const injuries = [
      {
        playerId: undefined,
        playerName: "Broken Row",
        teamId: "m99",
        teamName: "Far Team",
        gameId: "g99",
        status: "Out",
        source: "ESPN",
        updatedAt: "2026-11-25T00:00:00Z",
      },
    ] as unknown as InjuryEntry[];
    const { counts, failed } = await syncRunToSupabase(client, {
      slateDate: "2026-11-26",
      slate,
      injuries,
      players: [] as ModelPlayer[],
      ranking: [],
    });
    expect(failed).toEqual([]);
    expect(counts.injuries).toBe(0);
    expect(counts.injuriesSkippedInvalidId).toBe(1);
    expect(log).toHaveBeenCalledWith(
      expect.stringContaining("skipped 1 injury row(s)")
    );
    log.mockRestore();
  });
});