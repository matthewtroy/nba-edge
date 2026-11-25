import type { InjuryEntry, PickLeg, SlateGame } from "@lib/types";
import { bookieMarketLabel } from "@lib/market-label";
import { displayLegRowTags } from "@lib/value-at-bookie";
import { legPriceAtCardBookie } from "@lib/leg-card-odds";
import { legGameTipSubtitle } from "@lib/leg-game-label";
import { LastFiveTicks } from "./LastFiveTicks";
import { legReasonLineUi } from "../lib/leg-reason-ui";
import { ui } from "../lib/card-type-scale";

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

function LegBadge({ label, danger }: { label: string; danger?: boolean }) {
  return (
    <span className={danger ? ui.badgeDanger : ui.badge}>{label}</span>
  );
}

export function MultiLegRow({
  leg,
  slate,
  bookie,
  catalog,
  fairPriceInSlot = false,
  edited = false,
  hideGameLine = false,
  compact = false,
  onTap,
}: Props) {
  const tags = displayLegRowTags(leg, bookie);
  const reasonUi = leg.reasonLine ? legReasonLineUi(leg.reasonLine) : null;
  const price = legPriceAtCardBookie(leg, bookie, catalog);
  const muted = !fairPriceInSlot && bookie && price == null;
  const subtitle = !hideGameLine && slate ? legGameTipSubtitle(leg, slate) : null;
  const ticks = leg.recentVsLine ?? [];

  return (
    <button
      type="button"
      onClick={() => onTap(leg)}
      className="w-full grid grid-cols-[32px_1fr_76px] gap-3 py-3 text-left border-b border-white/[0.05] last:border-0 active:opacity-90"
    >
      <img
        src={leg.headshotUrl}
        alt=""
        className="w-8 h-8 rounded-full bg-page object-cover shrink-0 mt-0.5"
        onError={(e) => {
          (e.target as HTMLImageElement).style.display = "none";
        }}
      />
      <div className="min-w-0">
        <p className={`${ui.legTitle} truncate`}>
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
        {leg.reasonLine && reasonUi && (
          <p className={`mt-1 ${reasonUi.className}`} title={leg.reasonLine}>
            {reasonUi.prefix}
            {leg.reasonLine}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1.5">
          <LastFiveTicks ticks={ticks} inline hideLabel />
          {edited && <LegBadge label="Edited" />}
          {tags.map((t) => (
            <LegBadge
              key={t}
              label={t}
              danger={t === "Blowout risk"}
            />
          ))}
          {leg.questionable && <LegBadge label="Q" />}
        </div>
        {compact && null}
      </div>
      <div className="text-right w-[76px] shrink-0">
        {fairPriceInSlot ? (
          <p className={`${ui.legPrice} text-white/50`}>
            ${leg.fairPrice.toFixed(2)}
          </p>
        ) : (
          <>
            {price != null ? (
              <p
                className={`${ui.legPrice} ${muted ? "!text-white/35" : ""}`}
              >
                ${price.toFixed(2)}
              </p>
            ) : bookie ? (
              <p className="text-[11px] text-white/40">—</p>
            ) : null}
            <p className={ui.legFair}>Fair {leg.fairPrice.toFixed(2)}</p>
          </>
        )}
      </div>
    </button>
  );
}