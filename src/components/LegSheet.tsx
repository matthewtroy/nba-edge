import { useEffect, useState } from "react";
import type { PickLeg } from "@lib/types";
import { marketLabel, verdict } from "../utils/format";

interface Props {
  leg: PickLeg | null;
  onClose: () => void;
}

export function LegSheet({ leg, onClose }: Props) {
  const [bookPrice, setBookPrice] = useState("");

  useEffect(() => {
    if (!leg) return;
    const key = `leg-price-${leg.id}`;
    setBookPrice(localStorage.getItem(key) ?? "");
  }, [leg]);

  if (!leg) return null;

  const savePrice = (v: string) => {
    setBookPrice(v);
    localStorage.setItem(`leg-price-${leg.id}`, v);
  };

  const num = Number(bookPrice);
  const v = Number.isFinite(num) && num > 1 ? verdict(num, leg.takeAt) : null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/60" onClick={onClose}>
      <div
        className="bg-card rounded-t-2xl p-4 max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <motionBand />
        <h2 className="text-lg font-semibold mb-1">{leg.playerName}</h2>
        <p className="text-sm text-white/70 mb-3">{marketLabel(leg.market, leg.line)}</p>
        <p className="text-2xl font-bold mb-1">{(leg.probability * 100).toFixed(1)}% chance</p>
        <p className="text-sm mb-4">
          Fair {leg.fairPrice.toFixed(2)} · Take at {leg.takeAt.toFixed(2)}+
        </p>
        <ul className="text-sm space-y-1 mb-4 text-white/80">
          {leg.reasons.map((r) => (
            <li key={r}>• {r}</li>
          ))}
        </ul>
        <label className="block text-sm text-white/70 mb-1">Bookie price</label>
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
        <div className="flex gap-1 text-xs text-white/50">Last 5 vs line: ✓ ✓ ✗ ✓ ✓</div>
      </div>
    </div>
  );
}

function motionBand() {
  return <div className="w-12 h-1 bg-white/20 rounded mx-auto mb-3" />;
}