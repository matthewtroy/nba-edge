import type { LiveLegView } from "@lib/live-leg";
import {
  legProgressFillClass,
  legProgressFillPercent,
  legProgressMarkerPercent,
  legProgressPillClass,
  legProgressPillSymbol,
  legProgressRightClass,
  legProgressRightLabel,
  legProgressValueTrackClass,
} from "@lib/live-leg-ui";

export function LegProgress({
  view,
  valueAtBookie,
  className = "",
}: {
  view?: LiveLegView;
  valueAtBookie?: boolean;
  className?: string;
}) {
  if (!view || view.state === "pending") return null;

  const right = legProgressRightLabel(view);
  const pill = legProgressPillSymbol(view);
  if (!right) return null;

  const fillPct = legProgressFillPercent(view);
  const markerPct = legProgressMarkerPercent(view.line);
  const live = view.state === "live";
  const settled = view.state === "won" || view.state === "lost" || view.state === "void";

  return (
    <div
      className={`flex items-center gap-1.5 min-w-0 ${className}`}
      data-testid="leg-progress"
      data-state={view.state}
      data-value={valueAtBookie ? "true" : undefined}
    >
      <div
        className={`relative flex-1 min-w-[72px] h-1.5 rounded-full bg-white/[0.08] ${legProgressValueTrackClass(
          valueAtBookie
        )}`}
        aria-hidden
      >
        <span
          className={`absolute inset-y-0 left-0 rounded-full transition-[width] duration-500 ease-out ${legProgressFillClass(view)} ${
            live ? "leg-progress-live-fill" : ""
          } ${settled ? "leg-progress-settled" : ""}`}
          style={{ width: `${fillPct}%` }}
        />
        <span
          className="absolute top-1/2 w-px h-3.5 bg-white/45 pointer-events-none leg-progress-line-marker"
          style={{
            left: `${markerPct}%`,
            transform: "translate(-50%, -50%)",
          }}
        />
      </div>
      <span
        className={`shrink-0 text-[10px] font-semibold w-4 text-center tabular-nums ${legProgressPillClass(view)} ${
          live ? "leg-progress-live-pill" : ""
        }`}
        aria-hidden
      >
        {pill}
      </span>
      <span
        className={`shrink-0 text-[10px] font-medium tabular-nums min-w-[2.25rem] text-right ${legProgressRightClass(view)}`}
        data-testid="leg-progress-right"
      >
        {right}
      </span>
    </div>
  );
}