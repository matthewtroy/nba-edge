import type { LiveBetView } from "@lib/live-bet";
import type { LiveLegState } from "@lib/live-leg";
import {
  betProgressSegmentClass,
  betProgressShouldShow,
  liveBetLandedLabel,
  liveBetOutcomePill,
} from "@lib/live-leg-ui";

export function BetProgress({
  legStates,
  betView,
  className = "",
  compact = false,
}: {
  legStates: LiveLegState[];
  betView?: LiveBetView;
  className?: string;
  compact?: boolean;
}) {
  if (!betProgressShouldShow(betView) || !betView) return null;

  const landed = liveBetLandedLabel(betView);
  const outcome = liveBetOutcomePill(betView);

  const barH = compact ? "h-1" : "h-2";
  const landedCls = compact
    ? "text-[9px] text-white/40 tabular-nums whitespace-nowrap"
    : "text-[11px] text-white/55 tabular-nums whitespace-nowrap";

  return (
    <div
      className={`mb-2 flex items-center gap-2 min-h-[14px] ${className}`}
      data-testid="bet-progress"
      data-bet-state={betView.state}
      data-compact={compact ? "1" : "0"}
    >
      <div
        className={`flex flex-1 min-w-0 gap-0.5 ${barH}`}
        data-testid="bet-progress-segments"
        data-segment-count={legStates.length}
        aria-hidden
      >
        {legStates.map((state, i) => (
          <span
            key={i}
            data-testid="bet-progress-segment"
            data-state={state}
            className={`flex-1 min-w-[3px] rounded-sm transition-colors duration-300 ${betProgressSegmentClass(
              state
            )}`}
          />
        ))}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {landed ? (
          <span className={landedCls} data-testid="bet-progress-landed">
            {landed}
          </span>
        ) : null}
        {outcome ? (
          <span
            className={`text-[10px] font-medium px-1.5 py-0.5 rounded tabular-nums ${outcome.className}`}
            data-testid="bet-progress-outcome-pill"
          >
            {outcome.label}
          </span>
        ) : betView.state === "live" ? (
          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded text-sky-400 bg-sky-400/12 bet-progress-segment-live">
            Live
          </span>
        ) : null}
      </div>
    </div>
  );
}