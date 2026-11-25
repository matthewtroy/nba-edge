import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { PickLeg, SlateGame } from "@lib/types";
import { legGameTipSubtitle } from "@lib/leg-game-label";
import { siblingRungs } from "@lib/leg-rungs";
import { marketLabel, verdict } from "../utils/format";
import { LastFiveTicks } from "./LastFiveTicks";
import { RungStepper } from "./RungStepper";
import { legReasonLineUi } from "../lib/leg-reason-ui";
import { ui } from "../lib/card-type-scale";

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
    <motionBackdrop onClose={onClose}>
      <motionPanel>
        <div className="w-9 h-1 bg-white/15 rounded-full mx-auto mb-4" />
        <h2 className="text-base font-semibold break-words leading-tight text-white theme-adaptive-title">
          {leg.playerName}
        </h2>
        <p className="text-xs text-white/55 mt-0.5">{marketLabel(leg.market, leg.line)}</p>
        {subtitle && <p className="text-[11px] text-white/40 mt-0.5">{subtitle}</p>}
        {leg.reasonLine && (() => {
          const reasonUi = legReasonLineUi(leg.reasonLine);
          return (
            <p className={`mt-3 ${reasonUi.className}`} style={{ whiteSpace: "normal" }}>
              {reasonUi.prefix}
              {leg.reasonLine}
            </p>
          );
        })()}
        {onSelectLeg && (
          <RungStepper rungs={rungs} activeId={leg.id} onSelect={onSelectLeg} compact />
        )}
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] text-white/50 mt-3 mb-3">
          {leg.seasonAvg && (
            <motionDlItem
              label="Season"
              value={`${leg.seasonAvg.pts.toFixed(1)}/${leg.seasonAvg.reb.toFixed(1)}/${leg.seasonAvg.ast.toFixed(1)}`}
            />
          )}
          {leg.projectedMinutes != null && (
            <motionDlItem label="Min" value={`${leg.projectedMinutes.toFixed(0)}`} />
          )}
        </dl>
        <p className="text-sm mb-2">
          <span className={ui.legFair}>Fair {leg.fairPrice.toFixed(2)}</span>
          {bestFeed && (
            <span className={`ml-2 ${ui.legPrice} !text-lg`}>
              {bestFeed.bookie} ${bestFeed.price.toFixed(2)}
            </span>
          )}
        </p>
        {last10.length > 0 && (
          <motionLastTen>
            <LastFiveTicks ticks={last10} compact hideLabel />
          </motionLastTen>
        )}
        {leg.market.startsWith("q1") && leg.q1SeasonHitAtLine && (
          <p className="text-xs text-white/55 mb-2">
            Q1 @ line: {leg.q1SeasonHitAtLine.hits}/{leg.q1SeasonHitAtLine.total}
          </p>
        )}
        <label className="block text-[11px] text-white/45 mb-1">My {myBookie}</label>
        <input
          type="number"
          step="0.01"
          value={bookPrice}
          onChange={(e) => savePrice(e.target.value)}
          className="w-full bg-transparent border border-white/[0.08] rounded-xl px-3 py-2 text-sm mb-2 text-white outline-none"
          placeholder="Price"
        />
        {v && (
          <p className="text-xs text-white/55 mb-2 capitalize">{v}</p>
        )}
      </motionPanel>
    </motionBackdrop>
  );
}

function motionBackdrop({
  children,
  onClose,
}: {
  children: ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-end bg-black/50"
      onClick={onClose}
    >
      {children}
    </div>
  );
}

function motionPanel({ children }: { children: ReactNode }) {
  return (
    <div
      className="bg-card rounded-t-[20px] px-4 py-4 max-h-[85vh] overflow-y-auto animate-slide-up border-t border-white/[0.06]"
      onClick={(e) => e.stopPropagation()}
    >
      {children}
    </div>
  );
}

function motionDlItem({ label, value }: { label: string; value: string }) {
  return (
    <motionDtDd>
      <dt className="text-white/35">{label}</dt>
      <dd>{value}</dd>
    </motionDtDd>
  );
}

function motionDtDd({ children }: { children: ReactNode }) {
  return <div>{children}</div>;
}

function motionLastTen({ children }: { children: ReactNode }) {
  return <div className="mb-3">{children}</div>;
}