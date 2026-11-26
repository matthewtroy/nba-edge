import { parseBoxscore, type BoxLine } from "../scripts/espn-parse.js";
import { yyyymmdd } from "../scripts/fetch/espn.js";
import { normalizeEspnGameStatus, slateStatusLabel } from "./slate-espn-status.js";

export const LIVE_POLL_MS = 5000;
export const LIVE_SOURCE = "espn-direct" as const;

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

export interface LiveSourceProvider {
  readonly id: typeof LIVE_SOURCE | "mock";
  fetchScoreboard(date: Date, signal?: AbortSignal): Promise<unknown>;
  fetchSummary(gameId: string, signal?: AbortSignal): Promise<unknown>;
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

export async function buildLiveSnapshot(
  provider: LiveSourceProvider,
  date: Date,
  gameIds: string[],
  signal?: AbortSignal
): Promise<LiveSourceSnapshot> {
  const raw = await provider.fetchScoreboard(date, signal);
  const games = parseLiveScoreboard(raw).filter((g) =>
    gameIds.length ? gameIds.includes(g.gameId) : true
  );
  const boxesByGame = new Map<string, Map<string, BoxLine>>();
  const liveOrFinal = games.filter((g) => g.phase !== "scheduled");
  await Promise.all(
    liveOrFinal.map(async (g) => {
      try {
        const summary = await provider.fetchSummary(g.gameId, signal);
        boxesByGame.set(g.gameId, boxesFromSummary(summary));
      } catch {
        /* keep status without box */
      }
    })
  );
  return {
    fetchedAt: new Date().toISOString(),
    games,
    boxesByGame,
  };
}

export interface LiveSubscribeOptions {
  provider: LiveSourceProvider;
  date: Date;
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

  const tick = async () => {
    if (stopped) return;
    inFlight?.abort();
    const ctrl = new AbortController();
    inFlight = ctrl;
    try {
      const snap = await buildLiveSnapshot(
        opts.provider,
        opts.date,
        opts.gameIds,
        ctrl.signal
      );
      if (stopped || ctrl.signal.aborted) return;
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
        timer = setTimeout(tick, backoffMs);
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
    async fetchScoreboard(date, signal) {
      const url = `${ESPN_SCOREBOARD}?dates=${yyyymmdd(date)}`;
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
  scoreboard: unknown;
  summaries: Record<string, unknown>;
}

export function createMockLiveProvider(data: MockLiveProviderData): LiveSourceProvider {
  return {
    id: "mock",
    async fetchScoreboard() {
      return data.scoreboard;
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
  const allowOrigin = res.headers.get("access-control-allow-origin");
  const ok =
    res.ok &&
    (allowOrigin === "*" || allowOrigin === pagesOrigin || allowOrigin != null);
  return { ok, allowOrigin, status: res.status };
}