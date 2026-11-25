import type { InjuryStatus } from "@lib/types";
import {
  injuryBadgeTone,
  injuryStatusForPlayer,
  injuryStatusShowsBadge,
} from "@lib/injury-display";

export { injuryStatusForPlayer };

const TONE_CLASS: Record<
  ReturnType<typeof injuryBadgeTone>,
  string
> = {
  "muted-green": "bg-emerald-500/15 text-emerald-400/90",
  orange: "bg-orange-500/20 text-orange-300",
  red: "bg-red-500/20 text-red-300",
};

export function InjuryStatusBadge({ status }: { status?: InjuryStatus }) {
  if (!injuryStatusShowsBadge(status)) return null;
  return (
    <span
      className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${TONE_CLASS[injuryBadgeTone(status)]}`}
    >
      {status}
    </span>
  );
}