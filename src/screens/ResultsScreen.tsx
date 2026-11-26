import { useState } from "react";
import type { DataBundle } from "../hooks/useData";
import type { OfficialBetRow } from "@lib/official-bet-settle";
import type { ResultsSlice } from "@lib/results-types";
import {
  OTHER_BET_ROWS,
  betLegLines,
  summarizeBets,
  summarizeGamesSgms,
  summarizeGamesSgmTotal,
  type BetTypeSummary,
} from "@lib/results-view";

type DisplayBet = Pick<
  OfficialBetRow,
  "slateDate" | "bookie" | "publishedCombinedPrice" | "stakeUnits" | "result" | "profitUnits" | "legIds" | "legLabels"
> & { game?: string; settledPrice?: number };

interface TableRow {
  key: string;
  label: string;
  won: number;
  lost: number;
  void: number;
  staked: number;
  profit: number;
  roi: number | null;
  bets: DisplayBet[];
  children?: TableRow[];
}

interface Props {
  data: DataBundle;
}

function pct(n: number | null): string {
  return n != null ? `${(n * 100).toFixed(1)}%` : "—";
}

function units(n: number, signed = false): string {
  const s = `${Math.abs(n) < 0.005 ? "0.00" : Math.abs(n).toFixed(2)}u`;
  if (!signed) return s;
  return n > 0.004 ? `+${s}` : n < -0.004 ? `−${s}` : s;
}

function wl(row: { won: number; lost: number; void: number }): string {
  const base = `${row.won}–${row.lost}`;
  return row.void ? `${base}–${row.void}` : base;
}

function profitClass(n: number): string {
  if (n > 0.004) return "text-price-green";
  if (n < -0.004) return "text-red-400";
  return "text-white/70";
}

function shortDate(ymd: string): string {
  const [, m, d] = ymd.split("-").map(Number);
  const month = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][
    (m ?? 1) - 1
  ];
  return `${d} ${month}`;
}

const RESULT_CHIP: Record<string, string> = {
  won: "bg-emerald-500/15 text-emerald-300",
  lost: "bg-red-500/15 text-red-300",
  void: "bg-white/10 text-white/60",
  pending: "bg-white/10 text-white/60",
};

function Stat({ label, value, className = "" }: { label: string; value: string; className?: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] uppercase tracking-wide text-white/45">{label}</p>
      <p className={`text-sm font-semibold tabular-nums truncate ${className}`}>{value}</p>
    </div>
  );
}

