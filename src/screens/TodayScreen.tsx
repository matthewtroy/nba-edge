import type { DataBundle } from "../hooks/useData";
import type { PickLeg } from "@lib/types";
import { MultiCard } from "../components/MultiCard";
import { NotBuiltSection } from "../components/NotBuiltSection";
import { sydneyTimeFromIso } from "../utils/format";

const ORDER = [
  "mainPlay",
  "booster",
  "q1Multi",
  "crossGameSgm",
  "boostSgm",
  "longshot",
] as const;

interface Props {
  data: DataBundle;
  onLegTap: (leg: PickLeg) => void;
  onCopy: (t: string) => void;
  onOpenSettings: () => void;
  showQ1: boolean;
  showLongshots: boolean;
}

export function TodayScreen({
  data,
  onLegTap,
  onCopy,
  onOpenSettings,
  showQ1,
  showLongshots,
}: Props) {
  const picksById = new Map(data.picks.map((p) => [p.id, p]));
  const stale = Object.values(data.meta.sources).some(
    (s) => s === "stale" || s === "paused" || String(s).includes("paused")
  );

  const builtTypes = new Set(data.multis.map((m) => (m.variant ? `${m.type}:${m.variant}` : m.type)));
  const notBuilt = data.multisNotBuilt.filter((n) => {
    const key = n.variant ? `${n.type}:${n.variant}` : n.type;
    return !builtTypes.has(key);
  });

  const multis = [...data.multis].sort(
    (a, b) => ORDER.indexOf(a.type) - ORDER.indexOf(b.type)
  ).filter((m) => {
    if (m.type === "longshot" && !showLongshots) return false;
    if (m.type === "q1Multi" && !showQ1) return false;
    return true;
  });

  const ageH =
    (Date.now() - new Date(data.meta.lastUpdated).getTime()) / (1000 * 60 * 60);

  return (
    <div className="pb-24">
      <header className="mb-4 flex justify-between items-start">
        <div>
          <h1 className="text-xl font-bold">Today</h1>
          <p className="text-sm text-white/70">
            {data.slate.length} games · Updated {sydneyTimeFromIso(data.meta.lastUpdated)}
            {data.meta.oddsLastPulled && (
              <> · Odds from {sydneyTimeFromIso(data.meta.oddsLastPulled)}</>
            )}
            {stale && <span className="text-accent-warn ml-1" title="Source stale or paused">●</span>}
          </p>
        </div>
        <button type="button" onClick={onOpenSettings} className="p-2 text-white/70" aria-label="Settings">
          ⚙
        </button>
      </header>

      {ageH > 2 && (
        <p className="text-sm bg-accent-warn/20 text-accent-warn px-3 py-2 rounded-lg mb-3">
          Data may be out of date
        </p>
      )}

      {data.slate.length === 0 && (
        <p className="text-white/70">No NBA today: check back for the next slate.</p>
      )}

      {(data.meta.whatChanged ?? []).length > 0 && (
        <section className="mb-4">
          <h2 className="text-sm font-semibold text-white/80 mb-2">What changed</h2>
          <ul className="text-sm text-white/70 space-y-1">
            {(data.meta.whatChanged ?? []).slice(0, 3).map((line) => (
              <li key={line}>• {line}</li>
            ))}
          </ul>
        </section>
      )}

      <NotBuiltSection items={notBuilt} />

      {multis.map((m) => (
        <MultiCard
          key={`${m.type}-${m.variant ?? ""}-${m.legs.join()}`}
          multi={m}
          picksById={picksById}
          onLegTap={onLegTap}
          onCopy={onCopy}
        />
      ))}
    </div>
  );
}