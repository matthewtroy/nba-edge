import type { PickLeg, SlateGame } from "./types.js";

export function legGameTipSubtitle(leg: PickLeg, slate: SlateGame[]): string | null {
  const g = slate.find((x) => x.id === leg.gameId);
  if (!g) return null;
  const matchup = `${g.awayTeam} @ ${g.homeTeam}`;
  const tip = g.startTimeSydney?.trim();
  return tip ? `${matchup} · ${tip}` : matchup;
}