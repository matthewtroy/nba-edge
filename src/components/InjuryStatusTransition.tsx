import type { InjuryStatus } from "@lib/types";
import type { InjuryStatusHistoryFile } from "@lib/injury-status-history-ui";
import { recentActiveStatusTransition } from "@lib/injury-status-history-ui";
import { InjuryStatusBadge, injuryStatusForPlayer } from "./InjuryStatusBadge";

export function InjuryStatusTransition({
  playerId,
  status,
  history,
  now,
}: {
  playerId: string;
  status?: InjuryStatus;
  history?: InjuryStatusHistoryFile | null;
  now: Date;
}) {
  const transition = recentActiveStatusTransition(history, playerId, now);
  const current = status ?? transition?.toStatus;
  if (transition && current) {
    return (
      <span className="inline-flex items-center gap-1 shrink-0">
        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400/90">
          Active
        </span>
        <span className="text-white/35 text-[10px]" aria-hidden>
          →
        </span>
        <InjuryStatusBadge status={current} />
      </span>
    );
  }
  return <InjuryStatusBadge status={current} />;
}

export { injuryStatusForPlayer };