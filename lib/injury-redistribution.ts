import type { PlayerProfile, InjuryEntry, PlayerGameLog } from "./types.js";
import { shortTeamName } from "./ordinal.js";
import { playerLastName } from "./player-last-name.js";
import type { PerMinuteRates, ProjectedStats } from "./baseline.js";
import { perMinuteRates, projectedMinutes } from "./baseline.js";
import { isMeaningfulRotation } from "./rotation.js";
import type { InjuryCombineLogEntry } from "./injury-combine-log-ui.js";
import {
  applyMeasuredOutCombines,
  resolveOutInjuries,
} from "./injury-combine-measured.js";

export interface AdjustmentReason {
  text: string;
}

function positionGroup(pos: string): string {
  const p = pos.toUpperCase();
  if (p.includes("C") || p === "PF") return "big";
  if (p.includes("G")) return "guard";
  return "wing";
}

export interface TeamContext {
  players: PlayerProfile[];
  injuries: InjuryEntry[];
  gameLogsByPlayer: Map<string, PlayerGameLog[]>;
  /** Opponent bigs (C / PF) ruled out — lifts our bigs' rebound projection */
  opponentOutBigCount?: number;
  opponentPlayers?: PlayerProfile[];
  opponentInjuries?: InjuryEntry[];
  opponentTeamName?: string;
}

function isRotationBig(position: string | undefined, minutes: number): boolean {
  const p = (position ?? "").toUpperCase();
  const big =
    p.includes("C") || p === "PF" || p.includes("F-C") || p === "F-C" || p.startsWith("C");
  return big && minutes >= 15;
}

function countAvailableBigs(
  players: PlayerProfile[],
  injuries: InjuryEntry[],
  adjusted: Map<string, ProjectedStats>
): PlayerProfile[] {
  const out = new Set(
    injuries.filter((i) => i.status === "Out" || i.status === "Doubtful").map((i) => i.playerId)
  );
  return players.filter((p) => {
    if (out.has(p.id)) return false;
    const mins = adjusted.get(p.id)?.minutes ?? 0;
    return isRotationBig(p.position, mins);
  });
}

function applyExplicitReboundRedistribution(
  team: TeamContext,
  adjusted: Map<string, ProjectedStats>,
  rates: Map<string, PerMinuteRates>,
  reasons: Map<string, string[]>
): void {
  const outInjuries = team.injuries.filter(
    (i) => i.status === "Out" || i.status === "Doubtful"
  );

  for (const inj of outInjuries) {
    const injured = team.players.find((p) => p.id === inj.playerId);
    if (!injured || !isRotationBig(injured.position, adjusted.get(injured.id)?.minutes ?? 0)) {
      continue;
    }
    const injuredRates = rates.get(injured.id);
    const injuredMins = adjusted.get(injured.id)?.minutes ?? 0;
    if (!injuredRates || injuredMins <= 0) continue;

    const rebPool = injuredRates.reb * injuredMins * 0.85;
    let bigs = countAvailableBigs(team.players, team.injuries, adjusted).filter(
      (p) => p.id !== injured.id
    );
    if (!bigs.length) continue;

    const lastName =
      playerLastName(inj.playerName ?? injured.name) || "Big";

    if (bigs.length === 1) {
      const only = bigs[0];
      const cur = adjusted.get(only.id);
      if (cur) {
        const boost = Math.min(rebPool, cur.reb * 0.6);
        cur.reb += boost;
        const extraMin = Math.min(4, injuredMins * 0.12);
        if (extraMin > 0.5) cur.minutes += extraMin;
        adjusted.set(only.id, cur);
        addReason(reasons, only.id, `${lastName} out → only big left: +${boost.toFixed(1)} reb`);
      }
      continue;
    }

    const weightSum = bigs.reduce((s, p) => {
      const cur = adjusted.get(p.id);
      const r = rates.get(p.id);
      if (!cur || !r || cur.minutes < 1) return s;
      return s + Math.max(0.01, r.reb);
    }, 0);

    const wings = team.players.filter((p) => {
      if (bigs.some((b) => b.id === p.id)) return false;
      const out = team.injuries.some(
        (i) => i.playerId === p.id && (i.status === "Out" || i.status === "Doubtful")
      );
      if (out) return false;
      return positionGroup(p.position) === "wing";
    });

    let wingPool = rebPool * 0.08;
    const bigPool = rebPool - wingPool;

    for (const tm of bigs) {
      const cur = adjusted.get(tm.id);
      const r = rates.get(tm.id);
      if (!cur || !r) continue;
      const share = Math.max(0.01, r.reb) / weightSum;
      const boost = Math.min(bigPool * share, cur.reb * 0.3);
      if (boost > 0.15) {
        cur.reb += boost;
        adjusted.set(tm.id, cur);
        addReason(reasons, tm.id, `${lastName} out: +${boost.toFixed(1)} reb`);
      }
    }

    if (wings.length && wingPool > 0.1) {
      const per = wingPool / wings.length;
      for (const w of wings) {
        const cur = adjusted.get(w.id);
        if (!cur || cur.minutes < 12) continue;
        const bump = Math.min(per, cur.reb * 0.08);
        if (bump > 0.05) {
          cur.reb += bump;
          adjusted.set(w.id, cur);
        }
      }
    }
  }

  const oppPlayers = team.opponentPlayers ?? [];
  const oppInj = team.opponentInjuries ?? [];
  if (oppPlayers.length && oppInj.length) {
    const out = new Set(
      oppInj
        .filter((i) => i.status === "Out" || i.status === "Doubtful")
        .map((i) => i.playerId)
    );
    const outBigs = oppPlayers.filter(
      (p) => out.has(p.id) && isRotationBig(p.position, 20)
    );
    if (outBigs.length) {
      const oppLabel = shortTeamName(team.opponentTeamName ?? outBigs[0].teamName ?? "Opponent");
      const ourBigs = countAvailableBigs(team.players, team.injuries, adjusted);
      const bumpEach = Math.min(1.2 * outBigs.length, 2.5);
      for (const b of ourBigs) {
        const cur = adjusted.get(b.id);
        if (!cur) continue;
        cur.reb += bumpEach;
        adjusted.set(b.id, cur);
        const named = outBigs[0];
        const last = playerLastName(named.name);
        const pos = positionTag(named.position);
        addReason(
          reasons,
          b.id,
          `${oppLabel} without ${last} (${pos}) → +${bumpEach.toFixed(1)} reb`
        );
      }
    }
  }
}

