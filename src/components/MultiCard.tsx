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
import { cardType } from "../lib/card-type-scale";

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
  compact = false,
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
  const missingAtBookie =
    legBookie && !showFairOnly
      ? legs.filter(
          (l) =>
            legPriceAtBookieWithCatalog(l, legBookie, allPicks) == null
        ).length
      : 0;
  const bestFeed = !lockedBookie && !showFairOnly ? bestFeedMultiQuote(legs) : undefined;
  const atIdx = headline.indexOf(" @ ");
  let titleText = atIdx >= 0 ? headline.slice(0, atIdx) : headline;
  let totalText = atIdx >= 0 ? headline.slice(atIdx + 3) : headline;
  if (
    multi.type === "crossGameSgm" &&
    !showFairOnly &&
    total != null &&
    legs.length < legsAll.length
  ) {
    totalText = `$${total.toFixed(2)}`;
  }

  const sectionPad = compact ? cardType.section : "p-0 mb-3";
  const headerPad = compact ? "p-3 pb-2" : "px-4 py-3";

  return (
    <section className={`bg-card rounded-xl border border-white/10 overflow-hidden ${sectionPad}`}>
      <header className={`${headerPad} bg-surface/80 border-b border-white/5`}>
        <div className="flex justify-between gap-2 items-start">
          <div>
            <h3 className={compact ? cardType.headerTitle : "font-semibold text-base leading-snug"}>
              {titleText}
            </h3>
            {totalText ? (
              <p
                className={`${compact ? cardType.headerTotal : "text-2xl font-bold"} leading-tight mt-0.5 ${
                  showFairOnly ? "text-white/55" : "text-accent-high"
                }`}
              >
                {totalText}
              </p>
            ) : null}
            {!showFairOnly && cardBookie ? (
              <p className={`${cardType.headerBookie} mt-0.5`}>{cardBookie}</p>
            ) : (
              <p className={`${cardType.headerBookie} mt-0.5`}>{subline}</p>
            )}
          </div>
          {onRemove && (
            <button type="button" className="text-xs text-white/50" onClick={onRemove}>
              Remove
            </button>
          )}
        </div>
        {publishedAt && lockedBookie && (
          <p className="text-xs text-white/55 mt-0.5">
            Published {new Date(publishedAt).toLocaleString("en-AU", {
              timeZone: "Australia/Sydney",
              hour: "numeric",
              minute: "2-digit",
              hour12: true,
            })}
          </p>
        )}
      </header>
      <div className={`${compact ? "px-1" : "px-2"} divide-y divide-white/5`}>
        {multi.type === "crossGameSgm" && (
          <div className="px-2 py-2 flex flex-wrap gap-1 border-b border-white/10">
            {crossSel.chips.map((chip) => {
              const on = crossSel.enabled.has(chip.id);
              const empty = chip.excluded || chip.legCount === 0;
              return (
                <button
                  key={chip.id}
                  type="button"
                  disabled={empty}
                  title={chip.excludedReason}
                  onClick={() => !empty && crossSel.toggle(chip.id)}
                  className={`text-[10px] px-2 py-0.5 rounded-full border max-w-full truncate ${
                    empty
                      ? "border-white/10 text-white/30"
                      : on
                        ? "border-accent-high text-accent-high"
                        : "border-white/20 text-white/45"
                  }`}
                >
                  {chip.label}
                  {!empty
                    ? ` (${chip.legCount})`
                    : chip.excludedReason
                      ? ` · ${chip.excludedReason.split(":").slice(1).join(":").trim().slice(0, 36)}`
                      : " · —"}
                </button>
              );
            })}
          </div>
        )}
        {multi.type === "crossGameSgm" ? (
          (() => {
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
            return order.map((gameId) => {
              const rows = byGame.get(gameId);
              if (!rows?.length) return null;
              const game = slate?.find((g) => g.id === gameId);
              const headerMain = game
                ? `${game.awayTeam} @ ${game.homeTeam}`
                : rows[0]?.leg.team ?? "Game";
              const time = game?.startTimeSydney ?? "";
              const blowout =
                game?.spread != null && Math.abs(game.spread) >= 14.5;
              return (
                <div key={gameId} className="border-b border-white/10 last:border-0 bg-white/[0.02]">
                  <div className="px-2 pt-2 pb-1 border-b border-white/5">
                    <p className={cardType.crossGameTitle}>
                      {headerMain}
                      {time ? ` · ${time}` : ""}
                    </p>
                    <p className={`${cardType.crossGameMeta} flex items-center gap-2`}>
                      <span>SGM · {rows.length} leg{rows.length === 1 ? "" : "s"}</span>
                      {blowout ? (
                        <span className="text-accent-value">Blowout risk</span>
                      ) : null}
                    </p>
                  </div>
                  {rows.map(({ anchorId, leg }) => (
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
                        hideGameLine
                        compact={compact}
                        onSwap={() => swapLeg(anchorId)}
                        onReset={() => resetLeg(anchorId)}
                        onTap={onLegTap}
                      />
                    </ErrorBoundary>
                  ))}
                </div>
              );
            });
          })()
        ) : (
          multi.legs.map((anchorId) => {
            const leg = resolveLeg(anchorId);
            if (!leg) {
              return (
                <p key={anchorId} className="text-sm text-white/50 px-2 py-2">
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
      <div className={`${compact ? "p-3 pt-2" : "p-3"} bg-surface/40`}>
        {missingAtBookie > 0 && legBookie && (
          <p className="text-xs text-accent-warn mb-2">
            {missingAtBookie} leg(s) missing at {legBookie} even after nearest-line
          </p>
        )}
        {bestFeed && bookie && bestFeed.bookie !== bookie && bestFeed.total > (total ?? 0) && (
          <button
            type="button"
            className="text-xs text-white/60 mb-2 underline"
            onClick={() => select(bestFeed.bookie)}
          >
            Best odds: {bestFeed.bookie} @ ${bestFeed.total.toFixed(2)}
          </button>
        )}
        <div className="flex gap-2 items-center">
          {showFairOnly ? (
            <p className="flex-1 text-sm text-white/55 py-2">
              {multi.type === "q1Multi"
                ? "Model fair only — no AU Q1 feed"
                : oddsNote ?? "Fair model only"}
            </p>
          ) : lockedBookie ? (
            <p className="flex-1 text-sm text-white/70 py-2">Bookie: {lockedBookie}</p>
          ) : (
            <select
              className="flex-1 py-2 px-2 text-sm bg-surface border border-white/10 rounded-lg"
              value={displayBook ?? ""}
              onChange={(e) => select(e.target.value)}
            >
              <option value="" disabled>
                Bookie
              </option>
              {FEED_BOOKIES.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          )}
          <button
            type="button"
            className="flex-1 py-2 text-sm bg-surface border border-white/10 rounded-lg font-medium"
            onClick={() =>
              onCopy(
                renderMultiCardCopyText(multi, legs, legBookie || undefined, titleOpts)
              )
            }
          >
            {discordCopy ? "Copy for Discord" : "Copy"}
          </button>
        </div>
      </div>
    </section>
  );
}