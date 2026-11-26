import { parseBoxscore, type BoxLine } from "../scripts/espn-parse.js";
import { formatYyyymmddInZone } from "../scripts/espn-parse.js";
import { normalizeEspnGameStatus, slateStatusLabel } from "./slate-espn-status.js";
import type { SlateGame } from "./types.js";

export const LIVE_POLL_MS = 5000;
export const LIVE_SOURCE = "espn-direct" as const;
export const ESPN_SCOREBOARD_ET = "America/New_York";

const ESPN_SCOREBOARD =
  "https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard";
const ESPN_SUMMARY =
  "https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary";
export const PAGES_ORIGIN = "https://matthewtroy.github.io";

export interface LiveGameBoard {
  gameId: string;
  status: string;
  phase: "scheduled" | "live" | "final";
  period: number | null;
  statusDetail: string;
}

export interface LiveSourceSnapshot {
  fetchedAt: string;
  games: LiveGameBoard[];
  boxesByGame: Map<string, Map<string, BoxLine>>;
}

export type SlateGameTip = Pick<SlateGame, "id" | "startTime">;

export interface LiveSourceProvider {
  readonly id: typeof LIVE_SOURCE | "mock";
  /** `dates` query value: ESPN ET calendar day as YYYYMMDD (never Sydney slate date). */
  fetchScoreboard(etYyyymmdd: string, signal?: AbortSignal): Promise<unknown>;
  fetchSummary(gameId: string, signal?: AbortSignal): Promise<unknown>;
}

export function distinctEtScoreboardDates(slateGames: SlateGameTip[]): string[] {
  const seen = new Set<string>();
  for (const g of slateGames) {
    seen.add(formatYyyymmddInZone(new Date(g.startTime), ESPN_SCOREBOARD_ET));
  }
  return [...seen].sort();
}

export function parseLiveScoreboard(raw: unknown): LiveGameBoard[] {
  const data = raw as {
    events?: {
      id: string;
      status?: {
        period?: number;
        type?: { state?: string; name?: string; shortDetail?: string; detail?: string };
      };
    }[];
  };
  const out: LiveGameBoard[] = [];
  for (const event of data.events ?? []) {
    const st = event.status?.type;
    const phase = normalizeEspnGameStatus(st?.state ?? "", st?.name);
    const detail = st?.shortDetail ?? st?.detail ?? st?.name ?? "";
    out.push({
      gameId: event.id,
      phase,
      status: slateStatusLabel(phase),
      period: event.status?.period ?? null,
      statusDetail: detail,
    });
  }
  return out;
}

export function parseLiveGameFromSummary(gameId: string, summary: unknown): LiveGameBoard | null {
  const data = summary as {
    header?: {
      id?: string;
      competitions?: {
        id?: string;
        status?: {
          period?: number;
          type?: { state?: string; name?: string; shortDetail?: string; detail?: string };
        };
      }[];
    };
  };
  const comp = data.header?.competitions?.[0];
  if (!comp?.status?.type) return null;
  const st = comp.status.type;
  const phase = normalizeEspnGameStatus(st.state ?? "", st.name);
  const detail = st.shortDetail ?? st.detail ?? st.name ?? "";
  return {
    gameId,
    phase,
    status: slateStatusLabel(phase),
    period: comp.status.period ?? null,
    statusDetail: detail,
  };
}

export function stableSnapshotKey(snapshot: LiveSourceSnapshot): string {
  const parts: string[] = [];
  for (const g of snapshot.games) {
    parts.push(`${g.gameId}:${g.phase}:${g.period}:${g.statusDetail}`);
    const box = snapshot.boxesByGame.get(g.gameId);
    if (box) {
      for (const [pid, line] of box) {
        parts.push(`${pid}:${line.pts}/${line.reb}/${line.ast}/${line.minutes}`);
      }
    }
  }
  return parts.join("|");
}

export function boxesFromSummary(summary: unknown): Map<string, BoxLine> {
  return parseBoxscore(summary);
}

export function evaluateEspnCorsResponse(res: {
  ok: boolean;
  status: number;
  headers: { get(name: string): string | null };
}): { ok: boolean; allowOrigin: string | null; status: number } {
  const allowOrigin = res.headers.get("access-control-allow-origin");
  const ok =
    res.ok &&
    (allowOrigin === "*" || allowOrigin === PAGES_ORIGIN || allowOrigin != null);
  return { ok, allowOrigin, status: res.status };
}

