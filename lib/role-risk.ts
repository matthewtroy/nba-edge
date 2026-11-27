import type { InjuryEntry, InjuryStatus, PlayerGameLog } from "./types.js";
import type { PerMinuteRates, ProjectedStats } from "./baseline.js";
import { isMeaningfulRotation } from "./rotation.js";
import type { TeamContext } from "./injury-redistribution.js";
import type { PickLeg } from "./types.js";
import { reasonTexts, normalizeLegReasons } from "./leg-reason-types.js";
import { isInjuryRedistributionReason } from "./injury-reason.js";
import { playerLastName } from "./player-last-name.js";

/** Teammate return probability (plays normal minutes) for Q/D/P. */
export function teammateReturnProbability(status: InjuryStatus): number | null {
  switch (status) {
    case "Questionable":
      return 0.5;
    case "Doubtful":
      return 0.25;
    case "Probable":
      return 0.75;
    default:
      return null;
  }
}

/** Share of last five team games the player logged minutes (0–1). */
export function sharePlayedLast5(logs: PlayerGameLog[]): number {
  const recent = logs.slice(0, 5);
  if (!recent.length) return 0;
  const played = recent.filter((g) => g.minutes >= 1).length;
  return played / recent.length;
}

const ROLE_RISK_PREFIX = "Role risk: ";

function pushRoleRiskNote(map: Map<string, string[]>, playerId: string, lastName: string, status: InjuryStatus) {
  const line = `${ROLE_RISK_PREFIX}${lastName} ${status.toLowerCase()}`;
  const arr = map.get(playerId) ?? [];
  if (arr.length < 3 && !arr.some((r) => r === line)) arr.push(line);
  map.set(playerId, arr);
}

function pushPositiveRoleNote(
  map: Map<string, string[]>,
  playerId: string,
  lastName: string,
  status: InjuryStatus,
  stat: "pts" | "reb" | "ast",
  delta: number
) {
  const line = `${lastName} ${status.toLowerCase()} → +${delta.toFixed(1)} ${stat}`;
  const arr = map.get(playerId) ?? [];
  if (arr.length < 3 && !arr.some((r) => r === line)) arr.push(line);
  map.set(playerId, arr);
}

function avgGameStat(games: PlayerGameLog[], key: "pts" | "reb" | "ast" | "minutes"): number {
  if (!games.length) return 0;
  return games.reduce((s, g) => s + g[key], 0) / games.length;
}

function applyEvStatAdj(
  cur: ProjectedStats,
  key: "pts" | "reb" | "ast",
  rawAdj: number,
  shrink: number
): number {
  const applied = rawAdj * shrink;
  const cap = cur[key] * 0.25;
  const clipped =
    applied >= 0 ? Math.min(applied, cap) : Math.max(applied, cap > 0 ? -cap : applied);
  const minMove = key === "pts" ? 0.1 : 0.1;
  if (Math.abs(clipped) < minMove) return 0;
  cur[key] += clipped;
  return clipped;
}

/** Leg carries amber role-risk copy → block Main Play and Double Up. */
export function legHasNegativeRoleRisk(leg: PickLeg): boolean {
  const texts = reasonTexts(normalizeLegReasons(leg.reasons));
  return texts.some((t) => /^role risk:/i.test(t));
}

/** Q/D/P: EV adjustment from with/without splits and (pPlay − sharePlayed). Out unchanged. */
export function applyTeammateReturnRoleRisk(
  team: TeamContext,
  _base: Map<string, ProjectedStats>,
  _rates: Map<string, PerMinuteRates>,
  adjusted: Map<string, ProjectedStats>,
  reasons: Map<string, string[]>
): void {
  const qdp = team.injuries.filter(
    (i) =>
      i.status === "Questionable" ||
      i.status === "Doubtful" ||
      i.status === "Probable"
  );

  for (const inj of qdp) {
    const pPlay = teammateReturnProbability(inj.status);
    if (pPlay == null) continue;

    let injured = team.players.find((p) => p.id === inj.playerId);
    if (!injured && inj.playerName) {
      const norm = inj.playerName.toLowerCase();
      injured = team.players.find((p) => p.name.toLowerCase() === norm);
    }
    if (!injured) continue;

    const injLogs = team.gameLogsByPlayer.get(injured.id) ?? [];
    if (!isMeaningfulRotation(injLogs)) continue;

    const sharePlayed = sharePlayedLast5(injLogs);
    const evWeight = pPlay - sharePlayed;
    if (Math.abs(evWeight) < 0.01) continue;

    const injuredGameIds = new Set(injLogs.map((g) => g.gameId));
    const last = playerLastName(inj.playerName ?? injured.name) || "Teammate";

    for (const tm of team.players) {
      if (tm.id === injured.id) continue;
      const cur = adjusted.get(tm.id);
      if (!cur || cur.minutes < 12) continue;

      const tmLogs = team.gameLogsByPlayer.get(tm.id) ?? [];
      const withGames = tmLogs.filter((g) => injuredGameIds.has(g.gameId) && g.minutes >= 1);
      const withoutGames = tmLogs.filter((g) => !injuredGameIds.has(g.gameId) && g.minutes >= 1);
      if (!withGames.length || !withoutGames.length) continue;

      const n = withoutGames.length;
      const shrink = n / (n + 5);

      const before = { ...cur };
      const ptsDiff = avgGameStat(withGames, "pts") - avgGameStat(withoutGames, "pts");
      const rebDiff = avgGameStat(withGames, "reb") - avgGameStat(withoutGames, "reb");
      const astDiff = avgGameStat(withGames, "ast") - avgGameStat(withoutGames, "ast");
      const minDiff = avgGameStat(withGames, "minutes") - avgGameStat(withoutGames, "minutes");

      const ptsAdj = applyEvStatAdj(cur, "pts", evWeight * ptsDiff, shrink);
      const rebAdj = applyEvStatAdj(cur, "reb", evWeight * rebDiff, shrink);
      const astAdj = applyEvStatAdj(cur, "ast", evWeight * astDiff, shrink);
      const minRaw = evWeight * minDiff * shrink;
      if (Math.abs(minRaw) >= 0.5) {
        cur.minutes = Math.max(8, cur.minutes + minRaw);
      }

      adjusted.set(tm.id, cur);

      if (ptsAdj <= -0.3 || rebAdj <= -0.5 || astAdj <= -0.5 || minRaw <= -1) {
        pushRoleRiskNote(reasons, tm.id, last, inj.status);
      } else {
        if (ptsAdj >= 0.3) {
          pushPositiveRoleNote(reasons, tm.id, last, inj.status, "pts", ptsAdj);
        } else if (rebAdj >= 0.5) {
          pushPositiveRoleNote(reasons, tm.id, last, inj.status, "reb", rebAdj);
        } else if (astAdj >= 0.5) {
          pushPositiveRoleNote(reasons, tm.id, last, inj.status, "ast", astAdj);
        }
      }
    }
  }
}

/** Main Play / Double Up: no injury-redistribution split copy on legs. */
export function reasonsExcludingInjurySplits(reasons: string[]): string[] {
  return reasons.filter((r) => !isInjuryRedistributionReason(r));
}