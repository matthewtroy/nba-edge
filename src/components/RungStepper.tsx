import type { PickLeg } from "@lib/types";
import { marketLabel } from "@lib/market-label";

interface Props {
  rungs: PickLeg[];
  activeId: string;
  onSelect: (leg: PickLeg) => void;
  compact?: boolean;
}

export function RungStepper({ rungs, activeId, onSelect, compact = false }: Props) {
  if (rungs.length <= 1) return null;
  const idx = rungs.findIndex((r) => r.id === activeId);
  const prev = idx > 0 ? rungs[idx - 1] : null;
  const next = idx >= 0 && idx < rungs.length - 1 ? rungs[idx + 1] : null;
  const active = rungs.find((r) => r.id === activeId) ?? rungs[0];

  return (
    <div
      className={`rounded-lg border border-white/10 bg-surface/60 ${compact ? "mb-2 p-2" : "mb-4 p-3"}`}
    >
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          disabled={!prev}
          onClick={() => prev && onSelect(prev)}
          className={`rounded-md bg-white/10 disabled:opacity-30 ${compact ? "px-1.5 py-0.5 text-xs" : "px-2 py-1 text-sm"}`}
          aria-label="Lower line"
        >
          −
        </button>
        <div className={`flex-1 text-center font-medium ${compact ? "text-xs" : "text-sm"}`}>
          {marketLabel(active.market, active.line)}
        </div>
        <button
          type="button"
          disabled={!next}
          onClick={() => next && onSelect(next)}
          className={`rounded-md bg-white/10 disabled:opacity-30 ${compact ? "px-1.5 py-0.5 text-xs" : "px-2 py-1 text-sm"}`}
          aria-label="Higher line"
        >
          +
        </button>
      </div>
      <div className="flex flex-nowrap gap-0.5 mt-1.5 overflow-x-auto justify-start">
        {rungs.map((r) => (
          <button
            key={r.id}
            type="button"
            onClick={() => onSelect(r)}
            className={`shrink-0 rounded-full border ${
              compact ? "text-[9px] px-1.5 py-px" : "text-[10px] px-2 py-0.5"
            } ${
              r.id === activeId
                ? "border-accent-high text-accent-high"
                : "border-white/15 text-white/50"
            }`}
          >
            {r.line}
          </button>
        ))}
      </div>
    </div>
  );
}