function positionTag(position: string | undefined): string {
  const p = (position ?? "F").toUpperCase();
  if (p.includes("C")) return "C";
  if (p.startsWith("PG") || p.startsWith("SG") || p === "G") return "G";
  if (p.startsWith("SF") || p.startsWith("PF") || p.includes("F")) return "F";
  return p.charAt(0);
}

export function countOpponentOutBigs(
  opponentPlayers: PlayerProfile[] | undefined,
  opponentInjuries: InjuryEntry[]
): number {
  if (!opponentPlayers?.length) return 0;
  const out = new Set(
    opponentInjuries
      .filter((i) => i.status === "Out" || i.status === "Doubtful")
      .map((i) => i.playerId)
  );
  return opponentPlayers.filter((p) => out.has(p.id) && isRotationBig(p.position, 20)).length;
}

export function applyInjuryRedistribution(
  team: TeamContext,
  base: Map<string, ProjectedStats>,
  rates: Map<string, PerMinuteRates>,
  opts?: { skipWithWithoutSplits?: boolean; slateDate?: string }
): {
  adjusted: Map<string, ProjectedStats>;
  reasons: Map<string, string[]>;
  boardsShared: Set<string>;
  combineLog: InjuryCombineLogEntry[];
} {
  const adjusted = new Map(base);
  const reasons = new Map<string, string[]>();
  const boardsShared = new Set<string>();

  const outPlayers = team.injuries.filter((i) => i.status === "Out");
  const rosterMates = team.players.filter((p) => p.teamId === team.players[0]?.teamId);

  let combineLog: InjuryCombineLogEntry[] = [];

  if (!opts?.skipWithWithoutSplits && outPlayers.length) {
    const resolvedOuts = resolveOutInjuries(
      outPlayers,
      team.players,
      team.gameLogsByPlayer,
      rosterMates
    );
    const teamMatesByInjury = team.players.filter(
      (p) => !resolvedOuts.some((o) => o.profile.id === p.id)
    );
    combineLog = applyMeasuredOutCombines({
      teammates: teamMatesByInjury,
      resolvedOuts,
      gameLogs: team.gameLogsByPlayer,
      base,
      adjusted,
      rates,
      reasons,
      slateDate: opts?.slateDate,
    });
    for (const out of resolvedOuts) {
      adjusted.delete(out.profile.id);
    }
  }

  applyExplicitReboundRedistribution(team, adjusted, rates, reasons);
  tagSharedRebounds(team, adjusted, boardsShared, reasons);

  return { adjusted, reasons, boardsShared, combineLog };
}

