import { useMemo, type ReactNode } from "react";
import type { DataBundle } from "../hooks/useData";
import type { LiveTrackingState } from "../hooks/useLiveTracking";
import type { PickLeg, Market } from "@lib/types";
import { PickLegRow } from "../components/PickLegRow";
import { DateSwitcher } from "../components/DateSwitcher";
import {
  usePicksFilters,
  picksFilterSummaryLabels,
  type PicksSortKey,
} from "../hooks/usePicksFilters";
import { filterAndSortPicks, marketsOnSlate } from "../lib/picks-list";
import { ui } from "../lib/card-type-scale";
import { formatOddsFreshnessSummary } from "@lib/odds-freshness-ui";
import { injuriesForBadges } from "@lib/injury-display";

interface Props {
  data: DataBundle;
  slateDate: string;
  todayDate: string;
  tomorrowDate: string | null;
  onSlateDateChange: (d: string) => void;
  myBookie?: string;
  onLegTap: (leg: PickLeg) => void;
  liveTracking: LiveTrackingState;
}

const MARKET_LABEL: Record<string, string> = {
  pts: "Pts",
  reb: "Reb",
  ast: "Ast",
  "3pm": "3PM",
  q1pts: "Q1 pts",
  q1reb: "Q1 reb",
  q1ast: "Q1 ast",
  dd: "DD",
  td: "TD",
};

function FilterPill({
  label,
  value,
  testId,
  onChange,
  children,
}: {
  label: string;
  value: string;
  testId?: string;
  onChange: (v: string) => void;
  children: ReactNode;
}) {
  return (
    <label
      className={`${ui.chip} inline-flex items-center gap-1 pl-2.5 pr-1 py-1 shrink-0`}
    >
      <span className="text-white/45 text-[10px]">{label}</span>
      <select
        data-testid={testId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-transparent text-[10px] text-white/80 border-0 outline-none max-w-[5.5rem] truncate"
      >
        {children}
      </select>
    </label>
  );
}

export function PicksScreen({
  data,
  slateDate,
  todayDate,
  tomorrowDate,
  onSlateDateChange,
  myBookie = "bet365",
  onLegTap,
  liveTracking,
}: Props) {
  const badgeInjuries = injuriesForBadges(data.injuries);
  const [filters, patch, toggleSortDir] = usePicksFilters();
  const markets = useMemo(() => marketsOnSlate(data.picks), [data.picks]);

  const legs = useMemo(
    () =>
      filterAndSortPicks({
        picks: data.picks,
        slate: data.slate,
        multis: data.multis,
        myBookie,
        filters,
      }),
    [data.picks, data.slate, data.multis, myBookie, filters]
  );

  const { show, sort } = picksFilterSummaryLabels(filters);
  const oddsSummary = formatOddsFreshnessSummary(
    data.picks,
    data.slate,
    data.meta.oddsLastPulled
  );

  return (
    <div className="pb-24">
      <DateSwitcher
        todayDate={todayDate}
        tomorrowDate={tomorrowDate}
        selected={slateDate}
        onSelect={onSlateDateChange}
      />
      <header className="mb-3">
        <h1 className="text-xl font-bold text-white theme-adaptive-title">Picks</h1>
        {oddsSummary && (
          <p className="text-[11px] text-white/45 mt-1">{oddsSummary}</p>
        )}
      </header>

      <div
        data-testid="picks-filters"
        className="flex flex-nowrap gap-1.5 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-hide"
      >
        <FilterPill
          label="Multi"
          testId="picks-filter-multi"
          value={filters.multi}
          onChange={(v) =>
            patch({ multi: v === "inMulti" ? "inMulti" : "all" })
          }
        >
          <option value="all">All legs</option>
          <option value="inMulti">In multis</option>
        </FilterPill>
        <FilterPill
          label="Market"
          testId="picks-filter-market"
          value={filters.market}
          onChange={(v) => patch({ market: v as "all" | Market })}
        >
          <option value="all">All</option>
          {markets.map((m) => (
            <option key={m} value={m}>
              {MARKET_LABEL[m] ?? m}
            </option>
          ))}
        </FilterPill>
        <FilterPill
          label="Show"
          testId="picks-filter-show"
          value={filters.show}
          onChange={(v) =>
            patch({
              show:
                v === "high" || v === "all"
                  ? v
                  : "value",
            })
          }
        >
          <option value="value">Value</option>
          <option value="high">High</option>
          <option value="all">All</option>
        </FilterPill>
        <FilterPill
          label="Sort"
          testId="picks-filter-sort"
          value={filters.sort}
          onChange={(v) => patch({ sort: v as PicksSortKey })}
        >
          <option value="edge">Edge</option>
          <option value="prob">Prob</option>
          <option value="price">Price</option>
          <option value="l5">L5</option>
          <option value="tip">Tip</option>
        </FilterPill>
        <button
          type="button"
          data-testid="picks-sort-dir"
          onClick={toggleSortDir}
          className={`${ui.chip} px-2.5 py-1 text-[10px] text-white/70 shrink-0`}
          aria-label="Toggle sort direction"
        >
          {filters.sortAsc ? "↑" : "↓"}
        </button>
      </div>

      <p className="text-[11px] text-white/45 mb-2">
        {legs.length} picks · {show} · {sort}
      </p>

      {legs.length === 0 ? (
        <div className={`${ui.card} text-center py-8`}>
          <p className="text-sm text-white/55">No picks match these filters</p>
          <p className="text-[11px] text-white/40 mt-2">
            Try Show All, another market, or All legs
          </p>
        </div>
      ) : (
        <section className={`${ui.card} px-2 py-0`}>
          {legs.map((leg) => (
            <PickLegRow
              key={leg.id}
              leg={leg}
              injuries={badgeInjuries}
              slate={data.slate}
              myBookie={myBookie}
              onTap={onLegTap}
              liveView={liveTracking.legViews.get(leg.id)}
            />
          ))}
        </section>
      )}
    </div>
  );
}