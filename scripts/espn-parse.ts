import type { InjuryEntry, InjuryStatus, PlayerGameLog, SlateGame } from "../lib/types.js";
import { toSydney } from "../lib/sydney.js";

const STATUS_MAP: Record<string, InjuryStatus> = {
  out: "Out",
  doubtful: "Doubtful",
  questionable: "Questionable",
  probable: "Probable",
  day: "Questionable",
};

export function formatYyyymmddInZone(d: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const y = parts.find((p) => p.type === "year")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  const day = parts.find((p) => p.type === "day")?.value;
  return `${y}${m}${day}`;
}

export function parseScoreboard(
  raw: unknown,
  teamIdsPlayedYesterday: Set<string>
): SlateGame[] {
  const data = raw as {
    events?: {
      id: string;
      date: string;
      status?: { type?: { state?: string; name?: string } };
      competitions?: {
        id: string;
        date: string;
        competitors?: {
          id: string;
          homeAway: string;
          team?: { id: string; displayName?: string; abbreviation?: string };
        }[];
        odds?: { spread?: number; overUnder?: number; details?: string }[];
      }[];
    }[];
  };

  const games: SlateGame[] = [];
  for (const event of data.events ?? []) {
    const comp = event.competitions?.[0];
    if (!comp) continue;
    const state = event.status?.type?.state ?? "";
    if (state === "post" && (event.status?.type?.name ?? "").toLowerCase().includes("final")) {
      continue;
    }
    const home = comp.competitors?.find((c) => c.homeAway === "home");
    const away = comp.competitors?.find((c) => c.homeAway === "away");
    if (!home?.team || !away?.team) continue;

    let spread: number | undefined;
    let total: number | undefined;
    const odds = comp.odds?.[0];
    if (odds?.spread != null) spread = Number(odds.spread);
    if (odds?.overUnder != null) total = Number(odds.overUnder);

    const homeId = home.team.id ?? home.id;
    const awayId = away.team.id ?? away.id;

    games.push({
      id: event.id,
      startTime: comp.date ?? event.date,
      startTimeSydney: toSydney(comp.date ?? event.date),
      homeTeam: home.team.displayName ?? "Home",
      awayTeam: away.team.displayName ?? "Away",
      homeTeamId: homeId,
      awayTeamId: awayId,
      spread,
      total,
      homeB2B: teamIdsPlayedYesterday.has(homeId),
      awayB2B: teamIdsPlayedYesterday.has(awayId),
      status: event.status?.type?.name ?? state,
    });
  }
  return games;
}

/** Team ids that played on a completed scoreboard day */
export function teamIdsFromFinalGames(raw: unknown): Set<string> {
  const data = raw as { events?: { competitions?: { competitors?: { id: string; team?: { id: string } }[] }[] }[] };
  const ids = new Set<string>();
  for (const event of data.events ?? []) {
    const comp = event.competitions?.[0];
    for (const c of comp?.competitors ?? []) {
      ids.add(c.team?.id ?? c.id);
    }
  }
  return ids;
}

export function parseEspnLeagueInjuries(
  raw: unknown,
  slateByTeam: Map<string, string>
): InjuryEntry[] {
  const data = raw as {
    injuries?: {
      id: string;
      displayName: string;
      injuries?: {
        status: string;
        date: string;
        athlete: { id: string; displayName: string };
      }[];
    }[];
  };
  const out: InjuryEntry[] = [];
  for (const team of data.injuries ?? []) {
    const teamId = team.id;
    const teamName = team.displayName;
    const gameId = slateByTeam.get(teamId) ?? "";
    for (const inj of team.injuries ?? []) {
      const status = mapStatus(inj.status);
      if (status === "Available") continue;
      out.push({
        playerId: inj.athlete.id,
        playerName: inj.athlete.displayName,
        teamId,
        teamName,
        gameId,
        status,
        source: "ESPN",
        updatedAt: inj.date ?? new Date().toISOString(),
      });
    }
  }
  return out;
}

