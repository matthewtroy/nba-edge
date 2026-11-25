import { useEffect, useMemo, useState } from "react";
import type { PickLeg } from "@lib/types";
import { visibleLegReasons } from "@lib/leg-display";
import { siblingRungs } from "@lib/leg-rungs";
import { marketLabel, verdict } from "../utils/format";
import { LastFiveTicks } from "./LastFiveTicks";
import { RungStepper } from "./RungStepper";

interface Props {
  leg: PickLeg | null;
  picks?: PickLeg[];
  myBookie?: string;
  onClose: () => void;
  onSelectLeg?: (leg: PickLeg) => void;
}

export function LegSheet({ leg, picks = [], myBookie = "bet365", onClose, onSelectLeg }: Props) {
  const [bookPrice, setBookPrice] = useState("");

  useEffect(() => {
    if (!leg) return;
    const key = `leg-price-${leg.id}`;
    const saved = localStorage.getItem(key);
    if (saved) setBookPrice(saved);
    else if (leg.bookiePrices?.[myBookie]) {
      setBookPrice(String(leg.bookiePrices[myBookie]));
    } else setBookPrice("");
  }, [leg, myBookie]);

  const rungs = useMemo(() => (leg ? siblingRungs(picks, leg) : []), [leg, picks]);

  if (!leg) return null;

  const savePrice = (v: string) => {
    setBookPrice(v);
    localStorage.setItem(`leg-price-${leg.id}`, v);
  };

  const num = Number(bookPrice);
  const v = Number.isFinite(num) && num > 1 ? verdict(num, leg.takeAt) : null;
  const ticks = leg.recentVsLine ?? [];
  const bestFeed =
    leg.bestPrice != null && leg.bestBookie && leg.bestBookie !== "bet365"
      ? { bookie: leg.bestBookie, price: leg.bestPrice }
      : null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/60" onClick={onClose}>
      <div
        className="bg-card rounded-t-2xl p-4 max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-12 h-1 bg-white/20 rounded mx-auto mb-3" />
        <h2 className="text-lg font-semibold mb-1 break-words">{leg.playerName}</h2>
        <p className="text-sm text-white/70 mb-3">{marketLabel(leg.market, leg.line)}</p>
        {onSelectLeg && (
          <RungStepper rungs={rungs} activeId={leg.id} onSelect={onSelectLeg} />
        )}
        <p className="text-2xl font-bold mb-1">{(leg.probability * 100).toFixed(1)}% final</p>
        <p className="text-sm mb-1 text-white/70">
          Model {(leg.modelProbability ?? leg.probability) * 100}% · Market{" "}
          {leg.marketProbability != null
            ? `${(leg.marketProbability * 100).toFixed(1)}%`
            : "n/a"}
        </p>
        <p className="text-sm mb-4">
          Fair {leg.fairPrice.toFixed(2)} · Take at {leg.takeAt.toFixed(2)}+
        </p>
        <LastFiveTicks ticks={ticks} />
        {leg.market.startsWith("q1") && leg.q1Last10HitRate != null && (
          <p className="text-sm text-white/70 mb-3">
            Last 10 Q1 hit rate @ line: {(leg.q1Last10HitRate * 100).toFixed(0)}%
          </p>
        )}
        <ul className="text-sm space-y-1 my-4 text-white/80">
          {visibleLegReasons(leg.reasons).map((r) => (
            <li key={r}>• {r}</li>
          ))}
        </ul>
        {bestFeed && (
          <p className="text-sm text-accent-value mb-2">
            Best: {bestFeed.bookie} {bestFeed.price.toFixed(2)}
          </p>
        )}
        <label className="block text-sm text-white/70 mb-1">
          My bookie ({myBookie})
        </label>
        <input
          type="number"
          step="0.01"
          value={bookPrice}
          onChange={(e) => savePrice(e.target.value)}
          className="w-full bg-surface border border-white/10 rounded-lg px-3 py-2 mb-2"
          placeholder="e.g. 1.45"
        />
        {v && (
          <p className="text-sm mb-4">
            {v === "value" && "Value ✅"}
            {v === "fair" && "Fair ➖"}
            {v === "pass" && "Pass ❌"}
          </p>
        )}
      </div>
    </div>
  );
}