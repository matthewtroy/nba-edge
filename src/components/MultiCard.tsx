import type { InjuryEntry, MultiBet, PickLeg, SlateGame } from "@lib/types";
import { FEED_BOOKIES, isFeedBookie } from "@lib/card-bookie";
import { MultiLegRow } from "./MultiLegRow";
import { renderMultiCardCopyText } from "@lib/multi-card-text";
import { useMultiBookieSelect } from "../hooks/useMultiBookieSelect";
import { multiCardTitle, type MultiCardTitleOptions } from "@lib/multi-combined";
import { bestFeedMultiQuote } from "@lib/card-bookie";
import { legPriceAtBookie } from "@lib/single-bookie";
import { useMultiLegEdits } from "../hooks/useMultiLegEdits";
import { ErrorBoundary } from "./ErrorBoundary";

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
  onRemove,
  onLegTap,
  onCopy,
  slate,
}: Props) {
  const allPicks = Array.from(picksById.values());
  const { resolveLeg, swapLeg, resetLeg, isEdited } = useMultiLegEdits(multi, allPicks);
  const legs = multi.legs
    .map((id) => resolveLeg(id))
    .filter(Boolean) as PickLeg[];

  const titleOpts: MultiCardTitleOptions = {
    fairOnly: fairOnly || multi.type === "q1Multi",
    fairOnlyNote: oddsNote,
  };
  const { headline, subline, cardBookie, fairOnly: titleFairOnly } = multiCardTitle(
    multi,
    legs,
    titleOpts
  );
  const showFairOnly = titleFairOnly || hideBookieSelect;

  const { bookie, select, total } = useMultiBookieSelect(
    multi,
    legs,
    preferredBookie,
    lockedBookie
  );
  const rawBook = lockedBookie ?? bookie ?? multi.bestBookie;
  const displayBook = isFeedBookie(rawBook) ? rawBook : bookie ?? multi.bestBookie;

  const legBookie = showFairOnly ? "" : displayBook ?? cardBookie;
  const missingAtBookie =
    legBookie && !showFairOnly
      ? legs.filter((l) => legPriceAtBookie(l, legBookie) == null).length
      : 0;
  const bestFeed = !lockedBookie && !showFairOnly ? bestFeedMultiQuote(legs) : undefined;
  const colonFair = headline.indexOf(": Fair $");
  const colonPrice = headline.indexOf(": $");
  const titleText =
    colonFair >= 0
      ? headline.slice(0, colonFair)
      : colonPrice >= 0
        ? headline.slice(0, colonPrice)
        : headline;
  const totalText =
    colonFair >= 0
      ? headline.slice(colonFair + 2)
      : colonPrice >= 0
        ? headline.slice(colonPrice + 2)
        : "";

  return (
    <section className="bg-card rounded-xl border border-white/10 overflow-hidden mb-3">
      <header className="px-4 py-3 bg-surface/80 border-b border-white/5">
        <div className="flex justify-between gap-2 items-start">
          <div>
            <h3 className="font-semibold text-base leading-snug">{titleText}</h3>
            {totalText ? (
              <p
                className={`text-2xl font-bold leading-tight mt-0.5 ${
                  showFairOnly ? "text-white/55" : "text-accent-high"
                }`}
              >
                {totalText}
              </p>
            ) : null}
            <p className="text-xs text-white/45 mt-1">{subline}</p>
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
      <div className="px-2 divide-y divide-white/5">
        {multi.legs.map((anchorId) => {
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
                slate={slate}
                bookie={legBookie}
                fairPriceInSlot={showFairOnly}
                edited={isEdited(anchorId)}
                onSwap={() => swapLeg(anchorId)}
                onReset={() => resetLeg(anchorId)}
                onTap={onLegTap}
              />
            </ErrorBoundary>
          );
        })}
      </div>
      <div className="p-3 bg-surface/40">
        {missingAtBookie > 0 && legBookie && (
          <p className="text-xs text-accent-warn mb-2">
            {missingAtBookie} leg(s) have no {legBookie} price — total may be incomplete
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