import type { MultiBet, PickLeg } from "@lib/types";
import { MultiLegRow } from "./MultiLegRow";
import { renderMultiCardCopyText } from "@lib/multi-card-text";

interface Props {
  multi: MultiBet;
  picksById: Map<string, PickLeg>;
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
] as const;

/** Test hook: plain text that would be copied from the card. */
export function multiCardPlainText(multi: MultiBet, legs: PickLeg[] = []): string {
  return legs.length ? renderMultiCardCopyText(multi, legs) : multi.label;
}

export function MultiCard({ multi, picksById, onLegTap, onCopy }: Props) {
  const legs = multi.legs.map((id) => picksById.get(id)).filter(Boolean) as PickLeg[];
  const title =
    multi.variant != null ? `${multi.label} (${multi.variant})` : multi.label;

  const bestTotal = multi.bestBookieTotal ?? multi.combinedBestPrice;
  const bestBook = multi.bestBookie ?? multi.combinedBestBookie;

  return (
    <section className="bg-card rounded-xl border border-white/10 overflow-hidden mb-3">
      <header className="px-4 py-3 bg-surface/80 border-b border-white/5">
        <h3 className="font-semibold text-lg">{title}</h3>
        <p className="text-sm mt-1">
          Take at ${multi.combinedTakeAt.toFixed(2)}+ (Fair ${multi.combinedFairPrice.toFixed(2)})
        </p>
        {bestTotal != null && bestBook === "Best across books" && (
          <p className="text-xs text-white/60 mt-1">
            Cross-book ${bestTotal.toFixed(2)}+ — not one placeable multi
          </p>
        )}
        {bestTotal != null && bestBook && bestBook !== "Best across books" && (
          <p className="text-xs text-accent-value mt-1">
            {bestBook} ${bestTotal.toFixed(2)}+ (all legs)
          </p>
        )}
      </header>
      <div className="px-2 divide-y divide-white/5">
        {legs.map((leg) => (
          <MultiLegRow key={leg.id} leg={leg} onTap={onLegTap} />
        ))}
      </div>
      <div className="p-3 bg-surface/40">
        <button
          type="button"
          className="w-full py-2.5 text-sm bg-surface border border-white/10 rounded-lg font-medium"
          onClick={() => onCopy(renderMultiCardCopyText(multi, legs))}
        >
          Copy bet slip
        </button>
      </div>
    </section>
  );
}