function mapStatus(s: string): InjuryStatus {
  const key = s.toLowerCase().split("-")[0].trim();
  if (key.includes("out")) return "Out";
  return STATUS_MAP[key] ?? "Questionable";
}

export function mergeOfficialInjuries(
  espn: InjuryEntry[],
  official: { name: string; status: string; updatedAt: string }[],
  slateByTeam: Map<string, string>,
  playerTeamLookup: Map<string, { teamId: string; teamName: string; playerId?: string }>
): InjuryEntry[] {
  const byPlayer = new Map<string, InjuryEntry>();
  for (const e of espn) byPlayer.set(normalizeName(e.playerName), e);

  for (const o of official) {
    const key = normalizeName(o.name);
    const team = [...playerTeamLookup.entries()].find(([k]) => k === key || o.name.includes(k))?.[1];
    const existing = byPlayer.get(key);
    const status = mapStatus(o.status);
    const entry: InjuryEntry = {
      playerId: existing?.playerId ?? team?.playerId ?? key,
      playerName: o.name,
      teamId: existing?.teamId ?? team?.teamId ?? "",
      teamName: existing?.teamName ?? team?.teamName ?? "",
      gameId: existing?.gameId ?? slateByTeam.get(existing?.teamId ?? team?.teamId ?? "") ?? "",
      status,
      source: "NBA Official",
      updatedAt: o.updatedAt,
    };
    if (!existing || new Date(entry.updatedAt) >= new Date(existing.updatedAt)) {
      byPlayer.set(key, entry);
    }
  }
  return [...byPlayer.values()];
}

function normalizeName(n: string): string {
  return n.toLowerCase().replace(/\s+/g, " ").trim();
}

export function parseGameLogsFromEspn(
  raw: unknown,
  headshotUrl: string,
  playerTeamId?: string
): PlayerGameLog[] {
  const data = raw as {
    labels?: string[];
    seasonTypes?: {
      categories?: { events?: { eventId: string; stats: string[] }[] }[];
    }[];
    events?: Record<
      string,
      {
        gameDate?: string;
        homeTeamId?: string;
        awayTeamId?: string;
        opponents?: { id: string; homeAway?: string }[];
        opponent?: { id: string; displayName?: string };
        team?: { id: string };
        atVs?: string;
      }
    >;
  };
  const logs: PlayerGameLog[] = [];
  const regular = data.seasonTypes?.find((s) =>
    String((s as { displayName?: string }).displayName ?? "")
      .toLowerCase()
      .includes("regular")
  );
  const events = regular?.categories?.[0]?.events ?? [];
  for (const ev of events) {
    const stats = ev.stats ?? [];
    const mins = parseMinutes(stats[0]);
    const threes = parseMade(stats[3]);
    const reb = num(stats[7]);
    const ast = num(stats[8]);
    const pts = num(stats[13]);
    const meta = data.events?.[ev.eventId];
    let homeId = meta?.homeTeamId;
    let awayId = meta?.awayTeamId;
    for (const op of meta?.opponents ?? []) {
      if (op.homeAway === "home") homeId = homeId ?? op.id;
      if (op.homeAway === "away") awayId = awayId ?? op.id;
    }
    const metaTeamId = meta?.team?.id;
    const gameTeamId = playerTeamId ?? metaTeamId;
    let opponentTeamId: string | undefined = meta?.opponent?.id;
    let isHome: boolean | undefined;
    if (gameTeamId && homeId && awayId) {
      if (gameTeamId === homeId) {
        opponentTeamId = opponentTeamId ?? awayId;
        isHome = true;
      } else if (gameTeamId === awayId) {
        opponentTeamId = opponentTeamId ?? homeId;
        isHome = false;
      }
    } else if (meta?.atVs === "vs" && homeId) {
      isHome = true;
      opponentTeamId = opponentTeamId ?? awayId;
    } else if (meta?.atVs === "@" && awayId) {
      isHome = false;
      opponentTeamId = opponentTeamId ?? homeId;
    }
    logs.push({
      gameId: ev.eventId,
      minutes: mins,
      pts,
      reb,
      ast,
      threes,
      date: meta?.gameDate ?? "",
      teamId: gameTeamId,
      opponent: meta?.opponent?.displayName,
      opponentTeamId,
      isHome,
      fga: num(stats[4]),
      fta: num(stats[9]),
      turnovers: num(stats[10]),
      source: "espn",
    });
  }
  logs.sort((a, b) => (b.date > a.date ? 1 : -1));
  return logs;
}

