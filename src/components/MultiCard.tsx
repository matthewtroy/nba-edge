import { useRef, useState } from "react";
import type { InjuryEntry, MultiBet, PickLeg, ReasonAtTipSnapshot, SlateGame } from "@lib/types";
import type { LiveLegView } from "@lib/live-leg";
import type { LiveBetView } from "@lib/live-bet";
import type { LiveSourceSnapshot } from "@lib/live-source";
import { multiCardLiveBorderClass } from "@lib/live-leg-ui";
import { legStatesForMulti } from "@lib/live-tracking";
import { BetProgress } from "./BetProgress";
import { FEED_BOOKIES, isFeedBookie } from "@lib/card-bookie";
import { MultiLegRow } from "./MultiLegRow";
import { renderMultiCardCopyText } from "@lib/multi-card-text";
import {
  useMultiBookieSelect,
  type MultiBookieStorageScope,
} from "../hooks/useMultiBookieSelect";
import { BookieBottomSheet } from "./BookieBottomSheet";
import { captureMultiCardSharePng } from "../lib/share-multi-image";
import { gameStartTimeSydney } from "@lib/sydney";
import { multiCardTitle, type MultiCardTitleOptions } from "@lib/multi-combined";
import { legPriceAtBookieWithCatalog } from "@lib/single-bookie";
import { useMultiLegEdits } from "../hooks/useMultiLegEdits";
import { ErrorBoundary } from "./ErrorBoundary";
import { useCrossGameSelection } from "../hooks/useCrossGameSelection";
import { CrossGameChips } from "./CrossGameChips";
import { ui } from "../lib/card-type-scale";
import { MultiCardHeader } from "./MultiCardHeader";
import { formatGameOddsAge } from "@lib/odds-freshness-ui";
import {
  feedBookieOptionsForMulti,
  formatFeedBookieOptionLabel,
} from "@lib/feed-bookie-options";
import type { BookiePriceOpts } from "@lib/single-bookie";
import { multiCardBookieHeaderLabel } from "@lib/multi-card-bookie-header";
import { slateMatchupAbbrev } from "@lib/team-abbrev";
import { officialStakeUnits } from "@lib/pricing-config";

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
  officialDisplayOnly?: boolean;
  liveCatalog?: PickLeg[];
  compact?: boolean;
  slateDate?: string;
  bookieStorageScope?: MultiBookieStorageScope;
  republishedAt?: string;
  onRemove?: () => void;
  onLegTap: (leg: PickLeg) => void;
  onCopy: (text: string) => void;
  onShareError?: (message: string) => void;
  /** Off-screen PNG — hides Copy/Share/bookie chevron; keeps header bookie line */
  shareCapture?: boolean;
  legViews?: Map<string, LiveLegView>;
  liveBetView?: LiveBetView;
  liveSnapshot?: LiveSourceSnapshot | null;
  reasonsAtTip?: ReasonAtTipSnapshot[];
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
  officialDisplayOnly = false,
  liveCatalog,
  compact = true,
  onRemove,
  onLegTap,
  onCopy,
  slate,
  oddsLastPulled,
  slateDate,
  bookieStorageScope = "today",
  republishedAt,
  onShareError,
  shareCapture = false,
  legViews,
  liveBetView: liveBetViewProp,
  liveSnapshot,
  reasonsAtTip,
}: Props) {
  const cardRef = useRef<HTMLElement>(null);
  const [bookieSheetOpen, setBookieSheetOpen] = useState(false);
  const allPicks = Array.from(picksById.values());
  const { resolveLeg, swapLeg, resetLeg, isEdited } = useMultiLegEdits(multi, allPicks);
  const legsAll = multi.legs
    .map((id) => resolveLeg(id))
    .filter(Boolean) as PickLeg[];
  const crossSel = useCrossGameSelection(multi, legsAll, slate, slateDate);
  const legs =
    multi.type === "crossGameSgm" ? crossSel.filteredLegs : legsAll;

  const titleOpts: MultiCardTitleOptions = {
    fairOnly: fairOnly || multi.type === "q1Multi",
    fairOnlyNote: oddsNote,
  };

  const priceCatalog = officialDisplayOnly && liveCatalog?.length ? liveCatalog : allPicks;
  const priceOpts: BookiePriceOpts | undefined =
    multi.type === "longshot" ? { allowNearest: false } : undefined;
  const { bookie, select, total } = useMultiBookieSelect(
    multi,
    legs,
    preferredBookie,
    officialDisplayOnly ? undefined : lockedBookie,
    priceCatalog,
    officialDisplayOnly ? lockedBookie : undefined,
    priceOpts,
    bookieStorageScope
  );
  const feedOptions = feedBookieOptionsForMulti(legs, priceCatalog, priceOpts);
  const rawBook = bookie ?? lockedBookie ?? multi.bestBookie;
  const displayBook = isFeedBookie(rawBook) ? rawBook : bookie ?? multi.bestBookie;

  const { headline, subline, cardBookie, fairOnly: titleFairOnly, takeAtTotal } = multiCardTitle(
    multi,
    legs,
    titleOpts
  );
  const showFairOnly = titleFairOnly || (hideBookieSelect && !shareCapture);

  const legBookie = showFairOnly ? "" : displayBook ?? cardBookie;

  const displayTitle = headline.includes(" @ ")
    ? headline.slice(0, headline.indexOf(" @ "))
    : headline;
  const missingAtBookie =
    legBookie && !showFairOnly
      ? legs.filter(
          (l) =>
            legPriceAtBookieWithCatalog(l, legBookie, priceCatalog, priceOpts) ==
            null
        ).length
      : 0;
  const headerTotal = showFairOnly
    ? takeAtTotal
    : missingAtBookie > 0
      ? undefined
      : total ?? undefined;
  const stakeUnits =
    multi.stakeUnits ??
    officialStakeUnits(multi.type, headerTotal ?? multi.bestBookieTotal ?? multi.combinedTakeAt);
  const pricedAtBookie = legs.length - missingAtBookie;
  const liveBetView = liveBetViewProp;
  const betLegStates = legStatesForMulti(multi, legViews);
  const liveBorder = multiCardLiveBorderClass(liveBetView);
  const liveBoardByGame = new Map(
    (liveSnapshot?.games ?? []).map((g) => [g.gameId, g] as const)
  );
  const headerBookie = showFairOnly
    ? undefined
    : multiCardBookieHeaderLabel({
        legBookie: legBookie || undefined,
        pricedCount: pricedAtBookie,
        legCount: legs.length,
        displayBook,
        fallback: cardBookie ?? subline,
        showFairOnly,
      });

  const bookieOptions = feedOptions.map((row) => ({
    value: row.bookie,
    label: formatFeedBookieOptionLabel(row),
  }));

  async function shareImage() {
    try {
      const blob = await captureMultiCardSharePng({
        multi,
        picksById,
        injuries,
        slate,
        preferredBookie,
        lockedBookie,
        publishedAt,
        oddsLastPulled,
        discordCopy,
        fairOnly,
        oddsNote,
        hideBookieSelect: hideBookieSelect || showFairOnly,
        officialDisplayOnly,
        liveCatalog,
        compact,
        slateDate,
        bookieStorageScope,
        republishedAt,
        shareLegs: legs,
        legViews,
        liveBetView,
        liveSnapshot,
      });
      const file = new File([blob], "nba-edge-multi.png", { type: "image/png" });
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: multi.label });
        return;
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "nba-edge-multi.png";
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      onShareError?.(err instanceof Error ? err.message : "Share failed");
    }
  }

  return (
    <section
      ref={cardRef}
      className={`${ui.card} ${compact ? "" : ""} ${liveBorder}`}
      data-live-bet-state={liveBetView?.state}
    >
      <MultiCardHeader
        title={displayTitle}
        total={headerTotal}
        bookie={headerBookie}
        stakeUnits={stakeUnits}
        onRemove={shareCapture ? undefined : onRemove}
      />
      <BetProgress
        legStates={betLegStates}
        betView={liveBetView}
        compact={compact}
        className="mt-0.5"
      />

      {multi.type === "crossGameSgm" && !shareCapture && (
        <CrossGameChips
          chips={crossSel.chips}
          enabled={crossSel.enabled}
          onToggle={crossSel.toggle}
        />
      )}

      <div
        className={
          multi.type === "crossGameSgm"
            ? ui.legRowsBleed
            : `${ui.legRowsBleed} divide-y divide-white/[0.04]`
        }
        data-testid="multi-card-leg-rows"
      >
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
            oddsFallbackIso={oddsLastPulled}
            legViews={legViews}
            liveBoardByGame={liveBoardByGame}
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
                  catalog={priceCatalog}
                  slate={slate}
                  bookie={legBookie}
                  priceOpts={priceOpts}
                  fairPriceInSlot={showFairOnly}
                  edited={isEdited(anchorId)}
                  compact={compact}
                  onSwap={() => swapLeg(anchorId)}
                  onReset={() => resetLeg(anchorId)}
                  onTap={onLegTap}
                  liveView={legViews?.get(anchorId)}
                  reasonsAtTip={reasonsAtTip}
                />
              </ErrorBoundary>
            );
          })
        )}
      </div>

      {!shareCapture && (
        <footer className="mt-2 space-y-2" data-testid="multi-card-footer">
          {!showFairOnly &&
            !hideBookieSelect &&
            (!lockedBookie || officialDisplayOnly) && (
              <>
                <button
                  type="button"
                  className="w-full py-2 px-2.5 text-xs text-left text-white/70 bg-white/[0.04] rounded-lg hover:bg-white/[0.06] transition-colors"
                  data-testid="multi-card-bookie-row"
                  onClick={() => setBookieSheetOpen(true)}
                  aria-label={officialDisplayOnly ? "Preview bookie prices" : "Bookie"}
                >
                  {displayBook
                    ? formatFeedBookieOptionLabel(
                        feedOptions.find((r) => r.bookie === displayBook) ?? {
                          bookie: displayBook,
                          missing: missingAtBookie,
                          complete: missingAtBookie === 0,
                          total,
                        }
                      )
                    : "Select bookie"}
                  <span className="float-right text-white/35">▾</span>
                </button>
                <BookieBottomSheet
                  open={bookieSheetOpen}
                  title={officialDisplayOnly ? "Preview bookie" : "Bookie"}
                  options={bookieOptions}
                  value={displayBook ?? ""}
                  onSelect={select}
                  onClose={() => setBookieSheetOpen(false)}
                />
              </>
            )}
          <div className="flex gap-2" data-share-ui="actions">
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
            <button type="button" className={ui.copyBtn} onClick={() => void shareImage()}>
              Share
            </button>
          </div>
        </footer>
      )}
    </section>
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
  oddsFallbackIso,
  legViews,
  liveBoardByGame,
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
  oddsFallbackIso?: string;
  legViews?: Map<string, LiveLegView>;
  liveBoardByGame: Map<string, { statusDetail: string; phase: string }>;
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
        if (!gameId) return null;
        const rows = byGame.get(gameId);
        if (!rows?.length) return null;
        const game = slate?.find((g) => g.id === gameId);
        const matchup = game
          ? slateMatchupAbbrev(game)
          : rows[0]?.leg.team ?? "Game";
        const time = game ? gameStartTimeSydney(game) : "";
        const blowout = game?.spread != null && Math.abs(game.spread) >= 14.5;
        const board = gameId ? liveBoardByGame.get(gameId) : undefined;
        const block = (
          <MotionBlock
            key={gameId}
            spacingTop={!first}
            matchup={matchup}
            time={time}
            legCount={rows.length}
            blowout={blowout}
            liveStatus={board && board.phase !== "scheduled" ? board.statusDetail : undefined}
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
            gameId={gameId}
            oddsFallbackIso={oddsFallbackIso}
            catalog={allPicks}
            legViews={legViews}
          />
        );
        first = false;
        return block;
      })}
    </>
  );
}

