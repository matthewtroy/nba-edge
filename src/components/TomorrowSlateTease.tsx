import type { DataIndexFile } from "@lib/data-index";
import { tomorrowNoNbaTease } from "@lib/premium-drop-countdown";
import { OfficialDropCountdown } from "./OfficialDropCountdown";

interface Props {
  index: DataIndexFile | null;
  slateDate: string;
  todayDate: string;
  slateEmpty: boolean;
}

/** Countdown + copy when Tomorrow is selected but that folder has not dropped yet. */
export function TomorrowSlateTease({
  index,
  slateDate,
  todayDate,
  slateEmpty,
}: Props) {
  if (slateDate === todayDate || !slateEmpty) return null;
  return (
    <>
      <OfficialDropCountdown index={index} show />
      <p className="text-sm text-white/60 mb-2" role="status">
        {tomorrowNoNbaTease()}
      </p>
    </>
  );
}