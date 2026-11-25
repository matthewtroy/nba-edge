import type { PickLeg, SlateGame } from "./types.js";

function findSlateGame(slate: SlateGame[], gameId: string | undefined): SlateGame | undefined {
  if (!gameId) return undefined;
  return slate.filter((x): x is SlateGame => x != null).find((x) => x.id === gameId);
}

export function legGameTipSubtitle(
  leg: PickLeg | null | undefined,
  slate: SlateGame[]
): string | null {
  if (!leg?.gameId) return null;
  const g = findSlateGame(slate, leg.gameId);
  if (!g) return null;
  const matchup = `${g.awayTeam} @ ${g.homeTeam}`;
  const tip = g.startTimeSydney?.trim();
  return tip ? `${matchup} · ${tip}` : matchup;
}