import type { SlateGame } from "./types.js";

/** Opponent on 2nd night of a back-to-back while the player's team is not (ESPN slate flags). */
export function opponentOnB2BFromGame(
  game: SlateGame | undefined,
  playerTeamName: string
): boolean {
  if (!game) return false;
  const home = game.homeTeam === playerTeamName;
  const away = game.awayTeam === playerTeamName;
  if (!home && !away) return false;
  const playerB2b = home ? game.homeB2B : game.awayB2B;
  const oppB2b = home ? game.awayB2B : game.homeB2B;
  return Boolean(oppB2b && !playerB2b);
}