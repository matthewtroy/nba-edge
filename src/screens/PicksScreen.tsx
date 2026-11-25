import { useMemo, useState } from "react";
import type { DataBundle } from "../hooks/useData";
import type { PickLeg } from "@lib/types";
import { LegRow } from "../components/LegRow";
import { hasValueAtBookie } from "@lib/value-at-bookie";

interface Props {
  data: DataBundle;
  myBookie?: string;
  onLegTap: (leg: PickLeg) => void;
}

export function PicksScreen({ data, myBookie = "bet365", onLegTap }: Props) {
  const [showAll, setShowAll] = useState(false);
  const [filter, setFilter] = useState<"all" | "value" | "high" | string>("value");

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
        .sort((a, b) => b.probability - a.probability)
        .slice(0, 15);
    }
    if (filter.startsWith("game:")) {
      const gid = filter.slice(5);
      list = data.picks.filter((l) => l.gameId === gid);
    }
    if (filter === "all" && showAll) {
      list = [...data.picks].sort((a, b) => b.probability - a.probability);
    }
    return list.sort((a, b) => b.probability - a.probability);
  }, [data.picks, showAll, filter, myBookie]);

  return (
    <div className="pb-24">
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
      <div className="bg-card rounded-xl px-2">
        {legs.map((leg) => (
          <LegRow key={leg.id} leg={leg} myBookie={myBookie} onTap={onLegTap} />
        ))}
      </div>
    </div>
  );
}