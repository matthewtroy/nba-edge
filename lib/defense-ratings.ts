import type { PlayerGameLog } from "./types.js";
import type { GameLogCacheFile } from "./game-log-cache.js";
import { positionBucket } from "./position-bucket.js";

export type DefenseWindow = "last15" | "season";

export interface DefenseRankRow {
  teamId: string;
  positionBucket: "G" | "F" | "C";
  window: DefenseWindow;
  stat: "pts" | "reb" | "ast" | "3pm";
  allowedPer48: number;
  rank: number;
}

export interface PaceRankRow {
  teamId: string;
  pacePer48: number;
  rank: number;
  window: DefenseWindow;
}

export interface DefenseRatingsBundle {
  defense: DefenseRankRow[];
  pace: PaceRankRow[];
  unavailable: string[];
}

function statFromLog(log: PlayerGameLog, stat: "pts" | "reb" | "ast" | "3pm"): number {
  if (stat === "3pm") return log.threes;
  return log[stat];
}

/** Each team's 15 most recent games by date (played, win or loss). */
export function teamLast15GameIds(cache: GameLogCacheFile): Map<string, Set<string>> {
  const gamesByTeam = new Map<string, Map<string, string>>();
  for (const row of Object.values(cache)) {
    for (const log of row.logs) {
      if (!log.gameId || !log.date) continue;
      const register = (teamId: string) => {
        const m = gamesByTeam.get(teamId) ?? new Map<string, string>();
        const prev = m.get(log.gameId);
        if (!prev || log.date > prev) m.set(log.gameId, log.date);
        gamesByTeam.set(teamId, m);
      };
      if (log.teamId) register(log.teamId);
      if (log.opponentTeamId) register(log.opponentTeamId);
    }
  }
  const out = new Map<string, Set<string>>();
  for (const [teamId, games] of gamesByTeam) {
    const sorted = [...games.entries()].sort((a, b) => b[1].localeCompare(a[1]));
    out.set(teamId, new Set(sorted.slice(0, 15).map(([id]) => id)));
  }
  return out;
}

function logInTeamWindow(
  defTeam: string,
  gameId: string,
  window: DefenseWindow,
  teamL15: Map<string, Set<string>>
): boolean {
  if (window === "season") return true;
  return teamL15.get(defTeam)?.has(gameId) ?? false;
}

