import type { DataIndexFile, DataIndexGamePreview } from "./data-index.js";
import type { SlateGame } from "./types.js";

export function slateGamesFromIndexPreviews(
  games: DataIndexGamePreview[] | undefined
): SlateGame[] {
  if (!games?.length) return [];
  return games.map((g) => ({
    id: g.id,
    startTime: g.tipIso,
    startTimeSydney: g.tipIso,
    homeTeam: g.home,
    awayTeam: g.away,
    homeTeamId: "",
    awayTeamId: "",
    homeB2B: false,
    awayB2B: false,
    status: g.status,
  }));
}

export function indexHasSlateFolder(index: DataIndexFile, date: string): boolean {
  return index.dates.some((d) => d.date === date);
}

export function isForwardPreviewSlate(
  index: DataIndexFile | null | undefined,
  selectedDate: string,
  slateEmpty: boolean
): boolean {
  if (!index || !selectedDate || !slateEmpty) return false;
  if (indexHasSlateFolder(index, selectedDate)) return false;
  return selectedDate === index.nextSlateDate;
}