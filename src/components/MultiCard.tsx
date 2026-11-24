import { useState } from "react";
import type { MultiBet, PickLeg } from "@lib/types";
import { LegRow } from "./LegRow";

interface Props {
  multi: MultiBet;
  picksById: Map<string, PickLeg>;
  onLegTap: (leg: PickLeg) => void;
  onCopy: (text: string) => void;
}

export function MultiCard({ multi, picksById, onLegTap, onCopy }: Props) {
  const legs = multi.legs.map((id) => picksById.get(id)).filter(Boolean) as PickLeg[];
  const title =
    multi.variant != null ? `${multi.label} (${multi.variant})` : multi.label;

  const discordText = legs
    .map((l) => `${l.playerName} ${l.line}+ ${l.market} @ ${l.takeAt.toFixed(2)}+`)
    .join("\n");

  return (
    <section className="bg-card rounded-xl p-4 mb-3">
      {multi.smallSlateNote && (
        <p className="text-xs text-accent-warn mb-2">Small slate</p>
      )}
      <header className="mb-2">
        <h3 className="font-semibold text-lg">{title}</h3>
        <p className="text-sm text-white/70">
          Take at {multi.combinedTakeAt.toFixed(2)}+ · ~1 in {multi.oneInX}
          {multi.combinedBestPrice != null &&
            ` · ${multi.combinedBestBookie} ${multi.combinedBestPrice.toFixed(2)}`}
        </p>
        {multi.stakeSuggestion != null && (
          <p className="text-xs text-white/50 mt-1">Stake ~${multi.stakeSuggestion}</p>
        )}
        <p className="text-xs text-white/60 mt-1">{multi.summary}</p>
      </header>
      <div className="divide-y divide-white/5">
        {legs.map((leg) => (
          <LegRow key={leg.id} leg={leg} onTap={onLegTap} />
        ))}
      </div>
      <div className="flex gap-2 mt-3">
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
  return (
    <input
      type="number"
      step="0.01"
      placeholder="Bookie total"
      value={val}
      onChange={(e) => {
        setVal(e.target.value);
        localStorage.setItem(key, e.target.value);
      }}
      className="flex-1 py-2 px-2 text-sm bg-surface border border-white/10 rounded-lg"
      title={`Take at ${takeAt.toFixed(2)}`}
    />
  );
}