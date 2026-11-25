import type { PickLeg } from "@lib/types";
import { displayTagsForBookie } from "@lib/value-at-bookie";
import { marketLabel } from "../utils/format";

interface Props {
  leg: PickLeg;
  myBookie?: string;
  onTap: (leg: PickLeg) => void;
}

export function LegRow({ leg, myBookie = "bet365", onTap }: Props) {
  const myFromApi =
    myBookie && leg.bookiePrices?.[myBookie] != null
      ? leg.bookiePrices[myBookie]
      : undefined;
  const myNum = myFromApi;
  const tags = displayTagsForBookie(leg, myBookie);

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
        {leg.reasonLine && (
          <p className="text-xs text-white/45 mt-0.5 truncate">{leg.reasonLine}</p>
        )}
        <div className="flex flex-wrap gap-1 mt-1">
          {(leg.confluence ?? 0) >= 2 && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-white/70">
              {leg.confluence}/4
            </span>
          )}
          {tags.map((t) => (
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
      <div className="text-right text-sm shrink-0 max-w-[40%]">
        <div>Take at {leg.takeAt.toFixed(2)}+</div>
        {leg.bestPrice != null && (
          <div className="text-accent-value text-xs break-words">
            Best: {leg.bestBookie} {leg.bestPrice.toFixed(2)}
          </div>
        )}
        {Number.isFinite(myNum) && myNum! > 1 && (
          <div className="text-white/60 text-xs">
            My ({myBookie}): {myNum!.toFixed(2)}
          </div>
        )}
      </div>
    </button>
  );
}