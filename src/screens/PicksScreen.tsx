import { useEffect, useMemo, useState } from "react";
import type { DataBundle } from "../hooks/useData";
import type { PickLeg } from "@lib/types";
import { LegRow } from "../components/LegRow";
import { DateSwitcher } from "../components/DateSwitcher";
import { hasValueAtBookie } from "@lib/value-at-bookie";
import { legPriceAtBookie } from "@lib/single-bookie";

type SortKey = "player" | "market" | "prob" | "fair" | "take" | "edge" | "book";

interface Props {
  data: DataBundle;
  slateDate: string;
  todayDate: string;
  tomorrowDate: string | null;
  onSlateDateChange: (d: string) => void;
  myBookie?: string;
  onLegTap: (leg: PickLeg) => void;
}

const SORT_KEY = "picks-sort-v1";

function edgeAtBookie(leg: PickLeg, bookie: string): number {
  const p = legPriceAtBookie(leg, bookie);
  if (p == null || p <= 1) return -999;
  return p / leg.fairPrice - 1;
}

export function PicksScreen({
  data,
  slateDate,
  todayDate,
  tomorrowDate,
  onSlateDateChange,
  myBookie = "bet365",
  onLegTap,
}: Props) {
  const [showAll, setShowAll] = useState(false);
  const [filter, setFilter] = useState<"all" | "value" | "high" | string>("value");
  const [sortKey, setSortKey] = useState<SortKey>("edge");
  const [sortAsc, setSortAsc] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SORT_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { key: SortKey; asc: boolean };
      setSortKey(parsed.key);
      setSortAsc(parsed.asc);
    } catch {
      /* ignore */
    }
  }, []);

  const toggleSort = (key: SortKey) => {
    const asc = sortKey === key ? !sortAsc : key === "player" || key === "market";
    setSortKey(key);
    setSortAsc(asc);
    localStorage.setItem(SORT_KEY, JSON.stringify({ key, asc }));
  };

  const arrow = (key: SortKey) =>
    sortKey === key ? (sortAsc ? " ↑" : " ↓") : "";

  const valueAtBookie = useMemo(
    () => data.picks.filter((l) => hasValueAtBookie(l, myBookie)),
    [data.picks, myBookie]
  );
  const hasValueOdds = valueAtBookie.length > 0;

  const legs = useMemo(() => {
    let list = [...data.picks];
    if (filter === "value") {
      list = list.filter((l) => hasValueAtBookie(l, myBookie));
    } else if (filter === "high") {
      list = list.filter((l) => l.tags.includes("High probability"));
      if (!showAll) list = list.slice(0, 15);
    } else if (!showAll) {
      list = list
        .filter(
          (l) =>
            l.tags.includes("High probability") || hasValueAtBookie(l, myBookie)
        )
        .slice(0, 15);
    }
    if (filter.startsWith("game:")) {
      const gid = filter.slice(5);
      list = data.picks.filter((l) => l.gameId === gid);
    }
    const dir = sortAsc ? 1 : -1;
    list.sort((a, b) => {
      switch (sortKey) {
        case "player":
          return dir * a.playerName.localeCompare(b.playerName);
        case "market":
          return dir * `${a.market}${a.line}`.localeCompare(`${b.market}${b.line}`);
        case "prob":
          return dir * (a.probability - b.probability);
        case "fair":
          return dir * (a.fairPrice - b.fairPrice);
        case "take":
          return dir * (a.takeAt - b.takeAt);
        case "book": {
          const pa = legPriceAtBookie(a, myBookie) ?? 0;
          const pb = legPriceAtBookie(b, myBookie) ?? 0;
          return dir * (pa - pb);
        }
        case "edge":
        default:
          return dir * (edgeAtBookie(a, myBookie) - edgeAtBookie(b, myBookie));
      }
    });
    return list;
  }, [data.picks, showAll, filter, myBookie, sortKey, sortAsc]);

  const headers: { key: SortKey; label: string }[] = [
    { key: "player", label: "Player" },
    { key: "market", label: "Line" },
    { key: "prob", label: "P" },
    { key: "fair", label: "Fair" },
    { key: "take", label: "Take" },
    { key: "edge", label: "Edge" },
    { key: "book", label: myBookie },
  ];

  return (
    <div className="pb-24">
      <DateSwitcher
        todayDate={todayDate}
        tomorrowDate={tomorrowDate}
        selected={slateDate}
        onSelect={onSlateDateChange}
      />
      <h1 className="text-xl font-bold mb-3">Picks</h1>

      {!hasValueOdds && (
        <p className="text-sm text-accent-warn mb-3 px-1">
          No {myBookie} value yet: type a price on any leg to check it
        </p>
      )}

      <div className="flex flex-wrap gap-2 mb-3">
        {(["high", "value", "all"] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f === "all" ? "all" : f)}
            className={`text-xs px-3 py-1 rounded-full border ${
              filter === f ? "border-accent-high text-accent-high" : "border-white/20"
            }`}
          >
            {f === "high"
              ? "High probability"
              : f === "value"
                ? `Value @ ${myBookie}`
                : "All"}
          </button>
        ))}
        {data.slate.map((g) => (
          <button
            key={g.id}
            type="button"
            onClick={() => setFilter(`game:${g.id}`)}
            className={`text-xs px-3 py-1 rounded-full border ${
              filter === `game:${g.id}` ? "border-accent-high" : "border-white/20"
            }`}
          >
            {g.awayTeam.split(" ").pop()} @ {g.homeTeam.split(" ").pop()}
          </button>
        ))}
      </div>
      <button
        type="button"
        className="text-sm text-accent-high mb-3"
        onClick={() => setShowAll((s) => !s)}
      >
        {showAll ? "Show high-prob top 15" : "Show all"}
      </button>
      <div className="flex flex-wrap gap-1 mb-2 px-1">
        {headers.map((h) => (
          <button
            key={h.key}
            type="button"
            className="text-[10px] px-2 py-1 rounded border border-white/15 text-white/70"
            onClick={() => toggleSort(h.key)}
          >
            {h.label}
            {arrow(h.key)}
          </button>
        ))}
      </div>
      <div className="bg-card rounded-xl px-2">
        {legs.map((leg) => (
          <LegRow key={leg.id} leg={leg} slate={data.slate} myBookie={myBookie} onTap={onLegTap} />
        ))}
      </div>
    </div>
  );
}