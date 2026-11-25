import type { InjuryEntry, PickLeg, SlateGame } from "@lib/types";
import { bookieMarketLabel } from "@lib/market-label";
import { displayLegRowTags } from "@lib/value-at-bookie";
import { legPriceAtCardBookie } from "@lib/leg-card-odds";
import { legGameTipSubtitle } from "@lib/leg-game-label";
import { LastFiveTicks } from "./LastFiveTicks";
import { legReasonLineUi } from "../lib/leg-reason-ui";
import { cardType } from "../lib/card-type-scale";

interface Props {
  leg: PickLeg;
  injuries: InjuryEntry[];
  picks: PickLeg[];
  slate?: SlateGame[];
  bookie: string;
  catalog?: PickLeg[];
  fairPriceInSlot?: boolean;
  edited?: boolean;
  hideGameLine?: boolean;
  compact?: boolean;
  onSwap?: () => void;
  onReset?: () => void;
  onTap: (leg: PickLeg) => void;
}

export function MultiLegRow({
  leg,
  picks,
  slate,
  bookie,
  catalog,
  fairPriceInSlot = false,
  edited = false,
  hideGameLine = false,
  compact = false,
  onSwap,
  onReset,
  onTap,
}: Props) {
  const tags = displayLegRowTags(leg, bookie);
  const reasonUi = leg.reasonLine ? legReasonLineUi(leg.reasonLine) : null;
  const price = legPriceAtCardBookie(leg, bookie, catalog);
  const muted = !fairPriceInSlot && bookie && price == null;
  const subtitle = !hideGameLine && slate ? legGameTipSubtitle(leg, slate) : null;
  const img = compact ? "w-8 h-8" : "w-10 h-10";

  return (
    <div className={compact ? cardType.legRow : "py-3 px-1"}>
      <button
        type="button"
        onClick={() => onTap(leg)}
        className={`w-full flex items-start ${cardType.legGap} text-left active:bg-white/5 rounded-lg`}
      >
        <img
          src={leg.headshotUrl}
          alt=""
          className={`${img} rounded-full bg-card object-cover shrink-0`}
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = "none";
          }}
        />
        <div className="flex-1 min-w-0">
          <div className={`${cardType.legTitle} break-words`}>
            {leg.playerName}{" "}
            {leg.feedLineNote
              ? leg.feedLineNote
              : bookieMarketLabel(leg.market, leg.line)}
          </div>
          {subtitle && (
            <p className={`${cardType.legGame} truncate`}>{subtitle}</p>
          )}
          {leg.reasonLine && reasonUi && (
            <p className={`${cardType.legReason} ${reasonUi.className} mt-0.5`}>
              {reasonUi.prefix}
              {leg.reasonLine}
            </p>
          )}
          <LastFiveTicks ticks={leg.recentVsLine ?? []} compact hideLabel />
          <div className="flex flex-wrap gap-1 mt-0.5">
            {edited && (
              <span className={`${cardType.badge} bg-white/10 text-white/60`}>
                Edited
              </span>
            )}
            {tags.map((t) => (
              <span
                key={t}
                className={`${cardType.badge} ${
                  t === "Value" || t === "Blowout risk"
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
              <span className={`${cardType.badge} bg-accent-warn/20 text-accent-warn`}>
                Q
              </span>
            )}
          </div>
        </div>
        <div className="text-right shrink-0 max-w-[40%] leading-tight">
          {fairPriceInSlot ? (
            <div className={`${cardType.legPrice} text-white/55`}>
              Fair ${leg.fairPrice.toFixed(2)}
            </div>
          ) : (
            <>
              {price != null && (
                <div
                  className={`${cardType.legPrice} ${muted ? "text-white/35" : ""}`}
                >
                  ${price.toFixed(2)}
                </div>
              )}
              {price == null && bookie && (
                <div className={cardType.legGame}>No {bookie} line</div>
              )}
              {bookie && !compact ? (
                <div className="text-[11px] text-white/55">{bookie}</div>
              ) : null}
              <div className={cardType.legFair}>Fair ${leg.fairPrice.toFixed(2)}</div>
            </>
          )}
        </div>
      </button>
      {!compact && (
        <div className="mt-2 pl-11 flex flex-wrap gap-2 items-center text-xs text-white/70">
          {onSwap && (
            <button
              type="button"
              className="px-2 py-1 rounded-lg bg-white/10"
              onClick={(e) => {
                e.stopPropagation();
                onSwap();
              }}
            >
              Swap player
            </button>
          )}
          {edited && onReset && (
            <button
              type="button"
              className="px-2 py-1 rounded-lg bg-white/10"
              onClick={(e) => {
                e.stopPropagation();
                onReset();
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