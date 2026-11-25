import { useEffect, useMemo, useState } from "react";
import type { PickLeg, SlateGame } from "@lib/types";
import { legGameTipSubtitle } from "@lib/leg-game-label";
import { visibleLegReasons } from "@lib/leg-display";
import { siblingRungs } from "@lib/leg-rungs";
import { marketLabel, verdict } from "../utils/format";
import { LastFiveTicks } from "./LastFiveTicks";
import { RungStepper } from "./RungStepper";

interface Props {
  leg: PickLeg | null;
  picks?: PickLeg[];
  slate?: SlateGame[];
  myBookie?: string;
  onClose: () => void;
  onSelectLeg?: (leg: PickLeg) => void;
}

export function LegSheet({ leg, picks = [], slate, myBookie = "bet365", onClose, onSelectLeg }: Props) {
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

  const subtitle = slate ? legGameTipSubtitle(leg, slate) : null;

  const savePrice = (v: string) => {
    setBookPrice(v);
    localStorage.setItem(`leg-price-${leg.id}`, v);
  };

  const num = Number(bookPrice);
  const v = Number.isFinite(num) && num > 1 ? verdict(num, leg.takeAt) : null;
  const ticks = leg.recentVsLine ?? [];
  const last10 = leg.recentTenVsLine ?? [];
  const bestFeed =
    leg.bestPrice != null && leg.bestBookie
      ? { bookie: leg.bestBookie, price: leg.bestPrice }
      : null;
  const injuryLines = visibleLegReasons(leg.reasons).filter((r) => /out:|benefit/i.test(r));

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/60" onClick={onClose}>
      <div
        className="bg-card rounded-t-2xl p-4 max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-12 h-1 bg-white/20 rounded mx-auto mb-3" />
        <h2 className="text-lg font-semibold mb-1 break-words">{leg.playerName}</h2>
        <p className="text-sm text-white/70 mb-1">{marketLabel(leg.market, leg.line)}</p>
        {subtitle && <p className="text-xs text-white/45 mb-2">{subtitle}</p>}
        {leg.reasonLine && <p className="text-sm text-white/80 mb-2">{leg.reasonLine}</p>}
        {onSelectLeg && (
          <RungStepper rungs={rungs} activeId={leg.id} onSelect={onSelectLeg} />
        )}
        {leg.seasonAvg && (
          <p className="text-xs text-white/55 mb-2">
            Season avg {leg.seasonAvg.pts.toFixed(1)}/{leg.seasonAvg.reb.toFixed(1)}/
            {leg.seasonAvg.ast.toFixed(1)}
            {leg.lastFiveAvg
              ? ` · L5 ${leg.lastFiveAvg.pts.toFixed(1)}/${leg.lastFiveAvg.reb.toFixed(1)}/${leg.lastFiveAvg.ast.toFixed(1)}`
              : ""}
            {leg.projectedMinutes != null ? ` · ${leg.projectedMinutes.toFixed(0)} min proj` : ""}
          </p>
        )}
        <p className="text-sm mb-2 text-white/70">
          Fair {leg.fairPrice.toFixed(2)}
          {bestFeed ? ` · Best ${bestFeed.bookie} ${bestFeed.price.toFixed(2)}` : ""}
        </p>
        <LastFiveTicks ticks={ticks} />
        {last10.length > 0 && (
          <div className="mt-2">
            <p className="text-xs text-white/55 mb-1">Last 10 @ line</p>
            <LastFiveTicks ticks={last10} compact />
          </div>
        )}
        {leg.market.startsWith("q1") && leg.q1SeasonHitAtLine && (
          <p className="text-sm text-white/70 mt-2 mb-2">
            Q1 hit rate this season @ line: {leg.q1SeasonHitAtLine.hits}/
            {leg.q1SeasonHitAtLine.total}
          </p>
        )}
        {injuryLines.length > 0 && (
          <ul className="text-sm space-y-1 my-3 text-white/75">
            {injuryLines.map((r) => (
              <li key={r}>• {r}</li>
            ))}
          </ul>
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