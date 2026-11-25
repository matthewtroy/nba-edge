import type { InjuryEntry, PickLeg, SlateGame } from "@lib/types";
import { InjuryStatusBadge, injuryStatusForPlayer } from "./InjuryStatusBadge";
import { bookieMarketLabel } from "@lib/market-label";
import { displayLegRowTags } from "@lib/value-at-bookie";
import { legPriceAtBookie } from "@lib/single-bookie";
import { legGameTipSubtitle } from "@lib/leg-game-label";
import { LastFiveTicks } from "./LastFiveTicks";
import { legReasonLineUi } from "../lib/leg-reason-ui";
import { legRowReasonLines } from "@lib/leg-row-reasons";
import { ui } from "../lib/card-type-scale";
import { PlayerAvatar } from "./PlayerAvatar";

interface Props {
  leg: PickLeg;
  injuries: InjuryEntry[];
  slate?: SlateGame[];
  myBookie: string;
  onTap: (leg: PickLeg) => void;
}

function LegBadge({ label, danger }: { label: string; danger?: boolean }) {
  return (
    <span className={danger ? ui.badgeDanger : ui.badge}>{label}</span>
  );
}

export function PickLegRow({ leg, injuries, slate, myBookie, onTap }: Props) {
  const tags = displayLegRowTags(leg, myBookie);
  const reasonLines = legRowReasonLines(leg);
  const price = legPriceAtBookie(leg, myBookie);
  const subtitle = slate ? legGameTipSubtitle(leg, slate) : null;
  const ticks = leg.recentVsLine ?? [];
  const injStatus = injuryStatusForPlayer(injuries, leg.playerId);

  return (
    <button
      type="button"
      data-testid="pick-leg-row"
      onClick={() => onTap(leg)}
      className="w-full grid grid-cols-[32px_1fr_76px] gap-3 py-3 text-left border-b border-white/[0.05] last:border-0 active:opacity-90"
    >
      <PlayerAvatar
        name={leg.playerName}
        headshotUrl={leg.headshotUrl}
        className="w-8 h-8 rounded-full bg-page object-cover shrink-0 mt-0.5"
      />
      <div className="min-w-0">
        <p className={`${ui.legTitle} break-words`}>
          {leg.playerName}{" "}
          {leg.feedLineNote
            ? leg.feedLineNote
            : bookieMarketLabel(leg.market, leg.line)}
        </p>
        {subtitle && (
          <p className="text-[11px] text-white/40 theme-adaptive-muted truncate">
            {subtitle}
          </p>
        )}
        {reasonLines.length > 0 && (
          <div className="mt-1 space-y-0.5">
            {reasonLines.map((r) => {
              const reasonUi = legReasonLineUi(r.text);
              return (
                <p key={r.text} className={reasonUi.className}>
                  {reasonUi.prefix}
                  {r.text}
                </p>
              );
            })}
          </div>
        )}
        <div className="mt-1.5">
          <LastFiveTicks ticks={ticks} inline past5Label />
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1">
            <InjuryStatusBadge status={injStatus} />
            {tags.map((t) => (
              <LegBadge key={t} label={t} danger={t === "Blowout risk"} />
            ))}
          </div>
        </div>
      </div>
      <div className="text-right w-[76px] shrink-0">
        {price != null && price > 1 ? (
          <p className={ui.legPrice}>${price.toFixed(2)}</p>
        ) : leg.bestPrice != null && leg.bestPrice > 1 ? (
          <p className={`${ui.legPrice} !text-white/55`}>
            ${leg.bestPrice.toFixed(2)}
          </p>
        ) : (
          <p className="text-[11px] text-white/40">—</p>
        )}
        <p className={ui.legFair}>Fair {leg.fairPrice.toFixed(2)}</p>
      </div>
    </button>
  );
}