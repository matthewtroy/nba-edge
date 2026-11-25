import type { PickLeg } from "@lib/types";
import { marketLabel } from "@lib/market-label";
import { visibleLegTags } from "@lib/leg-display";

interface Props {
  leg: PickLeg;
  onTap: (leg: PickLeg) => void;
}

export function MultiLegRow({ leg, onTap }: Props) {
  return (
    <button
      type="button"
      onClick={() => onTap(leg)}
      className="w-full flex items-start gap-3 py-3 text-left active:bg-white/5 rounded-lg px-1"
    >
      <img
        src={leg.headshotUrl}
        alt=""
        className="w-10 h-10 rounded-full bg-card object-cover shrink-0"
        onError={(e) => {
          (e.target as HTMLImageElement).style.display = "none";
        }}
      />
      <div className="flex-1 min-w-0">
        <div className="font-medium break-words leading-snug">
          {leg.playerName} {marketLabel(leg.market, leg.line)}
        </div>
        <div className="flex flex-wrap gap-1 mt-1">
          {visibleLegTags(leg.tags).map((t) => (
            <span
              key={t}
              className={`text-xs px-2 py-0.5 rounded-full ${
                t === "Value"
                  ? "bg-accent-value/20 text-accent-value"
                  : t === "High probability"
                    ? "bg-accent-high/20 text-accent-high"
                    : "bg-accent-warn/20 text-accent-warn"
              }`}
            >
              {t}
            </span>
          ))}
        </div>
      </div>
      <div className="text-right text-sm shrink-0 max-w-[42%]">
        <div>Take at ${leg.takeAt.toFixed(2)}+</div>
        {leg.bestPrice != null && leg.bestPrice > 1 && (
          <div className="text-xs text-accent-value mt-0.5">
            Best ${leg.bestPrice.toFixed(2)}+
            {leg.bestBookie ? ` · ${leg.bestBookie}` : ""}
          </div>
        )}
      </div>
    </button>
  );
}