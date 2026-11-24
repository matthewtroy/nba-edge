import { useMemo, useState } from "react";
import type { DataBundle } from "../hooks/useData";
import type { PickLeg } from "@lib/types";
import { LegRow } from "../components/LegRow";

interface Props {
  data: DataBundle;
  onLegTap: (leg: PickLeg) => void;
}

export function PicksScreen({ data, onLegTap }: Props) {
  const [showAll, setShowAll] = useState(false);
  const [filter, setFilter] = useState<"all" | "value" | "high" | string>("high");

  const hasValueOdds = data.picks.some((l) => l.tags.includes("Value"));

  const legs = useMemo(() => {
    let list = [...data.picks];
    if (!showAll) {
      list = list
        .filter((l) => l.tags.includes("High probability"))
        .sort((a, b) => b.probability - a.probability)
        .slice(0, 15);
    }
    if (filter === "value") list = list.filter((l) => l.tags.includes("Value"));
    if (filter === "high") {
      list = list.filter((l) => l.tags.includes("High probability"));
      if (!showAll) list = list.slice(0, 15);
    }
    if (filter.startsWith("game:")) {
      const gid = filter.slice(5);
      list = data.picks.filter((l) => l.gameId === gid);
    }
    if (filter === "all" && showAll) {
      list = [...data.picks].sort((a, b) => b.probability - a.probability);
    }
    return list.sort((a, b) => b.probability - a.probability);
  }, [data.picks, showAll, filter]);

  return (
    <div className="pb-24">
      <h1 className="text-xl font-bold mb-3">Picks</h1>

      {!hasValueOdds && (
        <p className="text-sm text-accent-warn mb-3 px-1">
          No bookie prices yet: type a bet365 price on any leg to check it
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
            {f === "high" ? "High probability" : f === "value" ? "Value" : "All"}
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
      <div className="bg-card rounded-xl px-2">
        {legs.map((leg) => (
          <LegRow key={leg.id} leg={leg} onTap={onLegTap} />
        ))}
      </div>
    </div>
  );
}