import { useState } from "react";
import type { DataBundle } from "../hooks/useData";
import type { OfficialBetRow } from "@lib/official-bet-settle";

interface Props {
  data: DataBundle;
}

function pct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

function fmtRoi(roi: number | null): string {
  return roi != null ? pct(roi) : "—";
}

function wl(record: { won: number; lost: number; void: number }): string {
  const base = `${record.won}–${record.lost}`;
  return record.void ? `${base} (${record.void} void)` : base;
}

function BetLegList({ bet }: { bet: OfficialBetRow }) {
  const [open, setOpen] = useState(false);
  return (
    <li className="border-b border-white/10 pb-2">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full text-left text-sm"
      >
        {bet.slateDate} · {bet.label} · {bet.result.toUpperCase()}
        {bet.profitUnits != null ? ` · ${bet.profitUnits >= 0 ? "+" : ""}${bet.profitUnits.toFixed(2)}u` : ""}
      </button>
      {open ? (
        <ul className="mt-1 text-xs text-white/60 pl-2 space-y-0.5">
          {bet.legIds.map((id) => (
            <li key={id}>{id}</li>
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export function ResultsScreen({ data }: Props) {
  const results = data.results;
  const gradedCount = results?.gradedLegs.length ?? 0;
  const [modelOpen, setModelOpen] = useState(false);

  if (!results || !results.official.bets.length) {
    return (
      <div className="pb-24">
        <h1 className="text-xl font-bold mb-4">Results</h1>
        <p className="text-sm text-white/60">
          Official track record appears after the first settled official card.
        </p>
      </div>
    );
  }

  const { official, valueLegs, model } = results;
  const rec = official.record;

  return (
    <div className="pb-24 space-y-4">
      <h1 className="text-xl font-bold">Results</h1>

      <section className="bg-card rounded-xl p-4">
        <h2 className="text-sm font-semibold mb-2">Official record (bets)</h2>
        <p className="text-lg tabular-nums">{wl(rec)}</p>
        <p className="text-sm text-white/70 mt-1">
          Staked {rec.staked}u · Profit {rec.profit >= 0 ? "+" : ""}
          {rec.profit.toFixed(2)}u · ROI {fmtRoi(rec.roi)}
        </p>
        <p className="text-xs text-white/50 mt-1">{rec.bets} settled bets</p>
      </section>

      <section className="bg-card rounded-xl p-4">
        <h2 className="text-sm font-semibold mb-2">By bet type</h2>
        <ul className="text-sm space-y-1">
          {Object.entries(official.byBetType).map(([type, row]) => (
            <li key={type} className="tabular-nums">
              {type}: {wl(row)} · {row.bets} bets · {row.staked}u staked ·{" "}
              {row.profit >= 0 ? "+" : ""}
              {row.profit.toFixed(2)}u · ROI {fmtRoi(row.roi)}
            </li>
          ))}
        </ul>
      </section>

      <section className="bg-card rounded-xl p-4">
        <h2 className="text-sm font-semibold mb-2">Last 14 days</h2>
        <ul className="text-sm space-y-2 max-h-56 overflow-y-auto">
          {official.last14d.length ? (
            official.last14d.map((day) => (
              <li key={day.date}>
                <p className="font-medium text-white/80">{day.date}</p>
                <ul className="mt-1 space-y-1">
                  {day.bets.map((bet, i) => (
                    <BetLegList key={`${day.date}-${bet.label}-${i}`} bet={bet} />
                  ))}
                </ul>
              </li>
            ))
          ) : (
            <li className="text-white/60">No official bets in the last 14 days.</li>
          )}
        </ul>
      </section>

      <section className="bg-card rounded-xl p-4">
        <h2 className="text-sm font-semibold mb-1">Value legs (not bets)</h2>
        <p className="text-xs text-white/50 mb-2">
          AU price &gt; fair at 9pm freeze · 1u each · excludes Q1 and bet365
        </p>
        <p className="text-sm tabular-nums">
          {wl(valueLegs.record)} · Hit {valueLegs.record.hitRate != null ? pct(valueLegs.record.hitRate) : "—"}
          {valueLegs.record.avgPrice != null ? ` · Avg ${valueLegs.record.avgPrice.toFixed(2)}` : ""}
        </p>
        <p className="text-sm text-white/70">
          Staked {valueLegs.record.staked}u · Profit {valueLegs.record.profit >= 0 ? "+" : ""}
          {valueLegs.record.profit.toFixed(2)}u · ROI {fmtRoi(valueLegs.record.roi)}
        </p>
        {valueLegs.record.beatMarket != null ? (
          <p className="text-xs text-white/60 mt-1">
            Beat the market (vs implied): {valueLegs.record.beatMarket >= 0 ? "+" : ""}
            {pct(valueLegs.record.beatMarket)}
          </p>
        ) : null}
        {Object.keys(valueLegs.byMarket).length ? (
          <ul className="mt-2 text-xs space-y-0.5 text-white/70">
            {Object.entries(valueLegs.byMarket).map(([m, row]) => (
              <li key={m}>
                {m}: {wl(row)} · ROI {fmtRoi(row.roi)}
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section className="bg-card rounded-xl p-4">
        <button
          type="button"
          onClick={() => setModelOpen(!modelOpen)}
          className="w-full flex justify-between text-sm font-semibold"
        >
          <span>Model check</span>
          <span className="text-white/50">{modelOpen ? "▾" : "▸"}</span>
        </button>
        {modelOpen ? (
          gradedCount < 30 ? (
            <p className="text-sm text-white/60 mt-2">
              Need 30+ graded priced legs for calibration ({gradedCount} so far).
            </p>
          ) : (
            <div className="mt-2 space-y-2 text-sm">
              <ul className="space-y-0.5">
                {model.calibration.map((b) => (
                  <li key={b.range}>
                    {b.range}: expected {pct(b.expected)}, actual {pct(b.actual)} (n={b.count})
                  </li>
                ))}
              </ul>
              {model.brierLive != null ? (
                <p>Brier (live p): {model.brierLive.toFixed(3)}</p>
              ) : null}
              {model.brierShadow != null ? (
                <p className="text-white/70">Brier (shadow p): {model.brierShadow.toFixed(3)}</p>
              ) : null}
              <ul className="text-xs text-white/70 space-y-0.5">
                {Object.entries(model.tagHitRates).map(([tag, row]) => (
                  <li key={tag}>
                    {tag}: {row.hits}/{row.total} (
                    {pct(row.hits / Math.max(1, row.total))})
                  </li>
                ))}
              </ul>
            </div>
          )
        ) : null}
      </section>
    </div>
  );
}