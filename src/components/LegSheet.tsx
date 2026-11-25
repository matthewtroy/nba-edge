import { useEffect, useMemo, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type { PickLeg, SlateGame } from "@lib/types";
import { AU_BOOKMAKERS } from "@lib/types";
import { legGameTipSubtitle } from "@lib/leg-game-label";
import { siblingRungs } from "@lib/leg-rungs";
import { marketLabel, verdict } from "../utils/format";
import { legReasonLineUi } from "../lib/leg-reason-ui";
import { visibleLegReasons } from "@lib/leg-display";
import { isInjuryRedistributionReason, formatInjuryReasonLine } from "@lib/injury-reason";
import { FEED_BOOKIES } from "@lib/card-bookie";
import { legBookieQuoteView } from "@lib/leg-bookie-quote";

interface Props {
  leg: PickLeg | null;
  picks?: PickLeg[];
  slate?: SlateGame[];
  myBookie?: string;
  onClose: () => void;
  onSelectLeg?: (leg: PickLeg) => void;
}

function LastTenBarChart({ ticks }: { ticks: ("hit" | "miss" | "na")[] }) {
  if (!ticks.length) return null;
  const shown = ticks.slice(0, 10);
  return (
    <div className="flex items-end gap-1 h-10" aria-label="Last 10 at line">
      {shown.map((t, i) => (
        <motionBar
          key={i}
          hit={t === "hit"}
          miss={t === "miss"}
          na={t === "na"}
        />
      ))}
    </div>
  );
}

function motionBar({
  hit,
  miss,
  na,
}: {
  hit: boolean;
  miss: boolean;
  na: boolean;
}) {
  const h = hit || miss ? "h-8" : "h-3";
  const color = hit ? "bg-price-green" : miss ? "bg-red-400" : "bg-white/15";
  return <div className={`flex-1 min-w-[6px] max-w-3 rounded-sm ${h} ${color}`} />;
}

function RungChips({
  rungs,
  activeId,
  onSelect,
}: {
  rungs: PickLeg[];
  activeId: string;
  onSelect: (leg: PickLeg) => void;
}) {
  if (rungs.length <= 1) return null;
  return (
    <motionChipRow className="flex flex-wrap gap-1.5 mt-3">
      {rungs.map((r) => (
        <button
          key={r.id}
          type="button"
          onClick={() => onSelect(r)}
          className={`text-xs px-2.5 py-1 rounded-full ${
            r.id === activeId
              ? "bg-white/[0.14] text-white"
              : "bg-white/[0.06] text-white/55"
          }`}
        >
          {marketLabel(r.market, r.line)}
        </button>
      ))}
    </motionChipRow>
  );
}

export function LegSheet({
  leg,
  picks = [],
  slate,
  myBookie = "bet365",
  onClose,
  onSelectLeg,
}: Props) {
  const [bookPrice, setBookPrice] = useState("");
  const [dragY, setDragY] = useState(0);
  const [touchStartY, setTouchStartY] = useState<number | null>(null);

  useEffect(() => {
    if (!leg) return;
    const key = `leg-price-${leg.id}`;
    const saved = localStorage.getItem(key);
    if (saved) setBookPrice(saved);
    else {
      const view = legBookieQuoteView(leg, myBookie, picks);
      if (view.displayPrice != null && view.displayPrice > 1) {
        setBookPrice(String(view.displayPrice));
      } else if (leg.bookiePrices?.[myBookie]) {
        setBookPrice(String(leg.bookiePrices[myBookie]));
      } else setBookPrice("");
    }
    setDragY(0);
  }, [leg, myBookie]);

  useEffect(() => {
    if (!leg) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [leg]);

  const rungs = useMemo(() => (leg ? siblingRungs(picks, leg) : []), [leg, picks]);
  const bookieView = useMemo(
    () => (leg ? legBookieQuoteView(leg, myBookie, picks) : null),
    [leg, myBookie, picks]
  );

  if (!leg || !bookieView) return null;
  const modelLeg = bookieView.modelLeg;
  const subtitle = slate ? legGameTipSubtitle(leg, slate) : null;
  const last10 = modelLeg.recentTenVsLine ?? modelLeg.recentVsLine ?? leg.recentTenVsLine ?? leg.recentVsLine ?? [];
  const isQ1 = modelLeg.market.startsWith("q1");
  const feedPrice = bookieView.displayPrice;

  const savePrice = (v: string) => {
    setBookPrice(v);
    localStorage.setItem(`leg-price-${leg.id}`, v);
  };

  const num = Number(bookPrice);
  const v = Number.isFinite(num) && num > 1 ? verdict(num, modelLeg.takeAt) : null;

  const whyLines = visibleLegReasons(modelLeg.reasons)
    .map((r) =>
      isInjuryRedistributionReason(r) ? formatInjuryReasonLine(r) : r
    )
    .slice(0, 4);
  if (modelLeg.reasonLine && !whyLines.includes(modelLeg.reasonLine)) {
    whyLines.unshift(modelLeg.reasonLine);
  }

  const bookies = [...new Set([...FEED_BOOKIES, ...AU_BOOKMAKERS])];

  const onTouchStart = (e: { touches: { clientY: number }[] }) => {
    setTouchStartY(e.touches[0].clientY);
  };
  const onTouchMove = (e: { touches: { clientY: number }[] }) => {
    if (touchStartY == null) return;
    const dy = e.touches[0].clientY - touchStartY;
    if (dy > 0) setDragY(dy);
  };
  const onTouchEnd = () => {
    if (dragY > 80) onClose();
    setDragY(0);
    setTouchStartY(null);
  };

  return createPortal(
    <motionOverlay onClose={onClose}>
      <motionPanel
        dragY={dragY}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <motionHandleRow onClose={onClose} />

        <h2 className="text-lg font-semibold text-white theme-adaptive-title leading-tight pr-8">
          {leg.playerName}
        </h2>
        <p className="text-sm text-white/55 mt-0.5">
          {marketLabel(modelLeg.market, modelLeg.line)}
        </p>
        {bookieView.lineShift && (
          <p className="text-[11px] text-white/45 mt-0.5">{bookieView.lineShift}</p>
        )}
        {!bookieView.offered && (
          <p className="text-[11px] text-red-400/90 mt-1">
            Not offered at {myBookie} for this line
          </p>
        )}
        {subtitle && (
          <p className="text-[11px] text-white/40 mt-0.5">{subtitle}</p>
        )}

        {onSelectLeg && (
          <RungChips rungs={rungs} activeId={leg.id} onSelect={onSelectLeg} />
        )}

        {last10.length > 0 && (
          <section className="mt-4">
            <p className="text-[11px] text-white/45 mb-2">Last 10 @ line</p>
            <LastTenBarChart ticks={last10} />
          </section>
        )}

        {whyLines.length > 0 && (
          <section className="mt-4 space-y-1.5">
            <p className="text-[11px] text-white/45">Why</p>
            {whyLines.map((line) => {
              const ui = legReasonLineUi(line);
              return (
                <p key={line} className={ui.className}>
                  {ui.prefix}
                  {line}
                </p>
              );
            })}
          </section>
        )}

        <section className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-[11px]">
          <StatCell label="Fair" value={`$${modelLeg.fairPrice.toFixed(2)}`} green />
          <StatCell label="Take at" value={`$${modelLeg.takeAt.toFixed(2)}`} />
          <StatCell
            label="Model p"
            value={`${(modelLeg.probability * 100).toFixed(0)}%`}
          />
          {feedPrice != null && feedPrice > 1 && (
            <StatCell label={`${myBookie}`} value={`$${feedPrice.toFixed(2)}`} green />
          )}
          {modelLeg.projectedMinutes != null && (
            <StatCell label="Min" value={modelLeg.projectedMinutes.toFixed(0)} />
          )}
          {modelLeg.seasonAvg && (
            <>
              <StatCell label="Szn pts" value={modelLeg.seasonAvg.pts.toFixed(1)} />
              <StatCell label="Szn reb" value={modelLeg.seasonAvg.reb.toFixed(1)} />
            </>
          )}
          {isQ1 && modelLeg.q1SeasonHitAtLine && (
            <StatCell
              label="Q1 hit @ line"
              value={`${modelLeg.q1SeasonHitAtLine.hits}/${modelLeg.q1SeasonHitAtLine.total}`}
            />
          )}
          {isQ1 && modelLeg.q1Last10HitRate != null && (
            <StatCell
              label="Q1 L10"
              value={`${(modelLeg.q1Last10HitRate * 100).toFixed(0)}%`}
            />
          )}
        </section>

        <section className="mt-4">
          <p className="text-[11px] text-white/45 mb-2">Bookies</p>
          <ul className="space-y-1 max-h-32 overflow-y-auto">
            {bookies.map((b) => {
              const p = leg.bookiePrices?.[b];
              if (p == null || p <= 1) return null;
              return (
                <li
                  key={b}
                  className="flex justify-between text-xs text-white/70"
                >
                  <span>{b}</span>
                  <span className="text-price-green tabular-nums">
                    ${p.toFixed(2)}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="mt-4">
          <label className="block text-[11px] text-white/45 mb-1">
            Your {myBookie} price
          </label>
          <input
            type="number"
            step="0.01"
            value={bookPrice}
            onChange={(e) => savePrice(e.target.value)}
            className="w-full bg-transparent border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-white tabular-nums outline-none"
            placeholder="e.g. 1.85"
          />
          {v && (
            <p className="text-xs text-white/55 mt-1 capitalize">{v}</p>
          )}
        </section>
      </motionPanel>
    </motionOverlay>,
    document.body
  );
}

function StatCell({
  label,
  value,
  green,
}: {
  label: string;
  value: string;
  green?: boolean;
}) {
  return (
    <div>
      <dt className="text-white/35">{label}</dt>
      <dd
        className={`font-medium tabular-nums ${
          green ? "text-price-green" : "text-white/80"
        }`}
      >
        {value}
      </dd>
    </div>
  );
}

function motionOverlay({
  children,
  onClose,
}: {
  children: ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[200] pointer-events-auto"
      role="dialog"
      aria-modal="true"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/60"
        aria-label="Close leg details"
        onClick={onClose}
      />
      <div className="absolute inset-x-0 bottom-0 flex justify-center">
        {children}
      </div>
    </div>
  );
}

function motionPanel({
  children,
  dragY,
  onTouchStart,
  onTouchMove,
  onTouchEnd,
}: {
  children: ReactNode;
  dragY: number;
  onTouchStart: (e: React.TouchEvent) => void;
  onTouchEnd: () => void;
  onTouchMove: (e: React.TouchEvent) => void;
}) {
  return (
    <motionPanelInner
      dragY={dragY}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {children}
    </motionPanelInner>
  );
}

function motionPanelInner({
  children,
  dragY,
  onTouchStart,
  onTouchMove,
  onTouchEnd,
}: {
  children: ReactNode;
  dragY: number;
  onTouchStart: (e: React.TouchEvent) => void;
  onTouchEnd: () => void;
  onTouchMove: (e: React.TouchEvent) => void;
}) {
  return (
    <div
      className="bg-card rounded-t-[20px] px-4 pt-2 pb-8 max-h-[85vh] overflow-y-auto overscroll-contain animate-slide-up border-t border-white/[0.08] w-full max-w-phone shadow-[0_-8px_40px_rgba(0,0,0,0.45)]"
      style={{
        transform: dragY ? `translateY(${dragY}px)` : undefined,
        backgroundColor: "#121821",
      }}
      onClick={(e) => e.stopPropagation()}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {children}
    </div>
  );
}

function motionHandleRow({ onClose }: { onClose: () => void }) {
  return (
    <div className="relative flex justify-center pt-1 pb-3">
      <div className="w-9 h-1 bg-white/15 rounded-full" aria-hidden />
      <button
        type="button"
        onClick={onClose}
        className="absolute right-0 top-0 p-2 text-white/45 text-lg leading-none"
        aria-label="Close"
      >
        ✕
      </button>
    </div>
  );
}

function motionChipRow({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={className}>{children}</div>;
}