import type { InjuryEntry, PickLeg } from "@lib/types";
import { marketLabel } from "@lib/market-label";
import { displayTagsForBookie } from "@lib/value-at-bookie";
import { legPriceAtCardBookie } from "@lib/leg-card-odds";
import { topBeneficiaryLastNames } from "@lib/injury-beneficiaries";
import { useQuestionableSwaps } from "../hooks/useQuestionableSwaps";
import { LastFiveTicks } from "./LastFiveTicks";

interface Props {
  leg: PickLeg;
  injuries: InjuryEntry[];
  picks: PickLeg[];
  bookie: string;
  onTap: (leg: PickLeg) => void;
}

export function MultiLegRow({ leg, injuries, picks, bookie, onTap }: Props) {
  const { swapAsOut, reset, isCountedOut } = useQuestionableSwaps();
  const countedOut = leg.questionable && isCountedOut(leg.playerId);

  const inj = injuries.find(
    (i) => i.playerId === leg.playerId && i.status === "Questionable"
  );
  const sitNames =
    inj && countedOut ? topBeneficiaryLastNames(inj, picks).join(", ") : "";

  const tags = displayTagsForBookie(leg, bookie);
  const price = legPriceAtCardBookie(leg, bookie);

  return (
    <div className="py-3 px-1">
      <button
        type="button"
        onClick={() => onTap(leg)}
        className="w-full flex items-start gap-3 text-left active:bg-white/5 rounded-lg"
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
          <LastFiveTicks ticks={leg.recentVsLine ?? []} compact />
          <div className="flex flex-wrap gap-1 mt-1">
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
            {leg.questionable && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-accent-warn/20 text-accent-warn">
                Questionable
              </span>
            )}
          </div>
        </div>
        <div className="text-right shrink-0 max-w-[42%] leading-tight">
          {price != null && (
            <div className="text-xl font-semibold text-green-400">${price.toFixed(2)}</div>
          )}
          <div className="text-xs text-white/70">{bookie}</div>
          <div className="text-xs text-white/55">Fair ${leg.fairPrice.toFixed(2)}</div>
        </div>
      </button>
      {leg.questionable && inj && (
        <div className="mt-2 pl-13 flex flex-wrap gap-2 items-center text-xs text-white/70">
          <span>
            If he sits: {countedOut && sitNames ? sitNames : "re-check minutes"}
          </span>
          {!countedOut && (
            <button
              type="button"
              className="px-2 py-1 rounded-lg bg-white/10"
              onClick={(e) => {
                e.stopPropagation();
                swapAsOut(leg.playerId);
              }}
            >
              Swap
            </button>
          )}
          {countedOut && (
            <button
              type="button"
              className="px-2 py-1 rounded-lg bg-white/10"
              onClick={(e) => {
                e.stopPropagation();
                reset(leg.playerId);
              }}
            >
              Reset
            </button>
          )}
        </div>
      )}
    </div>
  );
}