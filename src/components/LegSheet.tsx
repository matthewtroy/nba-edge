import { useEffect, useMemo, useState, type ReactNode, type TouchEvent } from "react";
import { createPortal } from "react-dom";
import type { InjuryEntry, PickLeg, SlateGame } from "@lib/types";
import { AU_BOOKMAKERS } from "@lib/types";
import { legGameTipSubtitle } from "@lib/leg-game-label";
import { siblingRungs } from "@lib/leg-rungs";
import { marketLabel, verdict } from "../utils/format";
import { legReasonLineUi } from "../lib/leg-reason-ui";
import { sortLegRowBadgeTags, visibleLegReasons } from "@lib/leg-display";
import { displayLegRowTags } from "@lib/value-at-bookie";
import { ui } from "../lib/card-type-scale";
import { FEED_BOOKIES } from "@lib/card-bookie";
import { legBookieQuoteView } from "@lib/leg-bookie-quote";
import { InjuryStatusBadge, injuryStatusForPlayer } from "./InjuryStatusBadge";

interface Props {
  leg: PickLeg | null;
  picks?: PickLeg[];
  slate?: SlateGame[];
  injuries?: InjuryEntry[];
  myBookie?: string;
  onClose: () => void;
  onSelectLeg?: (leg: PickLeg) => void;
}

function LastTenBarChart({
  ticks,
  values,
  line,
}: {
  ticks: ("hit" | "miss" | "na")[];
  values?: (number | null)[];
  line: number;
}) {
  if (!ticks.length) return null;
  const shown = ticks.slice(0, 10);
  const nums = values?.slice(0, 10) ?? [];
  const hasStatValues = nums.length > 0 && nums.some((v) => v != null);
  if (!hasStatValues) {
    return (
      <div aria-label="Last 10 at line">
        <div className="flex items-center gap-1 flex-wrap">
          {shown.map((t, i) => (
            <span
              key={i}
              className={`w-2 h-2 rounded-full ${
                t === "hit"
                  ? "bg-price-green"
                  : t === "miss"
                    ? "bg-red-400"
                    : "bg-white/20"
              }`}
            />
          ))}
        </div>
        <p className="text-[10px] text-white/45 mt-1.5">Stat values unavailable</p>
      </div>
    );
  }
  const maxVal = Math.max(line, ...nums.filter((v): v is number => v != null), 1);
  return (
    <div className="flex items-end gap-1 h-14" aria-label="Last 10 at line">
      {shown.map((t, i) => (
        <MotionBar
          key={i}
          hit={t === "hit"}
          miss={t === "miss"}
          na={t === "na"}
          value={nums[i]}
          line={line}
          maxVal={maxVal}
        />
      ))}
    </div>
  );
}

function MotionBar({
  hit,
  miss,
  na,
  value,
  line,
  maxVal,
}: {
  hit: boolean;
  miss: boolean;
  na: boolean;
  value?: number | null;
  line: number;
  maxVal: number;
}) {
  const scale = maxVal > 0 && value != null ? value / maxVal : hit || miss ? line / maxVal : 0.15;
  const hPx = Math.max(8, Math.round(scale * 56));
  const color = hit ? "bg-price-green" : miss ? "bg-red-400" : "bg-white/15";
  return (
    <div className="flex-1 min-w-[6px] max-w-3 flex flex-col items-center justify-end gap-0.5">
      {value != null && !na ? (
        <span className="text-[9px] tabular-nums text-white/55 leading-none">{value}</span>
      ) : null}
      <div
        className={`w-full rounded-sm ${color}`}
        style={{ height: `${hPx}px` }}
      />
    </div>
  );
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
    <MotionChipRow className="flex flex-wrap gap-1.5 mt-3">
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
    </MotionChipRow>
  );
}

