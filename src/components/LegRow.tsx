import type { PickLeg, SlateGame } from "@lib/types";
import { legGameTipSubtitle } from "@lib/leg-game-label";
import { displayLegRowTags } from "@lib/value-at-bookie";
import { marketLabel } from "../utils/format";
import { legReasonLineUi } from "../lib/leg-reason-ui";
import { PlayerAvatar } from "./PlayerAvatar";

interface Props {
  leg: PickLeg;
  slate?: SlateGame[];
  myBookie?: string;
  onTap: (leg: PickLeg) => void;
}

export function LegRow({ leg, slate, myBookie = "bet365", onTap }: Props) {
  const subtitle = slate ? legGameTipSubtitle(leg, slate) : null;
  const myFromApi =
    myBookie && leg.bookiePrices?.[myBookie] != null
      ? leg.bookiePrices[myBookie]
      : undefined;
  const myNum = myFromApi;
  const tags = displayLegRowTags(leg, myBookie);
  const reasonUi = leg.reasonLine ? legReasonLineUi(leg.reasonLine) : null;

  return (
    <button
      type="button"
      onClick={() => onTap(leg)}
      className="w-full flex items-start gap-3 py-3 text-left active:bg-white/5 rounded-lg px-1"
    >
      <PlayerAvatar
        name={leg.playerName}
        playerId={leg.playerId}
        headshotUrl={leg.headshotUrl}
        className="w-10 h-10 rounded-full bg-card object-cover shrink-0"
      />
      <div className="flex-1 min-w-0">
        <div className="font-medium break-words leading-snug">
          {leg.playerName} {marketLabel(leg.market, leg.line)}
        </div>
        {subtitle && <p className="text-xs text-white/40 truncate">{subtitle}</p>}
        {leg.reasonLine && reasonUi && (
          <p className={`${reasonUi.className} mt-0.5 leading-snug`}>
            {reasonUi.prefix}
            {leg.reasonLine}
          </p>
        )}
        <div className="flex flex-wrap gap-1 mt-1">
          {tags.map((t) => (
            <span
              key={t}
              className={`text-[10px] px-1.5 py-px rounded-full bg-white/[0.08] ${
                t === "Blowout risk" ? "text-red-400" : "text-white/65"
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
          <div className="text-price-green text-xs break-words tabular-nums">
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