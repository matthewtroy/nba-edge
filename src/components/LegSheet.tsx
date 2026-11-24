import { useEffect, useState } from "react";
import type { PickLeg } from "@lib/types";
import { marketLabel, verdict } from "../utils/format";

interface Props {
  leg: PickLeg | null;
  myBookie?: string;
  onClose: () => void;
}

export function LegSheet({ leg, myBookie = "bet365", onClose }: Props) {
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

  if (!leg) return null;

  const savePrice = (v: string) => {
    setBookPrice(v);
    localStorage.setItem(`leg-price-${leg.id}`, v);
  };

  const num = Number(bookPrice);
  const v = Number.isFinite(num) && num > 1 ? verdict(num, leg.takeAt) : null;
  const ticks = leg.recentVsLine ?? [];

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/60" onClick={onClose}>
      <div
        className="bg-card rounded-t-2xl p-4 max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-12 h-1 bg-white/20 rounded mx-auto mb-3" />
        <h2 className="text-lg font-semibold mb-1 break-words">{leg.playerName}</h2>
        <p className="text-sm text-white/70 mb-3">{marketLabel(leg.market, leg.line)}</p>
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
        <ul className="text-sm space-y-1 mb-4 text-white/80">
          {leg.reasons.map((r) => (
            <li key={r}>• {r}</li>
          ))}
        </ul>
        {leg.bestPrice != null && (
          <p className="text-sm text-accent-value mb-2">
            Best: {leg.bestBookie} {leg.bestPrice.toFixed(2)}
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
        <LastFiveTicks ticks={ticks} />
      </div>
    </div>
  );
}

function LastFiveTicks({ ticks }: { ticks: ("hit" | "miss" | "na")[] }) {
  return (
    <div className="flex items-center gap-2 text-sm text-white/70">
      <span className="text-xs">Last 5 vs line:</span>
      <div className="flex gap-1">
        {ticks.map((t, i) => (
          <span
            key={i}
            className={
              t === "hit"
                ? "text-green-400"
                : t === "miss"
                  ? "text-red-400"
                  : "text-white/30"
            }
            aria-label={t}
          >
            {t === "hit" ? "✓" : t === "miss" ? "✗" : "·"}
          </span>
        ))}
      </div>
    </div>
  );
}