import type { DataIndexFile } from "./data-index.js";
import type { OfficialCardFile } from "./official-card-time.js";
import { isForwardPreviewSlate } from "./slate-preview.js";

export function shouldShowSlateBuildingScreen(opts: {
  index: DataIndexFile | null;
  slateDate: string;
  todayDate: string;
  slateEmpty: boolean;
  officialCard: OfficialCardFile | null;
  officialInUse: boolean;
  noGamesToday?: boolean;
  previewSlate?: boolean;
}): boolean {
  const {
    index,
    slateDate,
    todayDate,
    slateEmpty,
    officialCard,
    officialInUse,
    noGamesToday,
    previewSlate,
  } = opts;
  if (!index) return false;

  if (noGamesToday && slateDate === todayDate && officialInUse) {
    return false;
  }

  if (previewSlate && !officialInUse) return true;

  if (isForwardPreviewSlate(index, slateDate, slateEmpty)) return true;

  if (slateDate !== todayDate && !officialInUse) return true;

  if (noGamesToday && slateDate === todayDate && !officialInUse) {
    if (index.dates.some((d) => d.date === todayDate)) return false;
    return Boolean(index.nextPublishAt || index.games?.length);
  }

  if (slateEmpty && !officialCard && index.nextPublishAt && slateDate === todayDate) {
    return true;
  }

  return false;
}