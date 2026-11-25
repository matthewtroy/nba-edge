import type { PlayerGameLog } from "./types.js";
import { H2H_SEASON_FLOOR } from "./h2h-reason.js";

/** Player logged at least one game for today's opponent within the H2H window. */
export function formerTeamOpponentTag(input: {
  logs: PlayerGameLog[];
  currentTeamId: string;
  opponentTeamId?: string;
}): boolean {
  const { logs, currentTeamId, opponentTeamId } = input;
  if (!opponentTeamId || opponentTeamId === currentTeamId) return false;
  const floor = H2H_SEASON_FLOOR;
  return logs.some(
    (g) =>
      g.date.slice(0, 10) >= floor &&
      g.minutes >= 1 &&
      g.teamId === opponentTeamId
  );
}