function BetRow({ bet, results }: { bet: DisplayBet; results: ResultsSlice }) {
  const [open, setOpen] = useState(false);
  const legs = betLegLines(bet, results);
  const price = bet.publishedCombinedPrice;
  return (
    <li className="border-t border-white/5 first:border-t-0">
      <button
        type="button"
        onClick={() => legs.length && setOpen(!open)}
        className="w-full grid grid-cols-[3.25rem_1fr_auto_auto] items-center gap-2 py-2 text-left text-xs"
      >
        <span className="text-white/60 tabular-nums">{shortDate(bet.slateDate)}</span>
        <span className="truncate text-white/80">
          {bet.game ? <span className="text-white/90">{bet.game} · </span> : null}
          {bet.bookie ?? ""}
          {price != null && price > 1 ? (
            <span className="text-white/50 tabular-nums">
              {" "}· ${price.toFixed(2)}
              {bet.settledPrice != null ? ` → $${bet.settledPrice.toFixed(2)}` : ""}
            </span>
          ) : null}
          {bet.stakeUnits > 0 ? (
            <span className="text-white/50 tabular-nums"> · {units(bet.stakeUnits)}</span>
          ) : null}
        </span>
        <span
          className={`px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase ${RESULT_CHIP[bet.result] ?? RESULT_CHIP.pending}`}
        >
          {bet.result}
        </span>
        <span className={`w-14 text-right tabular-nums ${profitClass(bet.profitUnits ?? 0)}`}>
          {bet.profitUnits != null ? units(bet.profitUnits, true) : "—"}
        </span>
      </button>
      {open ? (
        <ul className="pb-2 pl-[3.75rem] space-y-0.5 text-[11px] text-white/60">
          {legs.map((leg, i) => (
            <li key={`${leg.text}-${i}`} className="flex justify-between gap-2">
              <span className="truncate">{leg.text}</span>
              {leg.result ? (
                <span className={leg.result === "won" ? "text-emerald-300" : leg.result === "lost" ? "text-red-300" : ""}>
                  {leg.result}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  );
}

function BetList({ bets, results }: { bets: DisplayBet[]; results: ResultsSlice }) {
  return (
    <ul className="mt-2">
      {bets.map((bet, i) => (
        <BetRow key={`${bet.slateDate}-${bet.game ?? ""}-${bet.bookie ?? ""}-${i}`} bet={bet} results={results} />
      ))}
    </ul>
  );
}

function MainPlaySection({ summary, results }: { summary: BetTypeSummary; results: ResultsSlice }) {
  const [open, setOpen] = useState(false);
  return (
    <section className="bg-card rounded-xl p-4" data-results="main-play">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-semibold">Main Play</h2>
        <p className="text-2xl font-bold tabular-nums">{wl(summary)}</p>
      </div>
      <div className="mt-3 grid grid-cols-5 gap-2">
        <Stat label="Hit" value={pct(summary.hitRate)} />
        <Stat label="Avg odds" value={summary.avgOdds != null ? `$${summary.avgOdds.toFixed(2)}` : "—"} />
        <Stat label="Staked" value={units(summary.staked)} />
        <Stat label="Profit" value={units(summary.profit, true)} className={profitClass(summary.profit)} />
        <Stat label="ROI" value={pct(summary.roi)} className={profitClass(summary.profit)} />
      </div>
      {summary.bets.length ? (
        <>
          <button
            type="button"
            onClick={() => setOpen(!open)}
            className="mt-3 w-full flex justify-between text-xs text-white/60"
          >
            <span>{summary.bets.length} bets</span>
            <span>{open ? "▾" : "▸"}</span>
          </button>
          {open ? <BetList bets={summary.bets} results={results} /> : null}
        </>
      ) : null}
    </section>
  );
}

function TableRowItem({
  row,
  results,
  depth = 0,
}: {
  row: TableRow;
  results: ResultsSlice;
  depth?: number;
}) {
  const [open, setOpen] = useState(false);
  const expandable = row.children?.length ? true : row.bets.length > 0;
  return (
    <li className="border-b border-white/5 last:border-b-0" data-results-row={row.key}>
      <button
        type="button"
        onClick={() => expandable && setOpen(!open)}
        className="w-full grid grid-cols-[1fr_3rem_3.5rem_4rem_3.5rem] gap-x-2 py-2 text-sm text-left tabular-nums"
      >
        <span className="truncate" style={depth ? { paddingLeft: `${depth * 0.75}rem` } : undefined}>
          <span className="text-white/40 mr-1">{expandable ? (open ? "▾" : "▸") : " "}</span>
          {row.label}
        </span>
        <span className="text-right">{wl(row)}</span>
        <span className="text-right text-white/70">{units(row.staked)}</span>
        <span className={`text-right ${profitClass(row.profit)}`}>{units(row.profit, true)}</span>
        <span className={`text-right ${profitClass(row.profit)}`}>{pct(row.roi)}</span>
      </button>
      {open && row.children?.length ? (
        <ul className="border-t border-white/5">
          {row.children.map((child) => (
            <TableRowItem key={child.key} row={child} results={results} depth={depth + 1} />
          ))}
        </ul>
      ) : null}
      {open && !row.children?.length ? <BetList bets={row.bets} results={results} /> : null}
    </li>
  );
}

function BetsTable({
  title,
  testId,
  firstColumn,
  rows,
  results,
}: {
  title: string;
  testId: string;
  firstColumn: string;
  rows: TableRow[];
  results: ResultsSlice;
}) {
  return (
    <section className="bg-card rounded-xl p-4" data-results={testId}>
      <h2 className="text-sm font-semibold mb-2">{title}</h2>
      <div className="grid grid-cols-[1fr_3rem_3.5rem_4rem_3.5rem] gap-x-2 text-[10px] uppercase tracking-wide text-white/45 pb-1 border-b border-white/10">
        <span>{firstColumn}</span>
        <span className="text-right">W–L</span>
        <span className="text-right">Staked</span>
        <span className="text-right">Profit</span>
        <span className="text-right">ROI</span>
      </div>
      <ul>
        {rows.map((row) => (
          <TableRowItem key={row.key} row={row} results={results} />
        ))}
      </ul>
    </section>
  );
}

function ValueLegsSection({ valueLegs }: { valueLegs: ResultsSlice["valueLegs"] }) {
  const rec = valueLegs.record;
  return (
    <section className="bg-card rounded-xl p-4" data-results="value-legs">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-semibold">Value legs</h2>
        <p className="text-lg font-semibold tabular-nums">{wl(rec)}</p>
      </div>
      <div className="mt-3 grid grid-cols-5 gap-2">
        <Stat label="Hit" value={pct(rec.hitRate)} />
        <Stat label="Avg odds" value={rec.avgPrice != null ? `$${rec.avgPrice.toFixed(2)}` : "—"} />
        <Stat label="Staked" value={units(rec.staked)} />
        <Stat label="Profit" value={units(rec.profit, true)} className={profitClass(rec.profit)} />
        <Stat label="ROI" value={pct(rec.roi)} className={profitClass(rec.profit)} />
      </div>
      {Object.keys(valueLegs.byMarket).length ? (
        <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs text-white/65 tabular-nums">
          {Object.entries(valueLegs.byMarket).map(([m, row]) => (
            <li key={m} className="flex justify-between">
              <span>{m}</span>
              <span>
                {wl(row)} · {pct(row.roi)}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

export function ResultsScreen({ data }: Props) {
  const results = data.results;

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

  const bets = results.official.bets;
  const mainPlay = summarizeBets(bets, "mainPlay", "Main Play");
  const others: TableRow[] = OTHER_BET_ROWS.map((r) => {
    const sum = summarizeBets(bets, r.kind, r.label);
    return { ...sum, key: r.kind };
  });
  const gamesSgmBets = results.gamesSgm?.bets ?? [];
  if (gamesSgmBets.length) {
    const total = summarizeGamesSgmTotal(gamesSgmBets);
    others.push({
      ...total,
      key: "gamesSgm",
      label: "Games tab SGMs",
      children: summarizeGamesSgms(gamesSgmBets)
        .filter((f) => f.bets.length)
        .map((f) => ({ ...f, key: `gamesSgm-${f.filter}`, label: `$${f.filter}` })),
    });
  }

  return (
    <div className="pb-24 space-y-4">
      <h1 className="text-xl font-bold">Results</h1>
      <MainPlaySection summary={mainPlay} results={results} />
      <BetsTable title="Other bets" testId="other-bets" firstColumn="Bet" rows={others} results={results} />
      <ValueLegsSection valueLegs={results.valueLegs} />
    </div>
  );
}
