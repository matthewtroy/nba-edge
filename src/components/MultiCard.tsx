import { useRef, useState } from "react";
import type { InjuryEntry, MultiBet, PickLeg, SlateGame } from "@lib/types";
import { FEED_BOOKIES, isFeedBookie } from "@lib/card-bookie";
import { MultiLegRow } from "./MultiLegRow";
import { renderMultiCardCopyText } from "@lib/multi-card-text";
import {
  useMultiBookieSelect,
  type MultiBookieStorageScope,
} from "../hooks/useMultiBookieSelect";
import { BookieBottomSheet } from "./BookieBottomSheet";
import { buildShareBetslipLayout } from "@lib/share-betslip-layout";
import { captureShareBetslipPng } from "../lib/share-multi-image";
import { multiCardTitle, type MultiCardTitleOptions } from "@lib/multi-combined";
import { bestFeedMultiQuote } from "@lib/card-bookie";
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
  const { bookie, select, total, publishedBookie, publishedTotal } = useMultiBookieSelect(
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

  const { headline, subline, cardBookie, fairOnly: titleFairOnly } = multiCardTitle(
    multi,
    legs,
    titleOpts
  );
  const showFairOnly = titleFairOnly || hideBookieSelect;

  const legBookie = showFairOnly ? "" : displayBook ?? cardBookie;
  const bestFeed = !showFairOnly
    ? bestFeedMultiQuote(legs, priceCatalog)
    : undefined;

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
  const headerTotal =
    showFairOnly || missingAtBookie > 0 ? undefined : total ?? undefined;
  const pricedAtBookie = legs.length - missingAtBookie;
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
      const layout = buildShareBetslipLayout({
        multi,
        legs,
        slate,
        bookie: legBookie || displayBook,
        total: headerTotal ?? publishedTotal ?? multi.bestBookieTotal,
        catalog: priceCatalog,
        injuries,
      });
      const blob = await captureShareBetslipPng(layout);
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
    <section ref={cardRef} className={`${ui.card} ${compact ? "" : ""}`}>
      <MultiCardHeader
        title={displayTitle}
        total={headerTotal}
        bookie={headerBookie}
        bestBookie={!officialDisplayOnly ? bestFeed?.bookie : undefined}
        bestTotal={!officialDisplayOnly ? bestFeed?.total : undefined}
        onSelectBest={
          bestFeed && bookie
            ? () => select(bestFeed.bookie)
            : undefined
        }
        publishedBookie={
          officialDisplayOnly && (publishedBookie ?? lockedBookie)
            ? publishedBookie ?? lockedBookie
            : undefined
        }
        publishedTotal={
          officialDisplayOnly ? publishedTotal ?? multi.bestBookieTotal : undefined
        }
        publishedAt={officialDisplayOnly ? publishedAt : undefined}
        republishedAt={officialDisplayOnly ? republishedAt : undefined}
        fairOnly={showFairOnly}
        fairNote={showFairOnly ? subline || oddsNote : undefined}
        onRemove={onRemove}
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
            oddsFallbackIso={oddsLastPulled}
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
                />
              </ErrorBoundary>
            );
          })
        )}
      </div>

      {!showFairOnly && !hideBookieSelect && (!lockedBookie || officialDisplayOnly) && (
        <>
          <button
            type="button"
            className="w-full mb-2 py-2 text-xs text-left text-white/70 border-b border-white/[0.05]"
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

      <div className="flex gap-2">
        <button
          type="button"
          className={`${ui.copyBtn} flex-1`}
          onClick={() =>
            onCopy(
              renderMultiCardCopyText(multi, legs, legBookie || undefined, titleOpts)
            )
          }
        >
          {discordCopy ? "Copy for Discord" : "Copy"}
        </button>
        <button type="button" className={`${ui.copyBtn} flex-1`} onClick={() => void shareImage()}>
          Share
        </button>
      </div>
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
        const time = game?.startTimeSydney ?? "";
        const blowout = game?.spread != null && Math.abs(game.spread) >= 14.5;
        const block = (
          <MotionBlock
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
            gameId={gameId}
            oddsFallbackIso={oddsFallbackIso}
            catalog={allPicks}
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
}) {
  const oddsAge =
    props.gameId && props.catalog.length
      ? formatGameOddsAge(props.catalog, props.gameId, props.oddsFallbackIso)
      : undefined;
  return (
    <div
      className={`${props.spacingTop ? "mt-4 pt-4 border-t border-white/[0.05]" : ""}`}
    >
      <MotionGroupHeader
        matchup={props.matchup}
        time={props.time}
        legCount={props.legCount}
        blowout={props.blowout}
        oddsAge={oddsAge}
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

function MotionGroupHeader({
  matchup,
  time,
  legCount,
  blowout,
  oddsAge,
}: {
  matchup: string;
  time: string;
  legCount: number;
  blowout: boolean;
  oddsAge?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-2 mb-1 px-0">
      <p className="text-[13px] font-semibold text-white theme-adaptive-title truncate">
        {matchup}
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