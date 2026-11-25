import type { PickLeg } from "@lib/types";
import { marketLabel } from "@lib/market-label";

interface Props {
  rungs: PickLeg[];
  activeId: string;
  onSelect: (leg: PickLeg) => void;
}

export function RungStepper({ rungs, activeId, onSelect }: Props) {
  if (rungs.length <= 1) return null;
  const idx = rungs.findIndex((r) => r.id === activeId);
  const prev = idx > 0 ? rungs[idx - 1] : null;
  const next = idx >= 0 && idx < rungs.length - 1 ? rungs[idx + 1] : null;
  const active = rungs.find((r) => r.id === activeId) ?? rungs[0];

  return (
    <div className="mb-4 rounded-lg border border-white/10 bg-surface/60 p-3">
      <p className="text-xs text-white/55 mb-2">Line stepper</p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={!prev}
          onClick={() => prev && onSelect(prev)}
          className="px-2 py-1 text-sm rounded-lg bg-white/10 disabled:opacity-30"
          aria-label="Lower line"
        >
          −
        </button>
        <div className="flex-1 text-center text-sm font-medium">
          {marketLabel(active.market, active.line)}
        </div>
        <button
          type="button"
          disabled={!next}
          onClick={() => next && onSelect(next)}
          className="px-2 py-1 text-sm rounded-lg bg-white/10 disabled:opacity-30"
          aria-label="Higher line"
        >
          +
        </button>
      </div>
      <div className="flex flex-wrap gap-1 mt-2 justify-center">
        {rungs.map((r) => (
          <button
            key={r.id}
            type="button"
            onClick={() => onSelect(r)}
            className={`text-[10px] px-2 py-0.5 rounded-full border ${
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