export function LegSheet({
  leg,
  picks = [],
  slate,
  injuries = [],
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
  const last10 =
    leg.recentTenVsLine ??
    modelLeg.recentTenVsLine ??
    modelLeg.recentVsLine ??
    leg.recentVsLine ??
    [];
  const last10Vals = modelLeg.lastTenStatValues ?? leg.lastTenStatValues;
  const feedPrice = bookieView.displayPrice;

  const savePrice = (v: string) => {
    setBookPrice(v);
    localStorage.setItem(`leg-price-${leg.id}`, v);
  };

  const num = Number(bookPrice);
  const v = Number.isFinite(num) && num > 1 ? verdict(num, modelLeg.takeAt) : null;

  const whyLines = visibleLegReasons(modelLeg.reasons).slice(0, 4);
  const valuePills = sortLegRowBadgeTags(
    displayLegRowTags(modelLeg, myBookie).filter(
      (t) => t === "Value" || t === "High probability"
    )
  );

  const bookies = [...new Set([...FEED_BOOKIES, ...AU_BOOKMAKERS])];

  const onTouchStart = (e: TouchEvent) => {
    setTouchStartY(e.touches[0].clientY);
  };
  const onTouchMove = (e: TouchEvent) => {
    if (touchStartY == null) return;
    const dy = e.touches[0].clientY - touchStartY;
    if (dy > 0) setDragY(dy);
  };
  const onTouchEnd = () => {
    if (dragY > 80) onClose();
    setDragY(0);
    setTouchStartY(null);
  };

  if (typeof document === "undefined") return null;
  const portalTarget =
    document.getElementById("leg-sheet-portal") ?? document.body;

  return createPortal(
    <MotionOverlay onClose={onClose}>
      <MotionPanel
        dragY={dragY}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <MotionHandleRow onClose={onClose} />

        <header className="min-h-[56px] pr-8 flex flex-col justify-center">
          <h2 className="text-base font-semibold text-white theme-adaptive-title leading-tight">
            {leg.playerName}
          </h2>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1">
            <InjuryStatusBadge status={injuryStatusForPlayer(injuries, leg.playerId)} />
          </div>
          <p className="text-sm text-white/55 mt-0.5">
            {marketLabel(modelLeg.market, modelLeg.line)}
          </p>
          {bookieView.lineShift && (
            <p className="text-[11px] text-white/45 mt-0.5">{bookieView.lineShift}</p>
          )}
          {subtitle && <p className="text-[11px] text-white/40 mt-0.5">{subtitle}</p>}
        </header>

        {onSelectLeg && (
          <RungChips rungs={rungs} activeId={leg.id} onSelect={onSelectLeg} />
        )}

        <section className="mt-3 grid grid-cols-3 gap-2 items-start border-b border-white/[0.06] pb-3">
          <div className="min-w-0">
            {feedPrice != null && feedPrice > 1 ? (
              <>
                <p className="text-lg font-bold text-price-green tabular-nums leading-tight">
                  ${feedPrice.toFixed(2)}
                </p>
                <p className="text-[11px] text-white/50 mt-0.5">{myBookie}</p>
              </>
            ) : (
              <p className="text-sm text-white/45">—</p>
            )}
            {valuePills.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {valuePills.map((pill) => (
                  <span key={pill} className={ui.badge}>
                    {pill}
                  </span>
                ))}
              </div>
            )}
            {!bookieView.offered && (
              <p className="text-[10px] text-red-400/90 mt-1">Not at {myBookie}</p>
            )}
          </div>
          <StatCell label="Fair" value={`$${modelLeg.fairPrice.toFixed(2)}`} green />
          <StatCell label="Take at" value={`$${modelLeg.takeAt.toFixed(2)}`} />
        </section>

        {last10.length > 0 && (
          <section className="mt-4">
            <p className="text-[11px] text-white/45 mb-1.5">Last 10</p>
            <LastTenBarChart ticks={last10} values={last10Vals} line={modelLeg.line} />
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
      </MotionPanel>
    </MotionOverlay>,
    portalTarget
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

function MotionOverlay({
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
      data-testid="leg-sheet"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/60"
        aria-label="Close leg details"
        onClick={onClose}
      />
      <div className="absolute inset-x-0 bottom-0 flex justify-center pointer-events-none">
        <div className="w-full max-w-phone pointer-events-auto">{children}</div>
      </div>
    </div>
  );
}

function MotionPanel({
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
    <MotionPanelInner
      dragY={dragY}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {children}
    </MotionPanelInner>
  );
}

function MotionPanelInner({
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
      className="w-full border-t border-white/[0.08] shadow-[0_-8px_40px_rgba(0,0,0,0.45)]"
      style={{ backgroundColor: "#121821" }}
      onClick={(e) => e.stopPropagation()}
    >
      <div
        className="rounded-t-[20px] px-4 pt-1 pb-6 max-h-[65vh] overflow-y-auto overscroll-contain w-full"
        style={{ transform: dragY ? `translateY(${dragY}px)` : undefined }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {children}
      </div>
    </div>
  );
}

function MotionHandleRow({ onClose }: { onClose: () => void }) {
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

function MotionChipRow({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={className}>{children}</div>;
}