function parseMinutes(s: string | undefined): number {
  if (!s) return 0;
  if (s.includes(":")) {
    const [m, sec] = s.split(":").map(Number);
    return m + (sec || 0) / 60;
  }
  return Number(s) || 0;
}

function parseMade(s: string | undefined): number {
  if (!s || !s.includes("-")) return 0;
  return Number(s.split("-")[0]) || 0;
}

function num(s: string | undefined): number {
  return Number(s) || 0;
}

interface BoxStatIdx {
  min: number;
  pts: number;
  reb: number;
  ast: number;
  threes: number;
  fga: number;
  fta: number;
  to: number;
}

/** ESPN game-summary boxscore uses a different column order than the player gamelog API. */
export function boxStatIndices(keys: string[] | undefined): BoxStatIdx | null {
  if (!keys?.length) return null;
  const idx = (sub: string) => keys.findIndex((k) => k.includes(sub));
  const pts = keys.findIndex((k) => k === "points");
  const reb = keys.findIndex((k) => k === "rebounds");
  const ast = keys.findIndex((k) => k === "assists");
  const threes = keys.findIndex((k) => k.includes("threePointFieldGoalsMade"));
  if (pts < 0 || reb < 0 || ast < 0 || threes < 0) return null;
  return {
    min: 0,
    pts,
    reb,
    ast,
    threes,
    fga: idx("fieldGoalsMade"),
    fta: idx("freeThrowsMade"),
    to: keys.findIndex((k) => k === "turnovers"),
  };
}

function lineFromBoxStats(stats: string[], ix: BoxStatIdx): Omit<BoxLine, "playerId" | "q1"> | null {
  if (!stats.length) return null;
  const minutes = parseMinutes(stats[ix.min]);
  if (minutes < 0.01) return null;
  const pts = num(stats[ix.pts]);
  const reb = num(stats[ix.reb]);
  const ast = num(stats[ix.ast]);
  const threes = parseMade(stats[ix.threes]);
  if (pts === 0 && reb === 0 && ast === 0 && threes === 0 && minutes < 1) return null;
  return {
    minutes,
    pts,
    reb,
    ast,
    threes,
  };
}

export function parseQ1FromPlays(
  plays: { period?: { number?: number }; participants?: { athlete?: { id: string } }[]; text?: string; scoreValue?: number; type?: { text?: string } }[],
  athleteId: string
): { pts: number; reb: number; ast: number } {
  let pts = 0,
    reb = 0,
    ast = 0;
  for (const play of plays) {
    if (play.period?.number !== 1) continue;
    const involved = play.participants?.some((p) => p.athlete?.id === athleteId);
    if (!involved) continue;
    const t = (play.type?.text ?? play.text ?? "").toLowerCase();
    if (t.includes("made") && t.includes("three")) pts += 3;
    else if (t.includes("made") && (t.includes("layup") || t.includes("dunk") || t.includes("shot"))) {
      pts += play.scoreValue && play.scoreValue <= 3 ? play.scoreValue : 2;
    }
    if (t.includes("rebound")) reb += 1;
    if (t.includes("made free throw")) pts += play.scoreValue === 1 ? 1 : play.scoreValue || 1;
    if (t.includes("assist")) ast += 1;
  }
  return { pts, reb, ast };
}

