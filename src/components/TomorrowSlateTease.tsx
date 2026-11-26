import type { DataIndexFile } from "@lib/data-index";
import type { OfficialCardFile } from "@lib/official-card-time";
import type { SlateGame } from "@lib/types";
import { shouldShowSlateBuildingScreen } from "@lib/slate-building-mode";
import { SlateBuildingScreen } from "./SlateBuildingScreen";

interface Props {
  index: DataIndexFile | null;
  slateDate: string;
  todayDate: string;
  viewerTodayYmd: string;
  viewerTimeZone?: string;
  slateEmpty: boolean;
  slate?: SlateGame[];
  officialCard?: OfficialCardFile | null;
  officialInUse?: boolean;
  noGamesToday?: boolean;
  previewSlate?: boolean;
  onIndexRefreshed?: (index: DataIndexFile) => void;
}

/** Premium building state before the next official card drops. */
export function TomorrowSlateTease({
  index,
  slateDate,
  todayDate,
  viewerTodayYmd,
  viewerTimeZone,
  slateEmpty,
  slate,
  officialCard = null,
  officialInUse = false,
  noGamesToday,
  previewSlate,
  onIndexRefreshed,
}: Props) {
  const show = shouldShowSlateBuildingScreen({
    index,
    slateDate,
    todayDate,
    slateEmpty,
    officialCard,
    officialInUse,
    noGamesToday,
    previewSlate,
  });

  if (!show) return null;

  return (
    <SlateBuildingScreen
      index={index}
      slateDate={slateDate === todayDate ? index?.nextSlateDate ?? slateDate : slateDate}
      todayDate={todayDate}
      viewerTodayYmd={viewerTodayYmd}
      viewerTimeZone={viewerTimeZone}
      slate={slate}
      showNoNbaTomorrow={noGamesToday || slateDate !== todayDate}
      onIndexRefreshed={onIndexRefreshed}
    />
  );
}