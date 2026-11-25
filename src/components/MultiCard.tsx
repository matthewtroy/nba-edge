import type { InjuryEntry, MultiBet, PickLeg, SlateGame } from "@lib/types";
import { FEED_BOOKIES, isFeedBookie } from "@lib/card-bookie";
import { MultiLegRow } from "./MultiLegRow";
import { renderMultiCardCopyText } from "@lib/multi-card-text";
import { useMultiBookieSelect } from "../hooks/useMultiBookieSelect";
import { multiCardTitle, type MultiCardTitleOptions } from "@lib/multi-combined";
import { bestFeedMultiQuote } from "@lib/card-bookie";
import { legPriceAtBookieWithCatalog } from "@lib/single-bookie";
import { useMultiLegEdits } from "../hooks/useMultiLegEdits";
import { ErrorBoundary } from "./ErrorBoundary";
import { useCrossGameSelection } from "../hooks/useCrossGameSelection";
import { CrossGameChips } from "./CrossGameChips";
import { ui } from "../lib/card-type-scale";

interface Props {
  multi: MultiBet;
  picksById: Map<string, PickLeg>;
  injuries: InjuryEntry[];
  slate?: SlateGame[];
  preferredBookie?: string;
  lockedBookie?: string;
  publishedAt?: string;
  oddsLastPulled?: string;
  discordCopy?: boolean;
  fairOnly?: boolean;
  oddsNote?: string;
  hideBookieSelect?: boolean;
  compact?: boolean;
  onRemove?: () => void;
  onLegTap: (leg: PickLeg) => void;
  onCopy: (text: string) => void;
}

export const FORBIDDEN_MULTI_CARD_STRINGS = [
  "~1 in",
  "Stake",
  "My (",
  "legs @",
  "Bookie:",
  "Best mix",
  "Copy betslip",
  "Small slate",
  "cross-book",
  "Best across books",
  "Best multi odds",
  "once",
  "take at",
  "Take at",
] as const;

export function multiCardPlainText(multi: MultiBet, legs: PickLeg[] = []): string {
  return legs.length ? renderMultiCardCopyText(multi, legs) : multi.label;
}

