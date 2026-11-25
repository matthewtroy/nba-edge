import { useMemo, useState } from "react";
import type { DataBundle } from "../hooks/useData";
import type { PickLeg } from "@lib/types";
import { MultiCard } from "../components/MultiCard";
import { NotBuiltSection } from "../components/NotBuiltSection";
import { PersonalMultiBuilder } from "../components/PersonalMultiBuilder";
import { usePersonalMultis } from "../hooks/usePersonalMultis";
import { injuryAlertsSinceLock } from "@lib/injury-alerts";
import { sydneyDateString } from "@lib/official-card-time";
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
  myBookie?: string;
}

export function TodayScreen({
  data,
  onLegTap,
  onCopy,
  onOpenSettings,
  showQ1,
  showLongshots,
  myBookie,
}: Props) {
  const picksById = new Map(data.picks.map((p) => [p.id, p]));
  const stale = Object.values(data.meta.sources).some(
    (s) => s === "stale" || s === "paused" || String(s).includes("paused")
  );

  const todaySydney = sydneyDateString(new Date());
  const official = data.officialCard;
  const useOfficial =
    official != null &&
    (official.slateDate === todaySydney ||
      data.meta.officialCard?.slateDate === official.slateDate);

  const displayMultis = useOfficial ? official.multis : data.multis;
  const displayNotBuilt = useOfficial ? official.notBuilt : data.multisNotBuilt;
  const displayWhatChanged = useOfficial
    ? official.whatChanged
    : data.meta.whatChanged;
  const officialBookie = official?.bookie ?? data.meta.officialCard?.bookie;
  const oddsForCard = useOfficial
    ? official.oddsLastPulled ?? data.meta.oddsLastPulled
    : data.meta.oddsLastPulled;

  const injuryAlerts = useOfficial
    ? injuryAlertsSinceLock(official.injuries, data.injuries)
  : [];

  const { multis: personalMultis, addMulti, removeMulti } = usePersonalMultis(data.picks);
  const [builderOpen, setBuilderOpen] = useState(false);

  const builtTypes = new Set(displayMultis.map((m) => (m.variant ? `${m.type}:${m.variant}` : m.type)));
  const notBuilt = displayNotBuilt.filter((n) => {
    const key = n.variant ? `${n.type}:${n.variant}` : n.type;
    return !builtTypes.has(key);
  });

  const multis = useMemo(
    () =>
      [...displayMultis]
        .sort((a, b) => ORDER.indexOf(a.type) - ORDER.indexOf(b.type))
        .filter((m) => {
          if (m.type === "longshot" && !showLongshots) return false;
          if (m.type === "q1Multi" && !showQ1) return false;
          return true;
        }),
    [displayMultis, showLongshots, showQ1]
  );

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
          {useOfficial && official && (
            <p className="text-xs text-accent-high mt-1">
              Official card locked {sydneyTimeFromIso(official.lockedAt)}
              {officialBookie ? ` · ${officialBookie}` : ""}
            </p>
          )}
        </div>
        <button type="button" onClick={onOpenSettings} className="p-2 text-white/70" aria-label="Settings">
          ⚙
        </button>
      </header>

      {injuryAlerts.length > 0 && (
        <div className="text-sm bg-accent-warn/20 text-accent-warn px-3 py-2 rounded-lg mb-3 space-y-1">
          <p className="font-medium">Injury alerts since lock</p>
          {injuryAlerts.map((a) => (
            <p key={a}>• {a}</p>
          ))}
          <p className="text-xs text-white/70">Use Swap on Questionable legs — local only.</p>
        </div>
      )}

      {ageH > 2 && (
        <p className="text-sm bg-accent-warn/20 text-accent-warn px-3 py-2 rounded-lg mb-3">
          Data may be out of date
        </p>
      )}

      {data.slate.length === 0 && (
        <p className="text-white/70">No NBA today: check back for the next slate.</p>
      )}

      {data.meta.smallSlate && (
        <p className="text-sm text-accent-warn mb-3">Small slate</p>
      )}

      <section className="mb-4">
        <h2 className="text-sm font-semibold text-white/80 mb-2">What changed</h2>
        {(displayWhatChanged ?? []).length > 0 ? (
          <ul className="text-sm text-white/70 space-y-1">
            {(displayWhatChanged ?? []).slice(0, 3).map((line) => (
              <li key={line}>• {line}</li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-white/50">(none)</p>
        )}
      </section>

      <NotBuiltSection items={notBuilt} />

      {useOfficial && (
        <h2 className="text-sm font-semibold text-white/80 mb-2">Official card</h2>
      )}

      {multis.map((m) => (
        <MultiCard
          key={`${m.type}-${m.variant ?? ""}-${m.legs.join()}`}
          multi={m}
          picksById={picksById}
          injuries={data.injuries}
          slate={data.slate}
          preferredBookie={myBookie}
          lockedBookie={useOfficial ? officialBookie : undefined}
          oddsLastPulled={oddsForCard}
          discordCopy={useOfficial}
          onLegTap={onLegTap}
          onCopy={onCopy}
        />
      ))}

      <section className="mt-6">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold text-white/80">Personal multis</h2>
          <button
            type="button"
            className="text-xs px-3 py-1.5 rounded-lg border border-white/20"
            onClick={() => setBuilderOpen(true)}
          >
            Generate new multi
          </button>
        </div>
        {personalMultis.length === 0 ? (
          <p className="text-sm text-white/50">None saved on this device.</p>
        ) : (
          personalMultis.map(({ multi, draftId }) => (
            <MultiCard
              key={draftId}
              multi={multi}
              picksById={picksById}
              injuries={data.injuries}
              slate={data.slate}
              preferredBookie={myBookie}
              oddsLastPulled={data.meta.oddsLastPulled}
              discordCopy={false}
              onRemove={() => removeMulti(draftId)}
              onLegTap={onLegTap}
              onCopy={onCopy}
            />
          ))
        )}
      </section>

      <PersonalMultiBuilder
        open={builderOpen}
        picks={data.picks}
        onClose={() => setBuilderOpen(false)}
        onSave={addMulti}
      />
    </div>
  );
}