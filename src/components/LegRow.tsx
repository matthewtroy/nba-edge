import type { PickLeg } from "@lib/types";
import { marketLabel } from "../utils/format";

interface Props {
  leg: PickLeg;
  onTap: (leg: PickLeg) => void;
}

export function LegRow({ leg, onTap }: Props) {
  return (
    <button
      type="button"
      onClick={() => onTap(leg)}
      className="w-full flex items-center gap-3 py-3 text-left active:bg-white/5 rounded-lg px-1"
    >
      <img
        src={leg.headshotUrl}
        alt=""
        className="w-10 h-10 rounded-full bg-card object-cover"
        onError={(e) => {
          (e.target as HTMLImageElement).style.display = "none";
        }}
      />
      <div className="flex-1 min-w-0">
        <div className="font-medium truncate">
          {leg.playerName} {marketLabel(leg.market, leg.line)}
        </div>
        <div className="flex flex-wrap gap-1 mt-1">
          {leg.tags.map((t) => (
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
      <div className="text-right text-sm shrink-0">
        <div>Take at {leg.takeAt.toFixed(2)}+</div>
        {leg.bestPrice != null && (
          <div className="text-accent-value text-xs">
            {leg.bestBookie} {leg.bestPrice.toFixed(2)}
          </div>
        )}
      </div>
    </button>
  );
}