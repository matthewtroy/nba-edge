import { useRef } from "react";
import type { LiveLegView } from "@lib/live-leg";
import {
  legProgressFillClass,
  legProgressFillPercent,
  legProgressHandlePercent,
  legProgressRightClass,
  legProgressRightLabel,
  legProgressTargetPercent,
} from "@lib/live-leg-ui";

export function LegProgress({
  view,
  valueAtBookie: _valueAtBookie,
  showTrackPlaceholder = false,
  className = "",
}: {
  view?: LiveLegView;
  valueAtBookie?: boolean;
  /** Muted bar while ESPN snapshot is still loading for a live game */
  showTrackPlaceholder?: boolean;
  className?: string;
}) {
  const prevFill = useRef<number | null>(null);

  if ((!view || view.state === "pending") && !showTrackPlaceholder) return null;

  const right = view ? legProgressRightLabel(view) : null;
  if (!right && !showTrackPlaceholder) return null;

  if (showTrackPlaceholder && (!view || view.state === "pending")) {
    return (
      <div
        className={`flex items-center gap-1 min-w-0 ${className}`}
        data-testid="leg-progress"
        data-state="placeholder"
      >
        <div
          className="relative flex-1 min-w-[72px] h-[6px] rounded-full bg-white/[0.12] leg-progress-track-placeholder"
          aria-hidden
        />
        <span className="shrink-0 text-[10px] font-semibold tabular-nums text-white/35">—</span>
      </div>
    );
  }

  if (!view || !right) return null;

  const fillPct = legProgressFillPercent(view);
  const handlePct = legProgressHandlePercent(view);
  const targetPct = legProgressTargetPercent(view.line);
  const live = view.state === "live";
  const settled = view.state === "won" || view.state === "lost" || view.state === "void";
  const widthTransition = prevFill.current !== null && prevFill.current !== fillPct;
  prevFill.current = fillPct;

  return (
    <div
      className={`flex items-center gap-1 min-w-0 ${className}`}
      data-testid="leg-progress"
      data-state={view.state}
      data-value={_valueAtBookie ? "true" : undefined}
    >
      <div
        className="relative flex-1 min-w-[72px] h-[6px] rounded-full bg-white/[0.12]"
        aria-hidden
      >
        <span
          className={`absolute inset-y-0 left-0 rounded-l-full ${
            widthTransition ? "transition-[width] duration-500 ease-out" : ""
          } ${legProgressFillClass(view)} ${live ? "leg-progress-live-fill" : ""} ${
            settled && widthTransition ? "leg-progress-settled" : ""
          }`}
          style={{ width: `${fillPct}%`, maxWidth: `${handlePct}%` }}
        />
        <span
          className="absolute top-1/2 w-0.5 h-3.5 rounded-full bg-white/70 pointer-events-none leg-progress-value-handle"
          style={{
            left: `${handlePct}%`,
            transform: "translate(-50%, -50%)",
          }}
          data-testid="leg-progress-value-handle"
        />
        {view.line > 0 && (
          <span
            className="absolute top-1/2 w-px h-2.5 bg-white/[0.18] pointer-events-none leg-progress-target-tick"
            style={{
              left: `${targetPct}%`,
              transform: "translate(-50%, -50%)",
            }}
            data-testid="leg-progress-target-tick"
          />
        )}
      </div>
      <span
        className={`shrink-0 text-[10px] font-semibold tabular-nums text-right ${legProgressRightClass(view)} ${
          settled ? "leg-progress-settled-right" : ""
        }`}
        data-testid="leg-progress-right"
      >
        {right}
      </span>
    </div>
  );
}