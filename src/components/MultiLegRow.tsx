import type { InjuryEntry, PickLeg, SlateGame } from "@lib/types";
import { bookieMarketLabel } from "@lib/market-label";
import { displayLegRowTags } from "@lib/value-at-bookie";
import { legBookieQuoteView } from "@lib/leg-bookie-quote";
import type { BookiePriceOpts } from "@lib/single-bookie";
import { legGameTipSubtitle } from "@lib/leg-game-label";
import { LegRowMeta } from "./LegRowMeta";
import { legReasonLineUi } from "../lib/leg-reason-ui";
import { legRowReasonLines } from "@lib/leg-row-reasons";
import { ui } from "../lib/card-type-scale";
import { PlayerAvatar } from "./PlayerAvatar";
import { injuryStatusForPlayer } from "./InjuryStatusBadge";

interface Props {
  leg: PickLeg;
  injuries: InjuryEntry[];
  picks: PickLeg[];
  slate?: SlateGame[];
  bookie: string;
  catalog?: PickLeg[];
  priceOpts?: BookiePriceOpts;
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
  injuries,
  picks,
  slate,
  bookie,
  catalog,
  priceOpts,
  fairPriceInSlot = false,
  edited = false,
  hideGameLine = false,
  compact = false,
  onTap,
}: Props) {
  const pool = catalog ?? picks;
  const tags = displayLegRowTags(leg, bookie);
  const reasonLines = legRowReasonLines(leg);
  const quoteView =
    bookie && !fairPriceInSlot
      ? legBookieQuoteView(leg, bookie, pool, priceOpts)
      : undefined;
  const price = quoteView?.displayPrice;
  const lineShift = quoteView?.lineShift;
  const muted = !fairPriceInSlot && bookie && price == null;
  const subtitle = !hideGameLine && slate ? legGameTipSubtitle(leg, slate) : null;
  const ticks = leg.recentVsLine ?? [];
  const injStatus = injuryStatusForPlayer(injuries, leg.playerId);
  const showFormer = leg.tags?.includes("former_team");

  return (
    <button
      type="button"
      data-testid="leg-row"
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
          {lineShift ?? leg.feedLineNote ?? bookieMarketLabel(leg.market, leg.line)}
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
        <LegRowMeta ticks={ticks} injuryStatus={injStatus}>
          {showFormer ? <LegBadge label="Former team" /> : null}
          {edited && <LegBadge label="Edited" />}
          {tags.map((t) => (
            <LegBadge
              key={t}
              label={t}
              danger={t === "Blowout risk"}
            />
          ))}
        </LegRowMeta>
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
              <p className="text-[11px] text-white/40">not at {bookie}</p>
            ) : null}
            <p className={ui.legFair}>Fair {leg.fairPrice.toFixed(2)}</p>
          </>
        )}
      </div>
    </button>
  );
}