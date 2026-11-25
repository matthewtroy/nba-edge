import type { InjuryEntry, SlateGame } from "../lib/types.js";
import type { ModelPlayer } from "./model-engine.js";
import type { GameInjuryRank } from "../lib/game-injury-ranking.js";
import { loadSupabaseConfig } from "./lib/supabase-env.js";
import { normalizePlayerName } from "../lib/player-names.js";

export type SupabaseUpsertClient = {
  upsert(table: string, rows: Record<string, unknown>[], onConflict: string): Promise<void>;
  fromSelect<T>(table: string, query: Record<string, string>): Promise<T | null>;
  insert(table: string, row: Record<string, unknown>): Promise<{ id?: string }>;
};

export async function createSupabaseClient(
  rootDir: string
): Promise<SupabaseUpsertClient | null> {
  const { url, secretKey } = loadSupabaseConfig(rootDir);
  if (!url || !secretKey) {
    console.log("Supabase sync skipped");
    return null;
  }
  try {
    const { createClient } = await import("@supabase/supabase-js");
    const client = createClient(url, secretKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    return {
      async upsert(table, rows, onConflict) {
        if (!rows.length) return;
        const { error } = await client.from(table).upsert(rows, { onConflict });
        if (error) throw new Error(error.message);
      },
      async fromSelect(table, query) {
        let q = client.from(table).select("*");
        for (const [k, v] of Object.entries(query)) {
          q = q.eq(k, v);
        }
        const { data, error } = await q.maybeSingle();
        if (error) throw new Error(error.message);
        return data as never;
      },
      async insert(table, row) {
        const { data, error } = await client.from(table).insert(row).select("id").single();
        if (error) throw new Error(error.message);
        return { id: (data as { id?: string })?.id };
      },
    };
  } catch (e) {
    console.warn("Supabase sync skipped:", e instanceof Error ? e.message : e);
    return null;
  }
}

function mapGameStatus(status: string): string {
  const s = status.toLowerCase();
  if (s.includes("final")) return "final";
  if (s.includes("progress") || s.includes("halftime")) return "in_progress";
  return "scheduled";
}

function injurySource(source: string): "espn" | "nba_official" {
  return source === "NBA Official" ? "nba_official" : "espn";
}

export interface SlateSyncBundle {
  slateDate: string;
  slate: SlateGame[];
  injuries: InjuryEntry[];
  players: ModelPlayer[];
  ranking: GameInjuryRank[];
  pullTrigger?: string;
  creditsUsed?: number;
  creditsRemaining?: number;
  gamesPulled?: string[];
  oddsPayloads?: unknown[];
  pulledAt?: string;
  slateStatus?: "draft" | "official" | "locked";
}

export async function syncRunToSupabase(
  client: SupabaseUpsertClient,
  bundle: SlateSyncBundle
): Promise<void> {
  try {
    const teamRows = new Map<string, { id: string; name: string }>();
    for (const g of bundle.slate) {
      teamRows.set(g.homeTeamId, { id: g.homeTeamId, name: g.homeTeam });
      teamRows.set(g.awayTeamId, { id: g.awayTeamId, name: g.awayTeam });
    }
    await client.upsert("teams", [...teamRows.values()], "id");

    const playerRows = bundle.players.map((p) => ({
      id: p.id,
      team_id: p.teamId,
      full_name: p.name,
      headshot_url: p.headshotUrl,
    }));
    await client.upsert("players", playerRows, "id");

    const gameRows = bundle.slate.map((g) => ({
      id: g.id,
      slate_date: bundle.slateDate,
      start_time: g.startTime,
      start_time_sydney: g.startTimeSydney,
      home_team_id: g.homeTeamId,
      away_team_id: g.awayTeamId,
      spread: g.spread ?? null,
      total: g.total ?? null,
      home_b2b: g.homeB2B,
      away_b2b: g.awayB2B,
      status: mapGameStatus(g.status),
    }));
    await client.upsert("games", gameRows, "id");

    const injRows = bundle.injuries.map((i) => ({
      player_id: i.playerId,
      team_id: i.teamId,
      game_id: i.gameId || null,
      status: i.status,
      source: injurySource(i.source),
      reported_at: i.updatedAt,
      payload: { player_name: i.playerName, team_name: i.teamName },
    }));
    await client.upsert(
      "injury_reports",
      injRows,
      "player_id,reported_at,source"
    );

    const logRows: Record<string, unknown>[] = [];
    for (const p of bundle.players) {
      for (const g of p.gameLogs) {
        logRows.push({
          player_id: p.id,
          game_id: g.gameId,
          game_date: g.date,
          minutes: g.minutes,
          pts: g.pts,
          reb: g.reb,
          ast: g.ast,
          threes: g.threes,
          q1_pts: g.q1Pts ?? null,
          q1_reb: g.q1Reb ?? null,
          q1_ast: g.q1Ast ?? null,
        });
      }
    }
    await client.upsert(
      "player_game_logs",
      logRows,
      "player_id,game_date,game_id"
    );

    await client.upsert(
      "slates",
      [
        {
          slate_date: bundle.slateDate,
          status: bundle.slateStatus ?? "draft",
          game_count: bundle.slate.length,
          last_updated: new Date().toISOString(),
        },
      ],
      "slate_date"
    );

    if (bundle.pullTrigger) {
      await client.upsert(
        "odds_pulls",
        [
          {
            slate_date: bundle.slateDate,
            pull_trigger: bundle.pullTrigger,
            pulled_at: bundle.pulledAt ?? new Date().toISOString(),
            ranking: bundle.ranking,
            credits_used: bundle.creditsUsed ?? null,
            credits_remaining: bundle.creditsRemaining ?? null,
            games_pulled: bundle.gamesPulled ?? [],
          },
        ],
        "slate_date,pull_trigger"
      );
    }
  } catch (e) {
    console.warn("Supabase sync failed (JSON OK):", e instanceof Error ? e.message : e);
  }
}

export async function loadOddsBudgetFromSupabase(
  client: SupabaseUpsertClient,
  monthKey: string
): Promise<{
  monthlyLimit: number;
  resetDay: number;
  pretipPull: boolean;
  creditsRemaining?: number;
} | null> {
  try {
    const row = await client.fromSelect<{
      credits_monthly: number;
      reset_day: number;
      pretip_pull: boolean;
      credits_remaining: number | null;
    }>("odds_budget", { month_key: monthKey });
    if (!row) {
      return { monthlyLimit: 500, resetDay: 1, pretipPull: false };
    }
    return {
      monthlyLimit: row.credits_monthly ?? 500,
      resetDay: row.reset_day ?? 1,
      pretipPull: row.pretip_pull ?? false,
      creditsRemaining: row.credits_remaining ?? undefined,
    };
  } catch {
    return { monthlyLimit: 500, resetDay: 1, pretipPull: false };
  }
}