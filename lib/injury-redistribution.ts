import type { PlayerProfile, InjuryEntry, PlayerGameLog } from "./types.js";
import type { PerMinuteRates, ProjectedStats } from "./baseline.js";
import { perMinuteRates, projectedMinutes } from "./baseline.js";

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
}

export function applyInjuryRedistribution(
  team: TeamContext,
  base: Map<string, ProjectedStats>,
  rates: Map<string, PerMinuteRates>
): { adjusted: Map<string, ProjectedStats>; reasons: Map<string, string[]>; boardsShared: Set<string> } {
  const adjusted = new Map(base);
  const reasons = new Map<string, string[]>();
  const boardsShared = new Set<string>();

  const outPlayers = team.injuries.filter(
    (i) => i.status === "Out" || i.status === "Doubtful"
  );

  for (const inj of outPlayers) {
    const injured = team.players.find((p) => p.id === inj.playerId);
    if (!injured) continue;
    const injuredRates = rates.get(injured.id);
    const injuredMins = base.get(injured.id)?.minutes ?? 0;
    if (!injuredRates || injuredMins <= 0) continue;

    const teammates = team.players.filter(
      (p) => p.teamId === injured.teamId && p.id !== injured.id
    );

    const gamesWithout = countGamesWithout(
      injured.id,
      teammates,
      team.gameLogsByPlayer
    );

    if (gamesWithout >= 3) {
      applyWithWithoutSplits(
        injured,
        teammates,
        team.gameLogsByPlayer,
        adjusted,
        rates,
        reasons,
        inj.playerName
      );
    } else {
      applyGenericRedistribution(
        injured,
        injuredRates,
        injuredMins,
        teammates,
        adjusted,
        reasons,
        inj.playerName
      );
    }

    adjusted.delete(injured.id);
  }

  tagSharedRebounds(team, adjusted, boardsShared, reasons);

  return { adjusted, reasons, boardsShared };
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
    if (!cur || !r) continue;

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
      const boost = shrink * cur.minutes;
      const cap = cur[key] * 0.25;
      const applied = Math.min(boost, cap);
      if (applied > 0.1 && key !== "threes") {
        (cur as Record<string, number>)[key] += applied;
      } else if (applied > 0.05 && key === "threes") {
        cur.threes += Math.min(applied, cap);
      }
    }

    const ptsBoost = cur.pts - (adjusted.get(tm.id)?.pts ?? cur.pts);
    if (ptsBoost > 0.5) {
      addReason(reasons, tm.id, `${injName} out: +${ptsBoost.toFixed(1)} pts`);
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
    if (!cur) continue;
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

    addReason(reasons, tm.id, `${injName} out: boost`);
    adjusted.set(tm.id, cur);
  }
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
      addReason(reasons, rebRates[i].id, "boards shared");
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
    return p?.name.split(" ").pop() ?? id;
  });
}