function MotionBlock(props: {
  spacingTop: boolean;
  matchup: string;
  time: string;
  legCount: number;
  blowout: boolean;
  liveStatus?: string;
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
  gameId: string;
  oddsFallbackIso?: string;
  catalog: PickLeg[];
  legViews?: Map<string, LiveLegView>;
}) {
  const oddsAge =
    props.gameId && props.catalog.length
      ? formatGameOddsAge(props.catalog, props.gameId, props.oddsFallbackIso)
      : undefined;
  return (
    <div
      className={`${props.spacingTop ? "mt-4 pt-4 border-t border-white/[0.05]" : ""}`}
    >
      <div className="px-4">
      <MotionGroupHeader
        matchup={props.matchup}
        time={props.time}
        legCount={props.legCount}
        blowout={props.blowout}
        oddsAge={oddsAge}
        liveStatus={props.liveStatus}
      />
      </div>
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
            liveView={props.legViews?.get(anchorId)}
          />
        </ErrorBoundary>
      ))}
    </div>
  );
}

function MotionGroupHeader({
  matchup,
  time,
  legCount,
  blowout,
  oddsAge,
  liveStatus,
}: {
  matchup: string;
  time: string;
  legCount: number;
  blowout: boolean;
  oddsAge?: string;
  liveStatus?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-2 mb-1 px-0">
      <p className="text-[13px] font-semibold text-white theme-adaptive-title truncate">
        {matchup}
        {liveStatus ? (
          <span
            className="text-sky-400/90 font-normal text-[11px] ml-1.5 tabular-nums"
            data-testid="sgm-group-live-score"
          >
            {liveStatus}
          </span>
        ) : null}
        {oddsAge ? (
          <span className="text-white/40 font-normal text-[11px] ml-1.5">
            {oddsAge}
          </span>
        ) : null}
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