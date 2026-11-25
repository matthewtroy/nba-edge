import type { InjuryEntry, MultiBet, PickLeg, SlateGame } from "@lib/types";
import { AU_BOOKMAKERS } from "@lib/types";
import { MultiLegRow } from "./MultiLegRow";
import { renderMultiCardCopyText } from "@lib/multi-card-text";
import { NO_SINGLE_BOOKIE_NOTE } from "@lib/multi-display";
import { useMultiBookieSelect } from "../hooks/useMultiBookieSelect";
import { earliestTipIso } from "@lib/official-card-time";
import { formatSydneyOddsTime } from "@lib/leg-tip";

interface Props {
  multi: MultiBet;
  picksById: Map<string, PickLeg>;
  injuries: InjuryEntry[];
  slate?: SlateGame[];
  preferredBookie?: string;
  lockedBookie?: string;
  oddsLastPulled?: string;
  discordCopy?: boolean;
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
] as const;

export function multiCardPlainText(multi: MultiBet, legs: PickLeg[] = []): string {
  return legs.length ? renderMultiCardCopyText(multi, legs) : multi.label;
}

export function MultiCard({
  multi,
  picksById,
  injuries,
  slate = [],
  preferredBookie,
  lockedBookie,
  oddsLastPulled,
  discordCopy = false,
  onRemove,
  onLegTap,
  onCopy,
}: Props) {
  const legs = multi.legs.map((id) => picksById.get(id)).filter(Boolean) as PickLeg[];
  const title =
    multi.variant != null ? `${multi.label} (${multi.variant})` : multi.label;

  const { bookie, select, total } = useMultiBookieSelect(
    multi,
    legs,
    preferredBookie,
    lockedBookie
  );
  const displayBook = lockedBookie ?? bookie;
  const displayTotal =
    displayBook != null ? total ?? undefined : total;

  const tipIso = slate.length ? earliestTipIso(legs, slate) : null;
  const tipNote =
    tipIso != null
      ? `First tip ${formatSydneyOddsTime(tipIso) ?? tipIso}`
      : null;
  const oddsNote = oddsLastPulled
    ? `Odds as at ${formatSydneyOddsTime(oddsLastPulled) ?? oddsLastPulled}`
    : null;

  return (
    <section className="bg-card rounded-xl border border-white/10 overflow-hidden mb-3">
      <header className="px-4 py-3 bg-surface/80 border-b border-white/5">
        <div className="flex justify-between gap-2">
          <h3 className="font-semibold text-lg">{title}</h3>
          {onRemove && (
            <button type="button" className="text-xs text-white/50" onClick={onRemove}>
              Remove
            </button>
          )}
        </div>
        <p className="text-sm mt-1">
          Take at ${multi.combinedTakeAt.toFixed(2)}+ (Fair $
          {multi.combinedFairPrice.toFixed(2)})
        </p>
        {(tipNote || oddsNote) && (
          <p className="text-xs text-white/55 mt-1">
            {[tipNote, oddsNote].filter(Boolean).join(" · ")}
          </p>
        )}
      </header>
      <div className="px-2 divide-y divide-white/5">
        {legs.map((leg) => (
          <MultiLegRow
            key={leg.id}
            leg={leg}
            injuries={injuries}
            picks={Array.from(picksById.values())}
            bookie={displayBook}
            slate={slate}
            oddsLastPulled={oddsLastPulled}
            onTap={onLegTap}
          />
        ))}
      </div>
      <div className="p-3 bg-surface/40 space-y-2">
        {displayBook && displayTotal != null && displayTotal >= multi.combinedTakeAt ? (
          <p className="text-xs text-accent-value">
            Multi odds: {displayBook} ${displayTotal.toFixed(2)}+
          </p>
        ) : displayBook && displayTotal != null ? (
          <p className="text-xs text-white/70">
            Multi odds: {displayBook} ${displayTotal.toFixed(2)}+ (below take-at)
          </p>
        ) : (
          <p className="text-xs text-white/60">{NO_SINGLE_BOOKIE_NOTE}</p>
        )}
        <div className="flex gap-2 items-center">
          {lockedBookie ? (
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
              {AU_BOOKMAKERS.map((b) => (
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
              onCopy(renderMultiCardCopyText(multi, legs, displayBook))
            }
          >
            {discordCopy ? "Copy for Discord" : "Copy"}
          </button>
        </div>
      </div>
    </section>
  );
}