export interface FinalLiveCache {
  games: Map<string, LiveGameBoard>;
  boxesByGame: Map<string, Map<string, BoxLine>>;
}

export interface BuildLiveSnapshotOpts {
  /** Finals merged from prior ticks — no ESPN poll for these ids. */
  finalCache?: FinalLiveCache;
}

export async function buildLiveSnapshot(
  provider: LiveSourceProvider,
  slateGames: SlateGameTip[],
  gameIds: string[],
  signal?: AbortSignal,
  opts?: BuildLiveSnapshotOpts
): Promise<LiveSourceSnapshot> {
  const finalCache = opts?.finalCache;
  const cachedFinalIds = new Set(finalCache?.games.keys() ?? []);
  const wantAll = gameIds.length ? gameIds : slateGames.map((g) => g.id);
  const want = new Set(wantAll.filter((id) => !cachedFinalIds.has(id)));
  const byId = new Map<string, LiveGameBoard>();
  for (const [id, row] of finalCache?.games ?? []) {
    byId.set(id, row);
  }

  const dated = slateGames.filter((g) => want.has(g.id));
  const pollSlate = dated.length ? dated : slateGames.filter((g) => !cachedFinalIds.has(g.id));
  const etDates = pollSlate.length ? distinctEtScoreboardDates(pollSlate) : [];

  if (want.size > 0) {
    await Promise.all(
      etDates.map(async (etDay) => {
        const raw = await provider.fetchScoreboard(etDay, signal);
        for (const row of parseLiveScoreboard(raw)) {
          if (want.has(row.gameId)) byId.set(row.gameId, row);
        }
      })
    );
  }

  const summaries = new Map<string, unknown>();
  async function loadSummary(gameId: string): Promise<unknown | null> {
    if (summaries.has(gameId)) return summaries.get(gameId)!;
    try {
      const summary = await provider.fetchSummary(gameId, signal);
      summaries.set(gameId, summary);
      return summary;
    } catch {
      return null;
    }
  }

  const missing = [...want].filter((id) => !byId.has(id));
  await Promise.all(
    missing.map(async (gameId) => {
      const summary = await loadSummary(gameId);
      if (!summary) return;
      const row = parseLiveGameFromSummary(gameId, summary);
      if (row) byId.set(gameId, row);
    })
  );

  const games = [...byId.values()].sort((a, b) => a.gameId.localeCompare(b.gameId));
  const boxesByGame = new Map<string, Map<string, BoxLine>>();
  for (const [id, box] of finalCache?.boxesByGame ?? []) {
    boxesByGame.set(id, box);
  }
  const needBox = games.filter(
    (g) => g.phase !== "scheduled" && !boxesByGame.has(g.gameId)
  );
  await Promise.all(
    needBox.map(async (g) => {
      const summary = await loadSummary(g.gameId);
      if (!summary) return;
      boxesByGame.set(g.gameId, boxesFromSummary(summary));
    })
  );

  return {
    fetchedAt: new Date().toISOString(),
    games,
    boxesByGame,
  };
}

export function mergeIntoFinalCache(
  snap: LiveSourceSnapshot,
  cache: FinalLiveCache
): FinalLiveCache {
  for (const g of snap.games) {
    if (g.phase !== "final") continue;
    cache.games.set(g.gameId, g);
    const box = snap.boxesByGame.get(g.gameId);
    if (box) cache.boxesByGame.set(g.gameId, box);
  }
  return cache;
}

export function activeLiveGameIds(
  slateGames: SlateGameTip[],
  gameIds: string[],
  cache: FinalLiveCache
): string[] {
  const all = gameIds.length ? gameIds : slateGames.map((g) => g.id);
  return all.filter((id) => !cache.games.has(id));
}

export interface LiveSubscribeOptions {
  provider: LiveSourceProvider;
  slateGames: SlateGameTip[];
  gameIds: string[];
  pollMs?: number;
  onSnapshot: (snap: LiveSourceSnapshot) => void;
  onError?: (err: unknown) => void;
}