export function MultiCard({
  multi,
  picksById,
  injuries,
  preferredBookie,
  lockedBookie,
  publishedAt,
  discordCopy = false,
  fairOnly = false,
  oddsNote,
  hideBookieSelect = false,
  compact = true,
  onRemove,
  onLegTap,
  onCopy,
  slate,
}: Props) {
  const allPicks = Array.from(picksById.values());
  const { resolveLeg, swapLeg, resetLeg, isEdited } = useMultiLegEdits(multi, allPicks);
  const legsAll = multi.legs
    .map((id) => resolveLeg(id))
    .filter(Boolean) as PickLeg[];
  const crossSel = useCrossGameSelection(multi, legsAll, slate);
  const legs =
    multi.type === "crossGameSgm" ? crossSel.filteredLegs : legsAll;

  const titleOpts: MultiCardTitleOptions = {
    fairOnly: fairOnly || multi.type === "q1Multi",
    fairOnlyNote: oddsNote,
  };

  const { bookie, select, total } = useMultiBookieSelect(
    multi,
    legs,
    preferredBookie,
    lockedBookie,
    allPicks
  );
  const rawBook = lockedBookie ?? bookie ?? multi.bestBookie;
  const displayBook = isFeedBookie(rawBook) ? rawBook : bookie ?? multi.bestBookie;

  const { headline, subline, cardBookie, fairOnly: titleFairOnly } = multiCardTitle(
    multi,
    legs,
    titleOpts
  );
  const showFairOnly = titleFairOnly || hideBookieSelect;

  const legBookie = showFairOnly ? "" : displayBook ?? cardBookie;
  const bestFeed = !lockedBookie && !showFairOnly ? bestFeedMultiQuote(legs) : undefined;

  const atIdx = headline.indexOf(" @ ");
  const titleText = atIdx >= 0 ? headline.slice(0, atIdx) : headline;
  let totalText = atIdx >= 0 ? headline.slice(atIdx + 3) : headline;
  if (
    multi.type === "crossGameSgm" &&
    !showFairOnly &&
    total != null &&
    legs.length < legsAll.length
  ) {
    totalText = `$${total.toFixed(2)}`;
  }

  const headerBookie = showFairOnly
    ? multi.type === "q1Multi"
      ? "Fair / take-at — no AU Q1 feed"
      : oddsNote ?? subline
    : cardBookie || subline;

  const missingAtBookie =
    legBookie && !showFairOnly
      ? legs.filter(
          (l) => legPriceAtBookieWithCatalog(l, legBookie, allPicks) == null
        ).length
      : 0;

  return (
    <section className={`${ui.card} ${compact ? "" : ""}`}>
      <ButtonHeaderRow
        titleText={titleText}
        totalText={totalText}
        headerBookie={headerBookie}
        showFairOnly={showFairOnly}
        onRemove={onRemove}
        publishedAt={publishedAt}
        lockedBookie={lockedBookie}
      />

      {multi.type === "crossGameSgm" && (
        <CrossGameChips
          chips={crossSel.chips}
          enabled={crossSel.enabled}
          onToggle={crossSel.toggle}
        />
      )}

      <div className={multi.type === "crossGameSgm" ? "" : ""}>
        {multi.type === "crossGameSgm" ? (
          <CrossLegGroups
            multi={multi}
            slate={slate}
            crossSel={crossSel}
            resolveLeg={resolveLeg}
            legBookie={legBookie}
            showFairOnly={showFairOnly}
            injuries={injuries}
            allPicks={allPicks}
            isEdited={isEdited}
            onLegTap={onLegTap}
            swapLeg={swapLeg}
            resetLeg={resetLeg}
            compact={compact}
          />
        ) : (
          multi.legs.map((anchorId) => {
            const leg = resolveLeg(anchorId);
            if (!leg) {
              return (
                <p key={anchorId} className="text-sm text-white/50 py-2">
                  This bet couldn&apos;t be displayed
                </p>
              );
            }
            return (
              <ErrorBoundary key={anchorId} name={`leg-${anchorId}`}>
                <MultiLegRow
                  leg={leg}
                  injuries={injuries}
                  picks={allPicks}
                  catalog={allPicks}
                  slate={slate}
                  bookie={legBookie}
                  fairPriceInSlot={showFairOnly}
                  edited={isEdited(anchorId)}
                  compact={compact}
                  onSwap={() => swapLeg(anchorId)}
                  onReset={() => resetLeg(anchorId)}
                  onTap={onLegTap}
                />
              </ErrorBoundary>
            );
          })
        )}
      </div>

      {missingAtBookie > 0 && legBookie && (
        <p className="text-[11px] text-white/45 pb-2">
          {missingAtBookie} leg(s) missing at {legBookie}
        </p>
      )}
      {bestFeed && bookie && bestFeed.bookie !== bookie && bestFeed.total > (total ?? 0) && (
        <button
          type="button"
          className="text-[11px] text-white/50 pb-2 w-full text-left"
          onClick={() => select(bestFeed.bookie)}
        >
          Higher at {bestFeed.bookie} (${bestFeed.total.toFixed(2)})
        </button>
      )}

      {!showFairOnly && !lockedBookie && (
        <select
          className="w-full mb-2 py-2 text-xs text-white/70 bg-transparent border-0 border-b border-white/[0.05] outline-none"
          value={displayBook ?? ""}
          onChange={(e) => select(e.target.value)}
        >
          {FEED_BOOKIES.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>
      )}

      <button
        type="button"
        className={ui.copyBtn}
        onClick={() =>
          onCopy(
            renderMultiCardCopyText(multi, legs, legBookie || undefined, titleOpts)
          )
        }
      >
        {discordCopy ? "Copy for Discord" : "Copy"}
      </button>
    </section>
  );
}

function ButtonHeaderRow({
  titleText,
  totalText,
  headerBookie,
  showFairOnly,
  onRemove,
  publishedAt,
  lockedBookie,
}: {
  titleText: string;
  totalText: string;
  headerBookie: string;
  showFairOnly: boolean;
  onRemove?: () => void;
  publishedAt?: string;
  lockedBookie?: string;
}) {
  return (
    <header className="flex items-start justify-between gap-4 mb-3">
      <div className="min-w-0 flex-1">
        <h3 className={ui.headerTitle}>{titleText}</h3>
        {publishedAt && lockedBookie && (
          <p className="text-[11px] text-white/40 mt-1">
            Published{" "}
            {new Date(publishedAt).toLocaleString("en-AU", {
              timeZone: "Australia/Sydney",
              hour: "numeric",
              minute: "2-digit",
              hour12: true,
            })}
          </p>
        )}
        {onRemove && (
          <button type="button" className="text-[11px] text-white/40 mt-1" onClick={onRemove}>
            Remove
          </button>
        )}
      </div>
      <div className="text-right shrink-0">
        {totalText ? (
          <p
            className={`${ui.headerTotal} ${
              showFairOnly ? "text-price-green" : ""
            }`}
          >
            {totalText}
          </p>
        ) : null}
        {headerBookie ? (
          <p className={ui.headerBookie}>{headerBookie}</p>
        ) : null}
      </div>
    </header>
  );
}

function CrossLegGroups({
  multi,
  slate,
  crossSel,
  resolveLeg,
  legBookie,
  showFairOnly,
  injuries,
  allPicks,
  isEdited,
  onLegTap,
  swapLeg,
  resetLeg,
  compact,
}: {
  multi: MultiBet;
  slate?: SlateGame[];
  crossSel: ReturnType<typeof useCrossGameSelection>;
  resolveLeg: (id: string) => PickLeg | undefined;
  legBookie: string;
  showFairOnly: boolean;
  injuries: InjuryEntry[];
  allPicks: PickLeg[];
  isEdited: (id: string) => boolean;
  onLegTap: (leg: PickLeg) => void;
  swapLeg: (id: string) => void;
  resetLeg: (id: string) => void;
  compact: boolean;
}) {
  const order = slate?.length
    ? slate.map((g) => g.id)
    : [...new Set(multi.legs.map((id) => resolveLeg(id)?.gameId).filter(Boolean))];
  const byGame = new Map<string, { anchorId: string; leg: PickLeg }[]>();
  for (const anchorId of multi.legs) {
    const leg = resolveLeg(anchorId);
    if (!leg || !crossSel.enabled.has(leg.gameId)) continue;
    const arr = byGame.get(leg.gameId) ?? [];
    arr.push({ anchorId, leg });
    byGame.set(leg.gameId, arr);
  }

  let first = true;
  return (
    <>
      {order.map((gameId) => {
        const rows = byGame.get(gameId);
        if (!rows?.length) return null;
        const game = slate?.find((g) => g.id === gameId);
        const matchup = game
          ? `${game.awayTeam} @ ${game.homeTeam}`
          : rows[0]?.leg.team ?? "Game";
        const time = game?.startTimeSydney ?? "";
        const blowout = game?.spread != null && Math.abs(game.spread) >= 14.5;
        const block = (
          <motionBlock
            key={gameId}
            spacingTop={!first}
            matchup={matchup}
            time={time}
            legCount={rows.length}
            blowout={blowout}
            rows={rows}
            injuries={injuries}
            allPicks={allPicks}
            slate={slate}
            legBookie={legBookie}
            showFairOnly={showFairOnly}
            isEdited={isEdited}
            compact={compact}
            onLegTap={onLegTap}
            swapLeg={swapLeg}
            resetLeg={resetLeg}
          />
        );
        first = false;
        return block;
      })}
    </>
  );
}

function motionBlock(props: {
  spacingTop: boolean;
  matchup: string;
  time: string;
  legCount: number;
  blowout: boolean;
  rows: { anchorId: string; leg: PickLeg }[];
  injuries: InjuryEntry[];
  allPicks: PickLeg[];
  slate?: SlateGame[];
  legBookie: string;
  showFairOnly: boolean;
  isEdited: (id: string) => boolean;
  compact: boolean;
  onLegTap: (leg: PickLeg) => void;
  swapLeg: (id: string) => void;
  resetLeg: (id: string) => void;
}) {
  return (
    <div
      className={`${props.spacingTop ? "mt-4 pt-4 border-t border-white/[0.05]" : ""}`}
    >
      <motionGroupHeader
        matchup={props.matchup}
        time={props.time}
        legCount={props.legCount}
        blowout={props.blowout}
      />
      {props.rows.map(({ anchorId, leg }) => (
        <ErrorBoundary key={anchorId} name={`leg-${anchorId}`}>
          <MultiLegRow
            leg={leg}
            injuries={props.injuries}
            picks={props.allPicks}
            catalog={props.allPicks}
            slate={props.slate}
            bookie={props.legBookie}
            fairPriceInSlot={props.showFairOnly}
            edited={props.isEdited(anchorId)}
            hideGameLine
            compact={props.compact}
            onSwap={() => props.swapLeg(anchorId)}
            onReset={() => props.resetLeg(anchorId)}
            onTap={props.onLegTap}
          />
        </ErrorBoundary>
      ))}
    </div>
  );
}

function motionGroupHeader({
  matchup,
  time,
  legCount,
  blowout,
}: {
  matchup: string;
  time: string;
  legCount: number;
  blowout: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-2 mb-1 px-0">
      <p className="text-[13px] font-semibold text-white theme-adaptive-title truncate">
        {matchup}
      </p>
      <p className="text-[11px] text-white/45 theme-adaptive-muted shrink-0 text-right">
        {time ? `${time} · ` : ""}
        SGM · {legCount}
        {blowout ? (
          <span className="text-red-400 ml-1">Blowout</span>
        ) : null}
      </p>
    </div>
  );
}