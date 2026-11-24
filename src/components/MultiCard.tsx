import { useMemo, useState } from "react";
import type { MultiBet, PickLeg } from "@lib/types";
import { LegRow } from "./LegRow";
import { bookiesWithFullMulti, combinedPriceForBookie } from "../utils/bookie";
import { verdict } from "../utils/format";

interface Props {
  multi: MultiBet;
  picksById: Map<string, PickLeg>;
  myBookie?: string;
  onLegTap: (leg: PickLeg) => void;
  onCopy: (text: string) => void;
}

export const FORBIDDEN_MULTI_CARD_STRINGS = ["Best mix", "Copy betslip"];

/** Test hook: text fields that may appear on a rendered card. */
export function multiCardPlainText(multi: MultiBet): string {
  return [multi.label, multi.combinedBestBookie ?? "", multi.summary ?? ""].join(" ");
}

export function MultiCard({ multi, picksById, myBookie = "bet365", onLegTap, onCopy }: Props) {
  const legs = multi.legs.map((id) => picksById.get(id)).filter(Boolean) as PickLeg[];
  const title =
    multi.variant != null ? `${multi.label} (${multi.variant})` : multi.label;

  const bookieOptions = useMemo(() => bookiesWithFullMulti(legs), [legs]);
  const defaultBookie =
    multi.combinedBestBookie && bookieOptions.includes(multi.combinedBestBookie)
      ? multi.combinedBestBookie
      : bookieOptions.includes(myBookie)
        ? myBookie
        : bookieOptions[0];
  const [bookie, setBookie] = useState(defaultBookie ?? myBookie);

  const bookieCombo = combinedPriceForBookie(legs, bookie);
  const discordText = legs
    .map((l) => `${l.playerName} ${l.line}+ ${l.market} @ ${l.takeAt.toFixed(2)}+`)
    .join("\n");

  return (
    <section className="bg-card rounded-xl border border-white/10 overflow-hidden mb-3">
      {multi.smallSlateNote && (
        <p className="text-xs text-accent-warn px-4 pt-3">Small slate</p>
      )}
      <header className="px-4 py-3 bg-surface/80 border-b border-white/5">
        <h3 className="font-semibold text-lg">{title}</h3>
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm mt-1">
          <span>
            Take at <strong>{multi.combinedTakeAt.toFixed(2)}+</strong>
          </span>
          <span className="text-white/60">Fair {multi.combinedFairPrice.toFixed(2)}</span>
          <span className="text-white/60">Lands ~1 in {multi.oneInX}</span>
        </div>
        {multi.combinedBestPrice != null && multi.combinedBestBookie && (
          <p className="text-xs text-accent-value mt-1">
            {multi.combinedBestBookie} {multi.combinedBestPrice.toFixed(2)}+ (all legs)
          </p>
        )}
        {bookieOptions.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1 items-center">
            <span className="text-xs text-white/50 mr-1">Single bookie:</span>
            {bookieOptions.map((b) => (
              <button
                key={b}
                type="button"
                onClick={() => setBookie(b)}
                className={`text-xs px-2 py-0.5 rounded-full border ${
                  bookie === b
                    ? "border-accent-high text-accent-high bg-accent-high/10"
                    : "border-white/15 text-white/70"
                }`}
              >
                {b}
              </button>
            ))}
            {bookieCombo != null && (
              <span className="text-xs text-white/70 ml-1">
                Total {bookieCombo.toFixed(2)}
                {bookieCombo >= multi.combinedTakeAt ? " · Value" : " · below take-at"}
              </span>
            )}
          </div>
        )}
        {multi.stakeSuggestion != null && (
          <p className="text-xs text-white/50 mt-1">Stake ~${multi.stakeSuggestion}</p>
        )}
        {multi.summary && (
          <p className="text-xs text-white/55 mt-1">{multi.summary}</p>
        )}
      </header>
      <div className="px-2 divide-y divide-white/5">
        {legs.map((leg) => (
          <LegRow key={leg.id} leg={leg} myBookie={bookie} onTap={onLegTap} />
        ))}
      </div>
      <div className="flex gap-2 p-3 bg-surface/40">
        <BookieTotalInput
          multiId={multi.legs.join("-")}
          takeAt={multi.combinedTakeAt}
        />
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
        title={`Take at ${takeAt.toFixed(2)}`}
      />
      {label && (
        <span className="text-xs text-white/60 text-center">{label}</span>
      )}
    </div>
  );
}