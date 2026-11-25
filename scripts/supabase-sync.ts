import type { InjuryEntry, PickLeg, SlateGame } from "../lib/types.js";
import type { ModelPlayer } from "./model-engine.js";
import type { GameInjuryRank } from "../lib/game-injury-ranking.js";
import { loadSupabaseConfig } from "./lib/supabase-env.js";
import { normalizePlayerName } from "../lib/player-names.js";
import type { OddsCacheFile } from "./odds-schedule.js";
import type { OfficialCardFile } from "../lib/official-card-time.js";

export type SupabaseUpsertClient = {
  upsert(table: string, rows: Record<string, unknown>[], onConflict: string): Promise<void>;
  fromSelect<T>(table: string, query: Record<string, string>): Promise<T | null>;
  insert(table: string, row: Record<string, unknown>): Promise<{ id?: string }>;
};

export type SupabaseConnectResult =
  | { client: SupabaseUpsertClient; skipReason?: undefined }
  | { client: null; skipReason: string };

export interface SyncCounts {
  teams: number;
  players: number;
  games: number;
  injuries: number;
  injuriesSkippedInvalidId: number;
  logs: number;
  slates: number;
  oddsPulls: number;
  oddsPrices: number;
  oddsBudget: number;
}

export async function createSupabaseClient(
  rootDir: string
): Promise<SupabaseConnectResult> {
  const { url, secretKey } = loadSupabaseConfig(rootDir);
  if (!url && !secretKey) {
    return { client: null, skipReason: "NBA_EDGE_SUPABASE_URL or SECRET_KEY not set" };
  }
  if (!url) {
    return { client: null, skipReason: "NBA_EDGE_SUPABASE_URL not set" };
  }
  if (!secretKey) {
    return { client: null, skipReason: "NBA_EDGE_SUPABASE_SECRET_KEY not set" };
  }
  try {
    const { createClient } = await import("@supabase/supabase-js");
    const client = createClient(url, secretKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      realtime: { params: { eventsPerSecond: 0 } },
      global: { headers: { "X-Client-Info": "nba-edge-pipeline-rest" } },
    });
    const wrapper: SupabaseUpsertClient = {
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
    return { client: wrapper };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { client: null, skipReason: `client init failed: ${msg}` };
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

/** ESPN athlete ids are numeric; skip synthetic/missing ids for players + injuries. */
export function isEspnPlayerId(id: unknown): boolean {
  if (typeof id !== "string") return false;
  const trimmed = id.trim();
  if (!trimmed) return false;
  return /^\d{2,}$/.test(trimmed);
}

export type SyncRunResult = {
  counts: SyncCounts;
  failed: string[];
};

export interface SlateSyncBundle {
  slateDate: string;
  slate: SlateGame[];
  injuries: InjuryEntry[];
  players: ModelPlayer[];
  picks?: PickLeg[];
  ranking: GameInjuryRank[];
  pullTrigger?: string;
  creditsUsed?: number;
  creditsRemaining?: number;
  gamesPulled?: string[];
  oddsPayloads?: unknown[];
  pulledAt?: string;
  slateStatus?: "draft" | "official" | "locked";
  cache?: OddsCacheFile;
  officialCard?: OfficialCardFile;
}

function flattenPayloadPrices(
  payloads: unknown[],
  playerByNorm: Map<string, string>,
  gameByPlayer: Map<string, string>
): Record<string, unknown>[] {
  const rows: Record<string, unknown>[] = [];
  for (const ev of payloads) {
    if (!ev) continue;
    const e = ev as {
      id?: string;
      bookmakers?: {
        title: string;
        markets?: {
          key: string;
          outcomes?: { name: string; price: number; description?: string; point?: number }[];
        }[];
      }[];
    };
    for (const bm of e.bookmakers ?? []) {
      for (const market of bm.markets ?? []) {
        for (const out of market.outcomes ?? []) {
          const player = out.description?.trim() ?? "";
          if (!player) continue;
          const norm = normalizePlayerName(player);
          const playerId = playerByNorm.get(norm);
          const gameId = playerId ? gameByPlayer.get(playerId) : e.id;
          if (!playerId || !gameId) continue;
          const line =
            out.point ?? Number(out.name.match(/(\d+(?:\.\d+)?)/)?.[1] ?? 0);
          rows.push({
            player_id: playerId,
            game_id: gameId,
            market: market.key,
            line,
            bookie: bm.title,
            price: out.price,
          });
        }
      }
    }
  }
  return rows;
}

function pricesFromOddsMap(
  oddsMap: Record<string, { price: number; bookie: string }>,
  playerByNorm: Map<string, string>,
  gameByPlayer: Map<string, string>
): Record<string, unknown>[] {
  const rows: Record<string, unknown>[] = [];
  for (const [key, v] of Object.entries(oddsMap)) {
    const [name, market, lineStr] = key.split("|");
    const playerId = playerByNorm.get(name) ?? playerByNorm.get(normalizePlayerName(name));
    const gameId = playerId ? gameByPlayer.get(playerId) : undefined;
    if (!playerId || !gameId) continue;
    const apiMarket =
      market === "pts"
        ? "player_points"
        : market === "reb"
          ? "player_rebounds"
          : market === "ast"
            ? "player_assists"
            : market === "3pm"
              ? "player_threes"
              : market;
    rows.push({
      player_id: playerId,
      game_id: gameId,
      market: apiMarket,
      line: Number(lineStr),
      bookie: v.bookie,
      price: v.price,
    });
  }
  return rows;
}

export type OddsPriceRow = {
  pull_id?: string;
  player_id: string;
  game_id: string;
  market: string;
  line: number;
  bookie: string;
  price: number;
};

/** Keep best (highest decimal) price per idempotent upsert key. */
/** Keep one injury row per player/source/report minute (ESPN updatedAt, not sync run time). */
export function dedupeInjuryReportsByTime(injuries: InjuryEntry[]): InjuryEntry[] {
  const best = new Map<string, InjuryEntry>();
  for (const inj of injuries) {
    const reported = inj.updatedAt ?? "";
    const minute = reported.slice(0, 16);
    const key = `${inj.playerId}|${injurySource(inj.source)}|${minute}`;
    const prev = best.get(key);
    if (!prev || new Date(reported) >= new Date(prev.updatedAt)) {
      best.set(key, inj);
    }
  }
  return [...best.values()];
}

export function dedupeOddsPriceRows(rows: OddsPriceRow[]): OddsPriceRow[] {
  const best = new Map<string, OddsPriceRow>();
  for (const r of rows) {
    const pullId = r.pull_id ?? "";
    const key = `${pullId}|${r.player_id}|${r.market}|${r.line}|${r.bookie}`;
    const prev = best.get(key);
    if (!prev || r.price >= prev.price) best.set(key, r);
  }
  return [...best.values()];
}

export async function syncRunToSupabase(
  client: SupabaseUpsertClient,
  bundle: SlateSyncBundle
): Promise<SyncRunResult> {
  const counts: SyncCounts = {
    teams: 0,
    players: 0,
    games: 0,
    injuries: 0,
    injuriesSkippedInvalidId: 0,
    logs: 0,
    slates: 0,
    oddsPulls: 0,
    oddsPrices: 0,
    oddsBudget: 0,
  };
  const failed: string[] = [];

  const injuriesDeduped = dedupeInjuryReportsByTime(bundle.injuries);

  let injuriesSkippedInvalidId = 0;
  for (const inj of injuriesDeduped) {
    if (!isEspnPlayerId(inj.playerId)) injuriesSkippedInvalidId += 1;
  }
  counts.injuriesSkippedInvalidId = injuriesSkippedInvalidId;
  if (injuriesSkippedInvalidId > 0) {
    console.log(
      `supabase sync: skipped ${injuriesSkippedInvalidId} injury row(s) with missing or invalid player id`
    );
  }

  const tryTable = async (table: string, fn: () => Promise<void>): Promise<void> => {
    try {
      await fn();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.warn(`supabase sync: ${table} failed: ${msg}`);
      failed.push(table);
    }
  };

  const teamRows = new Map<string, { id: string; name: string }>();
  for (const g of bundle.slate) {
    teamRows.set(g.homeTeamId, { id: g.homeTeamId, name: g.homeTeam });
    teamRows.set(g.awayTeamId, { id: g.awayTeamId, name: g.awayTeam });
  }
  for (const inj of bundle.injuries) {
    if (inj.teamId && inj.teamName) {
      teamRows.set(inj.teamId, { id: inj.teamId, name: inj.teamName });
    }
  }
  const teams = [...teamRows.values()];
  await tryTable("teams", async () => {
    await client.upsert("teams", teams, "id");
    counts.teams = teams.length;
  });

  const onSlate = (teamId: string) =>
    bundle.slate.some((g) => g.homeTeamId === teamId || g.awayTeamId === teamId);

  const slatePlayers = bundle.players.filter(
    (p) => onSlate(p.teamId) && isEspnPlayerId(p.id)
  );
  const playerById = new Map(
    slatePlayers.map((p) => [
      p.id,
      {
        id: p.id,
        team_id: p.teamId,
        full_name: p.name,
        headshot_url: p.headshotUrl,
        position: p.position ?? null,
      },
    ])
  );
  for (const inj of injuriesDeduped) {
    if (!isEspnPlayerId(inj.playerId) || playerById.has(inj.playerId)) continue;
    playerById.set(inj.playerId, {
      id: inj.playerId,
      team_id: inj.teamId,
      full_name: inj.playerName,
      headshot_url: "",
    });
  }
  const playerRows = [...playerById.values()];
  await tryTable("players", async () => {
    await client.upsert("players", playerRows, "id");
    counts.players = playerRows.length;
  });

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
  await tryTable("games", async () => {
    await client.upsert("games", gameRows, "id");
    counts.games = gameRows.length;
  });

  const injRows = injuriesDeduped
    .filter((i) => isEspnPlayerId(i.playerId))
    .map((i) => ({
      player_id: i.playerId,
      team_id: i.teamId,
      game_id: i.gameId || null,
      status: i.status,
      source: injurySource(i.source),
      reported_at: i.updatedAt,
      payload: { player_name: i.playerName, team_name: i.teamName },
    }));
  await tryTable("injury_reports", async () => {
    await client.upsert("injury_reports", injRows, "player_id,reported_at,source");
    counts.injuries = injRows.length;
  });

  const logRows: Record<string, unknown>[] = [];
  for (const p of slatePlayers) {
    for (const g of p.gameLogs) {
      logRows.push({
        player_id: p.id,
        game_id: g.gameId,
        game_date: g.date,
        team_id: g.teamId ?? p.teamId,
        opponent_team_id: g.opponentTeamId ?? null,
        is_home: g.isHome ?? null,
        minutes: g.minutes,
        pts: g.pts,
        reb: g.reb,
        ast: g.ast,
        threes: g.threes,
        q1_pts: g.q1Pts ?? null,
        q1_reb: g.q1Reb ?? null,
        q1_ast: g.q1Ast ?? null,
        fga: g.fga ?? null,
        fta: g.fta ?? null,
        turnovers: g.turnovers ?? null,
      });
    }
  }
  await tryTable("player_game_logs", async () => {
    await client.upsert("player_game_logs", logRows, "player_id,game_date,game_id");
    counts.logs = logRows.length;
  });

  await tryTable("slates", async () => {
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
    counts.slates = 1;
  });

  const syncedPlayerIds = new Set(playerRows.map((p) => p.id));
  const playerByNorm = new Map<string, string>();
  for (const p of bundle.players) {
    if (syncedPlayerIds.has(p.id)) {
      playerByNorm.set(normalizePlayerName(p.name), p.id);
    }
  }
  for (const inj of injuriesDeduped) {
    if (isEspnPlayerId(inj.playerId)) {
      playerByNorm.set(normalizePlayerName(inj.playerName), inj.playerId);
    }
  }
  const gameByPlayer = new Map<string, string>();
  for (const p of slatePlayers) {
    gameByPlayer.set(p.id, p.gameId);
  }
  for (const inj of injuriesDeduped) {
    if (isEspnPlayerId(inj.playerId) && inj.gameId) {
      gameByPlayer.set(inj.playerId, inj.gameId);
    }
  }

  const pullTrigger =
    bundle.pullTrigger ??
    (bundle.cache?.pullSlotsToday?.includes("scheduled_9pm")
      ? "scheduled_9pm"
      : bundle.cache?.pullSlotsToday?.includes("pretip")
        ? "pretip"
        : undefined);

  if (pullTrigger || bundle.cache?.oddsMap) {
    const pulledAt =
      bundle.pulledAt ?? bundle.cache?.lastPulled ?? new Date().toISOString();

    await tryTable("odds_pulls", async () => {
      await client.upsert(
        "odds_pulls",
        [
          {
            slate_date: bundle.slateDate,
            pull_trigger: pullTrigger ?? "scheduled_9pm",
            pulled_at: pulledAt,
            ranking: bundle.ranking,
            credits_used: bundle.creditsUsed ?? null,
            credits_remaining:
              bundle.creditsRemaining ?? bundle.cache?.creditsRemaining ?? null,
            games_pulled: bundle.gamesPulled ?? [],
          },
        ],
        "slate_date,pull_trigger"
      );
      counts.oddsPulls = 1;
    });

    await tryTable("odds_prices", async () => {
      const pullRow = await client.fromSelect<{ id: string }>("odds_pulls", {
        slate_date: bundle.slateDate,
        pull_trigger: pullTrigger ?? "scheduled_9pm",
      });

      let priceRows =
        bundle.oddsPayloads?.length
          ? flattenPayloadPrices(bundle.oddsPayloads, playerByNorm, gameByPlayer)
          : [];
      if (!priceRows.length && bundle.cache?.oddsMap) {
        priceRows = pricesFromOddsMap(
          bundle.cache.oddsMap,
          playerByNorm,
          gameByPlayer
        );
      }
      if (pullRow?.id && priceRows.length) {
        const withPull = dedupeOddsPriceRows(
          priceRows.map((r) => ({
            ...(r as OddsPriceRow),
            pull_id: pullRow.id,
          }))
        );
        await client.upsert(
          "odds_prices",
          withPull as Record<string, unknown>[],
          "pull_id,player_id,market,line,bookie"
        );
        counts.oddsPrices = withPull.length;
      }
    });
  }

  if (bundle.officialCard) {
    const card = bundle.officialCard;
    await tryTable("cards", async () => {
      await client.upsert(
        "cards",
        [
          {
            slate_date: bundle.slateDate,
            is_official: true,
            is_settled: false,
            locked_at: card.lockedAt,
            published_at: card.republishedAt ?? card.publishedAt ?? card.lockedAt,
            bookie: card.bookie,
            what_changed: card.whatChanged ?? [],
            odds_last_pulled: card.oddsLastPulled ?? null,
            not_built: card.notBuilt ?? [],
          },
        ],
        "slate_date"
      );
    });
  }

  return { counts, failed };
}

export async function loadOddsBudgetFromSupabase(
  client: SupabaseUpsertClient,
  monthKey: string
): Promise<{
  monthlyLimit: number;
  resetDay: number;
  pretipPull: boolean;
  creditsRemaining?: number;
  creditsPerGame: number;
} | null> {
  try {
    const row = await client.fromSelect<{
      credits_monthly: number;
      reset_day: number;
      pretip_pull: boolean;
      credits_remaining: number | null;
      last_credits_per_game: number | null;
    }>("odds_budget", { month_key: monthKey });
    if (!row) {
      return { monthlyLimit: 500, resetDay: 1, pretipPull: false, creditsPerGame: 10 };
    }
    return {
      monthlyLimit: row.credits_monthly ?? 500,
      resetDay: row.reset_day ?? 1,
      pretipPull: row.pretip_pull ?? false,
      creditsRemaining: row.credits_remaining ?? undefined,
      creditsPerGame: row.last_credits_per_game ?? 10,
    };
  } catch {
    return { monthlyLimit: 500, resetDay: 1, pretipPull: false, creditsPerGame: 10 };
  }
}

export async function upsertOddsBudgetForMonth(
  client: SupabaseUpsertClient,
  monthKey: string,
  opts: {
    monthlyLimit?: number;
    resetDay?: number;
    pretipPull?: boolean;
    creditsRemaining?: number | null;
    creditsPerGame?: number;
  }
): Promise<void> {
  const existing = await loadOddsBudgetFromSupabase(client, monthKey);
  const base = existing ?? {
    monthlyLimit: 500,
    resetDay: 1,
    pretipPull: false,
    creditsPerGame: 10,
  };
  const row = {
    month_key: monthKey,
    credits_monthly: opts.monthlyLimit ?? base.monthlyLimit,
    credits_remaining:
      opts.creditsRemaining !== undefined
        ? opts.creditsRemaining
        : base.creditsRemaining ?? null,
    reset_day: opts.resetDay ?? base.resetDay,
    pretip_pull: opts.pretipPull ?? base.pretipPull,
    last_credits_per_game: opts.creditsPerGame ?? base.creditsPerGame,
  };
  await client.upsert("odds_budget", [row], "month_key");
}

/** @deprecated use upsertOddsBudgetForMonth */
export async function saveOddsBudgetAfterPull(
  client: SupabaseUpsertClient,
  monthKey: string,
  opts: {
    monthlyLimit: number;
    resetDay: number;
    pretipPull: boolean;
    creditsRemaining?: number;
    creditsPerGame: number;
  }
): Promise<void> {
  try {
    await upsertOddsBudgetForMonth(client, monthKey, opts);
  } catch (e) {
    console.warn(
      "supabase odds_budget update failed:",
      e instanceof Error ? e.message : e
    );
  }
}

export function logSyncCounts(counts: SyncCounts, failed: string[] = []): void {
  const failLabel = failed.length ? failed.join(", ") : "none";
  const skipInj =
    counts.injuriesSkippedInvalidId > 0
      ? `, injuries_skipped_invalid_id ${counts.injuriesSkippedInvalidId}`
      : "";
  console.log(
    `supabase sync: teams ${counts.teams}, players ${counts.players}, games ${counts.games}, ` +
      `injuries ${counts.injuries}, logs ${counts.logs}, slates ${counts.slates}, ` +
      `odds_pulls ${counts.oddsPulls}, odds_prices ${counts.oddsPrices}, ` +
      `odds_budget ${counts.oddsBudget}${skipInj} (failed: ${failLabel})`
  );
}

export async function finalizePipelineSupabaseSync(
  rootDir: string,
  bundles: SlateSyncBundle[]
): Promise<void> {
  if (!bundles.length) {
    console.log("supabase sync skipped: no slate bundles this run");
    return;
  }
  const conn = await createSupabaseClient(rootDir);
  if (!conn.client) {
    console.log(`supabase sync skipped: ${conn.skipReason}`);
    return;
  }
  const totals: SyncCounts = {
    teams: 0,
    players: 0,
    games: 0,
    injuries: 0,
    injuriesSkippedInvalidId: 0,
    logs: 0,
    slates: 0,
    oddsPulls: 0,
    oddsPrices: 0,
    oddsBudget: 0,
  };
  const allFailed = new Set<string>();
  for (const bundle of bundles) {
    const { counts: c, failed } = await syncRunToSupabase(conn.client, bundle);
    for (const f of failed) allFailed.add(f);
    totals.teams += c.teams;
    totals.players += c.players;
    totals.games += c.games;
    totals.injuries += c.injuries;
    totals.injuriesSkippedInvalidId += c.injuriesSkippedInvalidId;
    totals.logs += c.logs;
    totals.slates += c.slates;
    totals.oddsPulls += c.oddsPulls;
    totals.oddsPrices += c.oddsPrices;
    totals.oddsBudget += c.oddsBudget;
  }

  const monthKey =
    [...bundles].map((b) => b.slateDate).sort().at(-1)?.slice(0, 7) ??
    new Date().toISOString().slice(0, 7);
  let creditsRemaining: number | null | undefined;
  for (const b of bundles) {
    if (b.creditsRemaining != null) creditsRemaining = b.creditsRemaining;
    else if (b.cache?.creditsRemaining != null) creditsRemaining = b.cache.creditsRemaining;
  }
  try {
    await upsertOddsBudgetForMonth(conn.client, monthKey, {
      creditsRemaining: creditsRemaining ?? null,
    });
    totals.oddsBudget = 1;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn(`supabase sync: odds_budget failed: ${msg}`);
    allFailed.add("odds_budget");
  }

  logSyncCounts(totals, [...allFailed]);
}