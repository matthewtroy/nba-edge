const BASE = "https://site.api.espn.com/apis/site/v2/sports/basketball/nba";
const LOG_BASE = "https://site.web.api.espn.com/apis/common/v3/sports/basketball/nba";

async function fetchJson<T>(url: string, retries = 3): Promise<T> {
  for (let i = 0; i < retries; i++) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 20000);
    try {
      const res = await fetch(url, { signal: ctrl.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return (await res.json()) as T;
    } catch (e) {
      if (i === retries - 1) throw e;
      await new Promise((r) => setTimeout(r, 500 * (i + 1)));
    } finally {
      clearTimeout(t);
    }
  }
  throw new Error("unreachable");
}

export function yyyymmdd(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

export async function fetchScoreboard(date: Date) {
  return fetchJson<unknown>(`${BASE}/scoreboard?dates=${yyyymmdd(date)}`);
}

export async function fetchSummary(eventId: string) {
  return fetchJson<unknown>(`${BASE}/summary?event=${eventId}`);
}

export async function fetchLeagueInjuries() {
  return fetchJson<unknown>(`${BASE}/injuries`);
}

export async function fetchRoster(teamId: string) {
  return fetchJson<unknown>(`${BASE}/teams/${teamId}/roster`);
}

export async function fetchPlayerGameLog(athleteId: string) {
  return fetchJson<unknown>(`${LOG_BASE}/athletes/${athleteId}/gamelog`);
}