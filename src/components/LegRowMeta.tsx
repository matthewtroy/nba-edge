import type { ReactNode } from "react";
import type { InjuryStatus } from "@lib/types";
import { LastFiveTicks } from "./LastFiveTicks";
import { InjuryStatusBadge } from "./InjuryStatusBadge";

type FormTick = "hit" | "miss" | "na";

/** Line 1: Past 5 dots only. Line 2+: badges wrap (never on dots line). */
export function LegRowMeta({
  ticks,
  injuryStatus,
  children,
}: {
  ticks: FormTick[];
  injuryStatus?: InjuryStatus;
  children?: ReactNode;
}) {
  return (
    <div className="mt-1">
      <LastFiveTicks ticks={ticks} inline past5Label />
      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 mt-1">
        <InjuryStatusBadge status={injuryStatus} />
        {children}
      </div>
    </div>
  );
}