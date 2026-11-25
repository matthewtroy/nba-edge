import type { InjuryEntry, MultiBet, PickLeg } from "@lib/types";
import { AU_BOOKMAKERS } from "@lib/types";
import { MultiLegRow } from "./MultiLegRow";
import { renderMultiCardCopyText } from "@lib/multi-card-text";
import { NO_SINGLE_BOOKIE_NOTE } from "@lib/multi-display";
import { useMultiBookieSelect } from "../hooks/useMultiBookieSelect";

interface Props {
  multi: MultiBet;
  picksById: Map<string, PickLeg>;
  injuries: InjuryEntry[];
  preferredBookie?: string;
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
  preferredBookie,
  onLegTap,
  onCopy,
}: Props) {
  const legs = multi.legs.map((id) => picksById.get(id)).filter(Boolean) as PickLeg[];
  const title =
    multi.variant != null ? `${multi.label} (${multi.variant})` : multi.label;

  const { bookie, select, total } = useMultiBookieSelect(
    multi,
    legs,
    preferredBookie
  );
  const displayBook = multi.bestBookie ?? bookie;
  const displayTotal = multi.bestBookieTotal ?? total;

  return (
    <section className="bg-card rounded-xl border border-white/10 overflow-hidden mb-3">
      <header className="px-4 py-3 bg-surface/80 border-b border-white/5">
        <h3 className="font-semibold text-lg">{title}</h3>
        <p className="text-sm mt-1">
          Take at ${multi.combinedTakeAt.toFixed(2)}+ (Fair $
          {multi.combinedFairPrice.toFixed(2)})
        </p>
      </header>
      <div className="px-2 divide-y divide-white/5">
        {legs.map((leg) => (
          <MultiLegRow
            key={leg.id}
            leg={leg}
            injuries={injuries}
            picks={Array.from(picksById.values())}
            bookie={displayBook}
            onTap={onLegTap}
          />
        ))}
      </div>
      <div className="p-3 bg-surface/40 space-y-2">
        {multi.bestBookie && multi.bestBookieTotal != null ? (
          <p className="text-xs text-accent-value">
            Best multi odds: {multi.bestBookie} ${multi.bestBookieTotal.toFixed(2)}+
          </p>
        ) : displayBook && displayTotal != null ? (
          <p className="text-xs text-white/70">
            Best multi odds: {displayBook} ${displayTotal.toFixed(2)}+ (below take-at)
          </p>
        ) : (
          <p className="text-xs text-white/60">{NO_SINGLE_BOOKIE_NOTE}</p>
        )}
        <div className="flex gap-2 items-center">
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
          <button
            type="button"
            className="flex-1 py-2 text-sm bg-surface border border-white/10 rounded-lg font-medium"
            onClick={() =>
              onCopy(renderMultiCardCopyText(multi, legs, displayBook))
            }
          >
            Copy for Discord
          </button>
        </div>
      </div>
    </section>
  );
}