function countGamesWithout(
  injuredId: string,
  teammates: PlayerProfile[],
  logs: Map<string, PlayerGameLog[]>
): number {
  const injuredLogs = logs.get(injuredId) ?? [];
  const injuredGameIds = new Set(injuredLogs.map((g) => g.gameId));
  if (teammates.length === 0) return 0;
  const t0 = logs.get(teammates[0].id) ?? [];
  return t0.filter((g) => !injuredGameIds.has(g.gameId)).length;
}

function applyWithWithoutSplits(
  injured: PlayerProfile,
  teammates: PlayerProfile[],
  gameLogs: Map<string, PlayerGameLog[]>,
  adjusted: Map<string, ProjectedStats>,
  rates: Map<string, PerMinuteRates>,
  reasons: Map<string, string[]>,
  injName: string
) {
  const injuredLogs = gameLogs.get(injured.id) ?? [];
  const withoutGameIds = new Set<string>();
  for (const g of injuredLogs) withoutGameIds.add(g.gameId);

  for (const tm of teammates) {
    const tmLogs = gameLogs.get(tm.id) ?? [];
    const withGames = tmLogs.filter((g) => withoutGameIds.has(g.gameId));
    const withoutGames = tmLogs.filter((g) => !withoutGameIds.has(g.gameId));
    const n = withoutGames.length;
    if (n < 1) continue;

    const statKeys = ["pts", "reb", "ast", "threes"] as const;
    const cur = adjusted.get(tm.id);
    const r = rates.get(tm.id);
    if (!cur || !r || cur.minutes < 12) continue;

    const beforePts = cur.pts;
    const beforeReb = cur.reb;
    const beforeAst = cur.ast;

    for (const key of statKeys) {
      const rateWith =
        withGames.length > 0
          ? withGames.reduce((s, g) => s + g[key], 0) /
            Math.max(1, withGames.reduce((s, g) => s + g.minutes, 0))
          : r[key === "threes" ? "threes" : key];
      const rateWithout =
        withoutGames.reduce((s, g) => s + g[key], 0) /
        Math.max(1, withoutGames.reduce((s, g) => s + g.minutes, 0));
      const diff = rateWithout - rateWith;
      const shrink = (diff * n) / (n + 5);
      const raw = shrink * cur.minutes;
      const cap = cur[key] * 0.25;
      const applied =
        raw >= 0 ? Math.min(raw, cap) : Math.max(raw, cap > 0 ? -cap : raw);
      const minMove = key === "threes" ? 0.05 : 0.1;
      if (Math.abs(applied) >= minMove) {
        if (key === "threes") {
          cur.threes += applied;
        } else {
          (cur as unknown as Record<string, number>)[key] += applied;
        }
      }
    }

    const ptsBoost = cur.pts - beforePts;
    const rebBoost = cur.reb - beforeReb;
    const astBoost = cur.ast - beforeAst;
    if (ptsBoost >= 0.5) {
      addReason(
        reasons,
        tm.id,
        `${playerLastName(injName)} out: +${ptsBoost.toFixed(1)} pts`
      );
    }
    if (rebBoost >= 1) {
      addReason(
        reasons,
        tm.id,
        `${playerLastName(injName)} out: +${rebBoost.toFixed(1)} reb`
      );
    }
    if (astBoost >= 1) {
      addReason(
        reasons,
        tm.id,
        `${playerLastName(injName)} out: +${astBoost.toFixed(1)} ast`
      );
    }
    adjusted.set(tm.id, cur);
  }
}

