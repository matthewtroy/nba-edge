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
import { MultiCardHeader } from "./MultiCardHeader";
import { formatGameOddsAge } from "@lib/odds-freshness-ui";

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
  officialDisplayOnly = false,
  liveCatalog,
  compact = true,
  onRemove,
  onLegTap,
  onCopy,
  slate,
  oddsLastPulled,
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

  const priceCatalog = officialDisplayOnly && liveCatalog?.length ? liveCatalog : allPicks;
  const { bookie, select, total, publishedBookie, publishedTotal } = useMultiBookieSelect(
    multi,
    legs,
    preferredBookie,
    officialDisplayOnly ? undefined : lockedBookie,
    priceCatalog,
    officialDisplayOnly ? lockedBookie : undefined
  );
  const rawBook = bookie ?? lockedBookie ?? multi.bestBookie;
  const displayBook = isFeedBookie(rawBook) ? rawBook : bookie ?? multi.bestBookie;

  const { headline, subline, cardBookie, fairOnly: titleFairOnly } = multiCardTitle(
    multi,
    legs,
    titleOpts
  );
  const showFairOnly = titleFairOnly || hideBookieSelect;

  const legBookie = showFairOnly ? "" : displayBook ?? cardBookie;
  const bestFeed =
    !showFairOnly && !officialDisplayOnly
      ? bestFeedMultiQuote(legs, priceCatalog)
      : officialDisplayOnly && priceCatalog.length
        ? bestFeedMultiQuote(legs, priceCatalog)
        : undefined;

  let displayHeadline = headline;
  if (
    multi.type === "crossGameSgm" &&
    !showFairOnly &&
    total != null &&
    legs.length < legsAll.length
  ) {
    const name = headline.includes(" @ ")
      ? headline.slice(0, headline.indexOf(" @ "))
      : headline;
    displayHeadline = `${name} @ $${total.toFixed(2)}`;
  }

  const headerBookie = showFairOnly
    ? multi.type === "q1Multi"
      ? undefined
      : oddsNote ?? subline
    : cardBookie || subline || undefined;

  const missingAtBookie =
    legBookie && !showFairOnly
      ? legs.filter(
          (l) => legPriceAtBookieWithCatalog(l, legBookie, allPicks) == null
        ).length
      : 0;

  return (
    <section className={`${ui.card} ${compact ? "" : ""}`}>
      <MultiCardHeader
        headline={displayHeadline}
        bookie={headerBookie}
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
      {officialDisplayOnly && publishedBookie && publishedTotal != null && (
        <p className="text-[11px] text-white/45 pb-1">
          Published @ {publishedBookie} ${publishedTotal.toFixed(2)} · switcher shows nearest-line prices
        </p>
      )}
      {bestFeed &&
        bookie &&
        bestFeed.bookie !== bookie &&
        bestFeed.total > (total ?? 0) && (
          officialDisplayOnly ? (
            <p className="text-[11px] text-white/50 pb-2">
              Best odds {bestFeed.bookie} ${bestFeed.total.toFixed(2)} (preview only)
            </p>
          ) : (
            <button
              type="button"
              className="text-[11px] text-white/50 pb-2 w-full text-left"
              onClick={() => select(bestFeed.bookie)}
            >
              Higher at {bestFeed.bookie} (${bestFeed.total.toFixed(2)})
            </button>
          )
        )}

      {!showFairOnly && !hideBookieSelect && (!lockedBookie || officialDisplayOnly) && (
        <select
          className="w-full mb-2 py-2 text-xs text-white/70 bg-transparent border-0 border-b border-white/[0.05] outline-none"
          value={displayBook ?? ""}
          onChange={(e) => select(e.target.value)}
          aria-label={officialDisplayOnly ? "Preview bookie prices" : "Bookie"}
        >
          {FEED_BOOKIES.map((b) => (
            <option key={b} value={b}>
              {b}
              {officialDisplayOnly && total != null && b === displayBook
                ? ` · $${total.toFixed(2)} preview`
                : ""}
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
        const rows = byGame.get(gameId);
        if (!rows?.length) return null;
        const game = slate?.find((g) => g.id === gameId);
        const matchup = game
          ? `${game.awayTeam} @ ${game.homeTeam}`
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
            oddsFallbackIso={props.oddsFallbackIso}
            catalog={props.allPicks}
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