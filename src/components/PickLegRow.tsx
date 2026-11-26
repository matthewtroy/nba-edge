import type { InjuryEntry, PickLeg, SlateGame } from "@lib/types";
import type { LiveLegView } from "@lib/live-leg";
import { LegProgress } from "./LegProgress";
import { injuryStatusForPlayer } from "./InjuryStatusBadge";
import { LegRowMeta } from "./LegRowMeta";
import { bookieMarketLabel } from "@lib/market-label";
import { legRowBadgeLabels } from "@lib/value-at-bookie";
import { legPriceAtBookie } from "@lib/single-bookie";
import { legGameTipSubtitle } from "@lib/leg-game-label";
import { legReasonLineUi } from "../lib/leg-reason-ui";
import { legRowReasonLines } from "@lib/leg-row-reasons";
import { legRowLiveTrackingClass, legTitleShowsLiveDot } from "@lib/live-leg-ui";
import { hasValueAtBookie } from "@lib/value-at-bookie";
import { ui } from "../lib/card-type-scale";
import { PlayerAvatar } from "./PlayerAvatar";

interface Props {
  leg: PickLeg;
  injuries: InjuryEntry[];
  slate?: SlateGame[];
  myBookie: string;
  onTap: (leg: PickLeg) => void;
  liveView?: LiveLegView;
}

function LegBadge({ label, danger }: { label: string; danger?: boolean }) {
  return (
    <span className={danger ? ui.badgeDanger : ui.badge}>{label}</span>
  );
}

export function PickLegRow({ leg, injuries, slate, myBookie, onTap, liveView }: Props) {
  const badgeLabels = legRowBadgeLabels(leg, myBookie);
  const reasonLines = legRowReasonLines(leg);
  const price = legPriceAtBookie(leg, myBookie);
  const subtitle = slate ? legGameTipSubtitle(leg, slate) : null;
  const ticks = leg.recentVsLine ?? [];
  const injStatus = injuryStatusForPlayer(injuries, leg.playerId);
  const valueAtBookie = hasValueAtBookie(leg, myBookie);
  const rowLiveClass = legRowLiveTrackingClass(liveView);
  const bleed = rowLiveClass ? "pick-leg-row-bleed" : "";

  return (
    <button
      type="button"
      data-testid="pick-leg-row"
      onClick={() => onTap(leg)}
      className={`w-full grid grid-cols-[32px_1fr_76px] gap-2.5 py-2.5 text-left active:opacity-90 min-h-[44px] ${rowLiveClass} ${bleed}`}
    >
      <PlayerAvatar
        name={leg.playerName}
        headshotUrl={leg.headshotUrl}
        className="w-8 h-8 rounded-full bg-page object-cover shrink-0 mt-0.5"
      />
      <div className="min-w-0">
        <p className={`${ui.legTitle} break-words flex items-start gap-1.5`}>
          <span className="min-w-0 flex-1">
            {leg.playerName}{" "}
            {leg.feedLineNote
              ? leg.feedLineNote
              : bookieMarketLabel(leg.market, leg.line)}
          </span>
          {legTitleShowsLiveDot(liveView) && (
            <span
              className="leg-title-live-dot inline-block w-1.5 h-1.5 rounded-full bg-sky-400 mt-1 shrink-0"
              data-testid="leg-title-live-dot"
              aria-hidden
            />
          )}
        </p>
        {subtitle && (
          <p className="text-[11px] text-white/40 theme-adaptive-muted truncate">
            {subtitle}
          </p>
        )}
        {reasonLines.length > 0 && (
          <div className="mt-1 space-y-px">
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
        <LegRowMeta ticks={ticks} injuryStatus={injStatus}>
          {badgeLabels.map((t) => (
            <LegBadge key={t} label={t} danger={t === "Blowout risk"} />
          ))}
        </LegRowMeta>
        <LegProgress
          view={liveView}
          valueAtBookie={valueAtBookie}
          className="mt-1.5 w-full"
        />
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