function applyGenericRedistribution(
  injured: PlayerProfile,
  injuredRates: PerMinuteRates,
  injuredMins: number,
  teammates: PlayerProfile[],
  adjusted: Map<string, ProjectedStats>,
  reasons: Map<string, string[]>,
  injName: string
) {
  const totalMins = teammates.reduce(
    (s, p) => s + (adjusted.get(p.id)?.minutes ?? 0),
    0
  );
  if (totalMins <= 0) return;

  const injPos = positionGroup(injured.position);
  for (const tm of teammates) {
    const cur = adjusted.get(tm.id);
    if (!cur || cur.minutes < 12) continue;
    const beforePts = cur.pts;
    const beforeReb = cur.reb;
    const beforeAst = cur.ast;

    const share = cur.minutes / totalMins;
    const minBoost = injuredMins * share * (positionGroup(tm.position) === injPos ? 1.2 : 0.8);
    cur.minutes += minBoost * 0.15;

    const totalPts = teammates.reduce((s, p) => s + (adjusted.get(p.id)?.pts ?? 0), 0);
    const ptShare = totalPts > 0 ? cur.pts / totalPts : share;
    const ptsFromInj = injuredRates.pts * injuredMins * ptShare;
    cur.pts += Math.min(ptsFromInj, cur.pts * 0.25);

    const totalReb = teammates.reduce((s, p) => s + (adjusted.get(p.id)?.reb ?? 0), 0);
    const rebShare = totalReb > 0 ? cur.reb / totalReb : share;
    cur.reb += Math.min(injuredRates.reb * injuredMins * rebShare, cur.reb * 0.25);

    const totalAst = teammates.reduce((s, p) => s + (adjusted.get(p.id)?.ast ?? 0), 0);
    const astShare = totalAst > 0 ? cur.ast / totalAst : share;
    cur.ast += Math.min(injuredRates.ast * injuredMins * astShare, cur.ast * 0.25);

    const ptsBoost = cur.pts - beforePts;
    const rebBoost = cur.reb - beforeReb;
    const astBoost = cur.ast - beforeAst;
    if (ptsBoost >= 0.5) {
      addReason(
        reasons,
        tm.id,
        `${playerLastName(injName)} out: +${ptsBoost.toFixed(1)} pts`
      );
    } else if (rebBoost >= 1) {
      addReason(
        reasons,
        tm.id,
        `${playerLastName(injName)} out: +${rebBoost.toFixed(1)} reb`
      );
    } else if (astBoost >= 1) {
      addReason(
        reasons,
        tm.id,
        `${playerLastName(injName)} out: +${astBoost.toFixed(1)} ast`
      );
    }
    adjusted.set(tm.id, cur);
  }
}

/** Out player listed on injury report but missing from ESPN roster (e.g. recent trade). */
function applyRosterlessOut(
  inj: InjuryEntry,
  teammates: PlayerProfile[],
  adjusted: Map<string, ProjectedStats>,
  reasons: Map<string, string[]>
) {
  const onTeam = teammates.filter((p) => p.teamId === inj.teamId);
  const ranked = onTeam
    .map((tm) => ({ tm, cur: adjusted.get(tm.id) }))
    .filter((x) => x.cur && x.cur.minutes >= 12)
    .sort((a, b) => (b.cur!.minutes ?? 0) - (a.cur!.minutes ?? 0));
  const top = ranked[0];
  if (!top?.cur) return;
  const ptsBump = Math.min(3.8, Math.max(1.6, top.cur.pts * 0.1));
  top.cur.pts += ptsBump;
  addReason(reasons, top.tm.id, `${inj.playerName} out: +${ptsBump.toFixed(1)} pts`);
  adjusted.set(top.tm.id, top.cur);
}

function tagSharedRebounds(
  team: TeamContext,
  adjusted: Map<string, ProjectedStats>,
  boardsShared: Set<string>,
  reasons: Map<string, string[]>
) {
  const rebRates: { id: string; rate: number }[] = [];
  for (const p of team.players) {
    const cur = adjusted.get(p.id);
    if (!cur || cur.minutes < 1) continue;
    rebRates.push({ id: p.id, rate: cur.reb / cur.minutes });
  }
  rebRates.sort((a, b) => b.rate - a.rate);
  for (let i = 0; i < rebRates.length; i++) {
    const others = rebRates.filter((_, j) => j !== i);
    const within = others.some(
      (o) => Math.abs(o.rate - rebRates[i].rate) / Math.max(o.rate, 0.01) <= 0.25
    );
    if (within) {
      boardsShared.add(rebRates[i].id);
    }
  }
}

function addReason(map: Map<string, string[]>, id: string, text: string) {
  const arr = map.get(id) ?? [];
  if (arr.length < 3 && !arr.includes(text)) arr.push(text);
  map.set(id, arr);
}

export function questionableBeneficiaries(
  team: TeamContext,
  questionableId: string
): string[] {
  const fakeInjury: InjuryEntry = {
    playerId: questionableId,
    playerName: "",
    teamId: "",
    teamName: "",
    gameId: "",
    status: "Out",
    source: "",
    updatedAt: "",
  };
  const inj = team.injuries.find((i) => i.playerId === questionableId);
  if (inj) fakeInjury.playerName = inj.playerName;
  const { adjusted } = applyInjuryRedistribution(
    { ...team, injuries: [fakeInjury] },
    new Map(),
    new Map()
  );
  return [...adjusted.keys()].slice(0, 3).map((id) => {
    const p = team.players.find((x) => x.id === id);
    return p ? playerLastName(p.name) : id;
  });
}