/** Build defense vs position + pace ranks from cached ESPN logs (no Odds API). */
export function buildDefenseRatings(
  cache: GameLogCacheFile,
  playerMeta: Map<string, { teamId: string; position?: string }>
): DefenseRatingsBundle {
  const unavailable: string[] = [];
  if (!Object.keys(cache).length) {
    unavailable.push("defense: empty game-log cache");
    return { defense: [], pace: [], unavailable };
  }

  const teamL15 = teamLast15GameIds(cache);
  type AccKey = string;
  const acc = new Map<AccKey, { minutes: number; statSum: number }>();
  const paceAcc = new Map<string, { minutes: number; poss: number }>();

  for (const [playerId, row] of Object.entries(cache)) {
    const meta = playerMeta.get(playerId);
    if (!meta) continue;
    const pos = positionBucket(meta.position);
    for (const log of row.logs) {
      if (!log.opponentTeamId || log.minutes < 1) continue;
      const defTeam = log.opponentTeamId;
      for (const stat of ["pts", "reb", "ast", "3pm"] as const) {
        for (const window of ["season", "last15"] as const) {
          if (!logInTeamWindow(defTeam, log.gameId, window, teamL15)) continue;
          const key = `${defTeam}|${pos}|${window}|${stat}`;
          const cur = acc.get(key) ?? { minutes: 0, statSum: 0 };
          cur.minutes += log.minutes;
          cur.statSum += statFromLog(log, stat);
          acc.set(key, cur);
        }
      }
      if (logInTeamWindow(defTeam, log.gameId, "season", teamL15)) {
        const paceKey = `${defTeam}|season`;
        const p = paceAcc.get(paceKey) ?? { minutes: 0, poss: 0 };
        p.minutes += log.minutes;
        p.poss += log.pts + log.reb + log.ast + (log.turnovers ?? 0);
        paceAcc.set(paceKey, p);
      }
    }
  }

  if (!acc.size) {
    unavailable.push("defense: logs missing opponentTeamId (backfill ESPN metadata)");
  }

  const teamIds = [...new Set([...acc.keys(), ...paceAcc.keys()].map((k) => k.split("|")[0]))].sort();

  const defense: DefenseRankRow[] = [];
  for (const stat of ["pts", "reb", "ast", "3pm"] as const) {
    for (const window of ["season", "last15"] as const) {
      for (const pos of ["G", "F", "C"] as const) {
        const rows: { teamId: string; allowedPer48: number }[] = [];
        for (const teamId of teamIds) {
          const key = `${teamId}|${pos}|${window}|${stat}`;
          const a = acc.get(key);
          if (!a || a.minutes < 20) continue;
          const per48 = (a.statSum / a.minutes) * 48;
          rows.push({ teamId, allowedPer48: per48 });
        }
        rows.sort((a, b) => b.allowedPer48 - a.allowedPer48);
        rows.forEach((r, i) => {
          defense.push({
            teamId: r.teamId,
            positionBucket: pos,
            window,
            stat,
            allowedPer48: Math.round(r.allowedPer48 * 100) / 100,
            rank: Math.min(30, i + 1),
          });
        });
      }
    }
  }

  const pace: PaceRankRow[] = [];
  const paceRows = [...paceAcc.entries()]
    .map(([key, v]) => {
      const teamId = key.split("|")[0];
      const per48 = v.minutes > 0 ? (v.poss / v.minutes) * 48 : 0;
      return { teamId, pacePer48: per48 };
    })
    .filter((r) => r.pacePer48 > 0)
    .sort((a, b) => b.pacePer48 - a.pacePer48);
  paceRows.forEach((r, i) => {
    pace.push({
      teamId: r.teamId,
      pacePer48: Math.round(r.pacePer48 * 100) / 100,
      rank: Math.min(30, i + 1),
      window: "season",
    });
  });

  return { defense, pace, unavailable };
}

export function defenseRankFor(
  bundle: DefenseRatingsBundle,
  defendingTeamId: string,
  position: string | undefined,
  market: string,
  window: DefenseWindow = "last15"
): number | undefined {
  const stat =
    market === "3pm"
      ? "3pm"
      : market === "reb"
        ? "reb"
        : market === "ast"
          ? "ast"
          : market.startsWith("q1")
            ? "pts"
            : market === "pts"
              ? "pts"
              : "pts";
  const pos = positionBucket(position);
  return bundle.defense.find(
    (r) =>
      r.teamId === defendingTeamId &&
      r.positionBucket === pos &&
      r.window === window &&
      r.stat === stat
  )?.rank;
}

export function paceRank(bundle: DefenseRatingsBundle, teamId: string): number | undefined {
  return bundle.pace.find((p) => p.teamId === teamId)?.rank;
}

/** Spot-check: top 3 teams allowing reb to forwards (last 15). */
export function logDefenseSpotCheck(bundle: DefenseRatingsBundle): void {
  const top = bundle.defense
    .filter((r) => r.stat === "reb" && r.positionBucket === "F" && r.window === "last15")
    .sort((a, b) => a.rank - b.rank)
    .slice(0, 3);
  if (!top.length) {
    console.log("defense spot-check F reb L15: (no rows)");
    return;
  }
  console.log(
    "defense spot-check F reb L15 top3: " +
      top.map((r) => `${r.teamId}#${r.rank} (${r.allowedPer48})`).join(", ")
  );
  const topAst = bundle.defense
    .filter((r) => r.stat === "ast" && r.positionBucket === "F" && r.window === "last15")
    .sort((a, b) => a.rank - b.rank)
    .slice(0, 3);
  console.log(
    "defense spot-check F ast L15 top3: " +
      topAst.map((r) => `${r.teamId}#${r.rank} (${r.allowedPer48})`).join(", ")
  );
  const worst = bundle.defense
    .filter((r) => r.stat === "reb" && r.positionBucket === "F" && r.window === "last15")
    .sort((a, b) => b.rank - a.rank)
    .slice(0, 3);
  console.log(
    "defense spot-check F reb L15 bottom3: " +
      worst.map((r) => `${r.teamId}#${r.rank} (${r.allowedPer48})`).join(", ")
  );
}