export interface BoxLine {
  playerId: string;
  minutes: number;
  pts: number;
  reb: number;
  ast: number;
  threes: number;
  q1?: { pts: number; reb: number; ast: number };
}

export function parseBoxscore(summary: unknown, plays?: unknown): Map<string, BoxLine> {
  const sum = summary as {
    boxscore?: {
      players?: {
        team?: { id: string };
        statistics?: {
          keys?: string[];
          athletes?: { athlete?: { id: string }; stats?: string[]; didNotPlay?: boolean }[];
        }[];
      }[];
    };
  };
  const map = new Map<string, BoxLine>();
  const pbp = (plays ?? (summary as { plays?: unknown }).plays) as
    | { period?: { number?: number }; participants?: { athlete?: { id: string } }[]; text?: string; scoreValue?: number; type?: { text?: string } }[]
    | undefined;

  for (const side of sum.boxscore?.players ?? []) {
    const statBlock = side.statistics?.[0];
    const ix = boxStatIndices(statBlock?.keys);
    if (!ix) continue;
    for (const row of statBlock?.athletes ?? []) {
      const id = row.athlete?.id;
      if (!id || row.didNotPlay) continue;
      const parsed = lineFromBoxStats(row.stats ?? [], ix);
      if (!parsed) continue;
      const line: BoxLine = {
        playerId: id,
        ...parsed,
      };
      if (pbp) line.q1 = parseQ1FromPlays(pbp, id);
      map.set(id, line);
    }
  }
  return map;
}

export function parseBoxscorePlayerLogs(
  summary: unknown,
  plays: unknown | undefined,
  game: { gameId: string; date: string; homeTeamId: string; awayTeamId: string }
): { playerId: string; log: PlayerGameLog }[] {
  const sum = summary as {
    boxscore?: {
      players?: {
        team?: { id: string };
        statistics?: {
          keys?: string[];
          athletes?: { athlete?: { id: string }; stats?: string[]; didNotPlay?: boolean }[];
        }[];
      }[];
    };
  };
  const logs: { playerId: string; log: PlayerGameLog }[] = [];
  const pbp = plays as Parameters<typeof parseQ1FromPlays>[0] | undefined;

  for (const side of sum.boxscore?.players ?? []) {
    const teamId = side.team?.id;
    if (!teamId) continue;
    const isHome = teamId === game.homeTeamId;
    const opponentTeamId = isHome ? game.awayTeamId : game.homeTeamId;
    const statBlock = side.statistics?.[0];
    const ix = boxStatIndices(statBlock?.keys);
    if (!ix) continue;
    for (const row of statBlock?.athletes ?? []) {
      const id = row.athlete?.id;
      if (!id || row.didNotPlay) continue;
      const stats = row.stats ?? [];
      const parsed = lineFromBoxStats(stats, ix);
      if (!parsed) continue;
      const q1 = pbp ? parseQ1FromPlays(pbp, id) : undefined;
      logs.push({
        playerId: id,
        log: {
          gameId: game.gameId,
          date: game.date,
          minutes: parsed.minutes,
          pts: parsed.pts,
          reb: parsed.reb,
          ast: parsed.ast,
          threes: parsed.threes,
          teamId,
          opponentTeamId,
          isHome,
          fga: ix.fga >= 0 ? num(stats[ix.fga]) : undefined,
          fta: ix.fta >= 0 ? parseMade(stats[ix.fta]) : undefined,
          turnovers: ix.to >= 0 ? num(stats[ix.to]) : undefined,
          q1Pts: q1?.pts,
          q1Reb: q1?.reb,
          q1Ast: q1?.ast,
          source: "boxscore",
        },
      });
    }
  }
  return logs;
}

export function extractTeamIdsFromScoreboard(raw: unknown): string[] {
  const games = parseScoreboard(raw, new Set());
  return [...new Set(games.flatMap((g) => [g.homeTeamId, g.awayTeamId]))];
}