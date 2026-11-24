import { useState } from "react";
import type { MultiBet, PickLeg } from "@lib/types";
import { MultiLegRow } from "./MultiLegRow";
import { formatMultiHeadline, renderMultiCardText } from "@lib/multi-card-text";
import { verdict } from "../utils/format";

interface Props {
  multi: MultiBet;
  picksById: Map<string, PickLeg>;
  onLegTap: (leg: PickLeg) => void;
  onCopy: (text: string) => void;
}

export const FORBIDDEN_MULTI_CARD_STRINGS = [
  "~1 in",
  "Stake",
  "Best:",
  "My (",
  "legs @",
  "Bookie:",
  "Best mix",
  "Copy betslip",
  "Small slate",
] as const;

/** Test hook: plain text that would appear on the card. */
export function multiCardPlainText(multi: MultiBet, legs: PickLeg[] = []): string {
  return legs.length ? renderMultiCardText(multi, legs) : multi.label;
}

export function MultiCard({ multi, picksById, onLegTap, onCopy }: Props) {
  const legs = multi.legs.map((id) => picksById.get(id)).filter(Boolean) as PickLeg[];
  const title =
    multi.variant != null ? `${multi.label} (${multi.variant})` : multi.label;

  const discordText = legs
    .map((l) => `${l.playerName} ${l.line}+ ${l.market} @ ${l.takeAt.toFixed(2)}+`)
    .join("\n");

  return (
    <section className="bg-card rounded-xl border border-white/10 overflow-hidden mb-3">
      <header className="px-4 py-3 bg-surface/80 border-b border-white/5">
        <h3 className="font-semibold text-lg">{title}</h3>
        <p className="text-sm mt-1">{formatMultiHeadline(multi)}</p>
        {multi.combinedBestPrice != null && multi.combinedBestBookie && (
          <p className="text-xs text-accent-value mt-1">
            {multi.combinedBestBookie} ${multi.combinedBestPrice.toFixed(2)}+ (all legs)
          </p>
        )}
      </header>
      <div className="px-2 divide-y divide-white/5">
        {legs.map((leg) => (
          <MultiLegRow key={leg.id} leg={leg} onTap={onLegTap} />
        ))}
      </div>
      <div className="flex gap-2 p-3 bg-surface/40">
        <BookieTotalInput multiId={multi.legs.join("-")} takeAt={multi.combinedTakeAt} />
        <button
          type="button"
          className="flex-1 py-2 text-sm bg-surface border border-white/10 rounded-lg"
          onClick={() => onCopy(discordText)}
        >
          Copy for Discord
        </button>
      </div>
    </section>
  );
}

function BookieTotalInput({ multiId, takeAt }: { multiId: string; takeAt: number }) {
  const key = `multi-price-${multiId}`;
  const [val, setVal] = useState(() => localStorage.getItem(key) ?? "");
  const num = parseFloat(val);
  const label =
    Number.isFinite(num) && num > 1
      ? verdict(num, takeAt) === "value"
        ? "Value"
        : verdict(num, takeAt) === "fair"
          ? "Fair"
          : "Pass"
      : null;

  return (
    <div className="flex-1 flex flex-col gap-0.5">
      <input
        type="number"
        step="0.01"
        placeholder="Bookie total"
        value={val}
        onChange={(e) => {
          setVal(e.target.value);
          localStorage.setItem(key, e.target.value);
        }}
        className="w-full py-2 px-2 text-sm bg-surface border border-white/10 rounded-lg"
      />
      {label && (
        <span className="text-xs text-white/60 text-center">{label}</span>
      )}
    </div>
  );
}