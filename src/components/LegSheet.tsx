import { useEffect, useMemo, useState } from "react";
import type { PickLeg, SlateGame } from "@lib/types";
import { legGameTipSubtitle } from "@lib/leg-game-label";
import { siblingRungs } from "@lib/leg-rungs";
import { marketLabel, verdict } from "../utils/format";
import { LastFiveTicks } from "./LastFiveTicks";
import { RungStepper } from "./RungStepper";
import { legReasonLineUi } from "../lib/leg-reason-ui";

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
  const last10 = leg.recentTenVsLine ?? [];
  const bestFeed =
    leg.bestPrice != null && leg.bestBookie
      ? { bookie: leg.bestBookie, price: leg.bestPrice }
      : null;
  const myBookPrice = leg.bookiePrices?.[myBookie];

  const savePrice = (v: string) => {
    setBookPrice(v);
    localStorage.setItem(`leg-price-${leg.id}`, v);
  };

  const num = Number(bookPrice);
  const v = Number.isFinite(num) && num > 1 ? verdict(num, leg.takeAt) : null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/60" onClick={onClose}>
      <div
        className="bg-card rounded-t-2xl px-3 py-3 max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1 bg-white/20 rounded mx-auto mb-2" />
        <h2 className="text-base font-semibold break-words leading-tight">{leg.playerName}</h2>
        <p className="text-xs text-white/65">{marketLabel(leg.market, leg.line)}</p>
        {subtitle && <p className="text-[11px] text-white/40 mt-0.5">{subtitle}</p>}
        {leg.reasonLine && (() => {
          const ui = legReasonLineUi(leg.reasonLine);
          return (
            <p className={`${ui.className} mt-2 leading-snug`}>
              {ui.prefix}
              {leg.reasonLine}
            </p>
          );
        })()}
        {onSelectLeg && (
          <RungStepper rungs={rungs} activeId={leg.id} onSelect={onSelectLeg} compact />
        )}
        <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-white/55 mt-2 mb-2">
          {leg.seasonAvg && (
            <span>
              Szn {leg.seasonAvg.pts.toFixed(1)}/{leg.seasonAvg.reb.toFixed(1)}/
              {leg.seasonAvg.ast.toFixed(1)}
            </span>
          )}
          {leg.projectedMinutes != null && <span>{leg.projectedMinutes.toFixed(0)} min</span>}
        </div>
        <p className="text-xs text-white/75 mb-1.5">
          Fair {leg.fairPrice.toFixed(2)}
          {bestFeed ? ` · ${bestFeed.bookie} ${bestFeed.price.toFixed(2)}` : ""}
          {myBookPrice != null && myBookPrice > 1
            ? ` · ${myBookie} ${myBookPrice.toFixed(2)}`
            : ""}
        </p>
        {last10.length > 0 && (
          <div className="mb-2">
            <p className="text-[10px] text-white/45 mb-0.5">Last 10 @ line</p>
            <LastFiveTicks ticks={last10} compact />
          </div>
        )}
        {leg.market.startsWith("q1") && leg.q1SeasonHitAtLine && (
          <p className="text-xs text-white/65 mb-2">
            Q1 hit rate @ line: {leg.q1SeasonHitAtLine.hits}/{leg.q1SeasonHitAtLine.total}
          </p>
        )}
        <label className="block text-[11px] text-white/55 mb-0.5">My {myBookie}</label>
        <input
          type="number"
          step="0.01"
          value={bookPrice}
          onChange={(e) => savePrice(e.target.value)}
          className="w-full bg-surface border border-white/10 rounded-lg px-2 py-1.5 text-sm mb-1"
          placeholder="Price"
        />
        {v && (
          <p className="text-xs mb-2">
            {v === "value" && "Value"}
            {v === "fair" && "Fair"}
            {v === "pass" && "Pass"}
          </p>
        )}
      </div>
    </div>
  );
}