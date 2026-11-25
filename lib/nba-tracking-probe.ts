import { NBA_STATS_HEADERS } from "./nba-stats-headers.js";

const PROBE_URL =
  "https://stats.nba.com/stats/commonallplayers?IsOnlyCurrentSeason=1&LeagueID=00&Season=2025-26";

export type TrackingSourceStatus = "ok" | "blocked";

export async function probeNbaStats(timeoutMs = 12000): Promise<{
  status: TrackingSourceStatus;
  httpStatus?: number;
  detail?: string;
}> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(PROBE_URL, {
      headers: NBA_STATS_HEADERS,
      signal: ctrl.signal,
      cache: "no-store",
    });
    if (!res.ok) {
      return { status: "blocked", httpStatus: res.status, detail: `HTTP ${res.status}` };
    }
    const body = (await res.json()) as { resultSets?: unknown[] };
    if (!body.resultSets?.length) {
      return { status: "blocked", httpStatus: res.status, detail: "empty payload" };
    }
    return { status: "ok", httpStatus: res.status };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { status: "blocked", detail: msg };
  } finally {
    clearTimeout(t);
  }
}

export function logTrackingProbe(status: TrackingSourceStatus): void {
  console.log(`tracking: nba.com ${status}`);
}