export function subscribeLiveSource(opts: LiveSubscribeOptions): () => void {
  const pollMs = opts.pollMs ?? LIVE_POLL_MS;
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let inFlight: AbortController | null = null;
  let lastKey = "";
  let backoffMs = pollMs;
  const maxBackoff = pollMs * 8;
  const finalCache: FinalLiveCache = {
    games: new Map(),
    boxesByGame: new Map(),
  };

  const tick = async () => {
    if (stopped) return;
    const activeIds = activeLiveGameIds(opts.slateGames, opts.gameIds, finalCache);
    if (!activeIds.length) {
      if (finalCache.games.size > 0) {
        const snap: LiveSourceSnapshot = {
          fetchedAt: new Date().toISOString(),
          games: [...finalCache.games.values()].sort((a, b) =>
            a.gameId.localeCompare(b.gameId)
          ),
          boxesByGame: finalCache.boxesByGame,
        };
        const key = stableSnapshotKey(snap);
        if (key !== lastKey) {
          lastKey = key;
          opts.onSnapshot(snap);
        }
      }
      return;
    }
    inFlight?.abort();
    const ctrl = new AbortController();
    inFlight = ctrl;
    try {
      const snap = await buildLiveSnapshot(
        opts.provider,
        opts.slateGames,
        activeIds,
        ctrl.signal,
        { finalCache }
      );
      if (stopped || ctrl.signal.aborted) return;
      mergeIntoFinalCache(snap, finalCache);
      const key = stableSnapshotKey(snap);
      if (key !== lastKey) {
        lastKey = key;
        opts.onSnapshot(snap);
      }
      backoffMs = pollMs;
    } catch (e) {
      if (!stopped && !ctrl.signal.aborted) {
        opts.onError?.(e);
        backoffMs = Math.min(maxBackoff, backoffMs * 2);
      }
    } finally {
      if (!stopped) {
        const stillActive = activeLiveGameIds(opts.slateGames, opts.gameIds, finalCache);
        if (stillActive.length > 0) {
          timer = setTimeout(tick, backoffMs);
        }
      }
    }
  };

  timer = setTimeout(tick, 0);

  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
    inFlight?.abort();
  };
}

export function createEspnDirectProvider(): LiveSourceProvider {
  return {
    id: LIVE_SOURCE,
    async fetchScoreboard(etYyyymmdd, signal) {
      const url = `${ESPN_SCOREBOARD}?dates=${etYyyymmdd}`;
      const res = await fetch(url, { signal, cache: "no-store" });
      if (!res.ok) throw new Error(`ESPN scoreboard ${res.status}`);
      return res.json();
    },
    async fetchSummary(gameId, signal) {
      const url = `${ESPN_SUMMARY}?event=${encodeURIComponent(gameId)}`;
      const res = await fetch(url, { signal, cache: "no-store" });
      if (!res.ok) throw new Error(`ESPN summary ${res.status}`);
      return res.json();
    },
  };
}

export interface MockLiveProviderData {
  /** Per-ET-day scoreboards (`YYYYMMDD`); falls back to `scoreboard` when missing. */
  scoreboards?: Record<string, unknown>;
  scoreboard?: unknown;
  summaries: Record<string, unknown>;
}

export function createMockLiveProvider(data: MockLiveProviderData): LiveSourceProvider {
  return {
    id: "mock",
    async fetchScoreboard(etYyyymmdd) {
      const row = data.scoreboards?.[etYyyymmdd];
      if (row !== undefined) return row;
      if (data.scoreboard !== undefined) return data.scoreboard;
      return { events: [] };
    },
    async fetchSummary(gameId) {
      const row = data.summaries[gameId];
      if (!row) throw new Error(`mock missing summary ${gameId}`);
      return row;
    },
  };
}

/** Verify ESPN scoreboard allows browser fetch from GitHub Pages origin. */
export async function verifyEspnCorsForPages(
  pagesOrigin: string = PAGES_ORIGIN
): Promise<{ ok: boolean; allowOrigin: string | null; status: number }> {
  const url = `${ESPN_SCOREBOARD}?dates=20251126`;
  const res = await fetch(url, {
    method: "GET",
    headers: { Origin: pagesOrigin },
    cache: "no-store",
  });
  return evaluateEspnCorsResponse(res);
}