import { useMemo, useState } from "react";
import type { DataBundle } from "../hooks/useData";
import type { PickLeg } from "@lib/types";
import { MultiCard } from "../components/MultiCard";
import { NotBuiltSection } from "../components/NotBuiltSection";
import { PersonalMultiBuilder } from "../components/PersonalMultiBuilder";
import { usePersonalMultis } from "../hooks/usePersonalMultis";
import { injuryAlertsForCard } from "@lib/injury-alerts-card";
import { DateSwitcher } from "../components/DateSwitcher";
import { sydneyDateString } from "@lib/official-card-time";
import { sydneyTimeFromIso } from "../utils/format";
import { slateHasFeedOdds, slateOddsAvailabilityNote } from "@lib/slate-odds-ui";
import { formatOddsFreshnessSummary } from "@lib/odds-freshness-ui";
import { picksByIdFromOfficialSnapshots } from "@lib/official-leg-snapshot";
import { formatHomeSettleSummary } from "@lib/home-settle-summary";
import { injuriesForBadges } from "@lib/injury-display";

const ORDER = [
  "mainPlay",
  "doubleUp",
  "booster",
  "q1Multi",
  "crossGameSgm",
  "boostSgm",
  "longshot",
] as const;

interface Props {
  data: DataBundle;
  slateDate: string;
  todayDate: string;
  tomorrowDate: string | null;
  onSlateDateChange: (d: string) => void;
  onLegTap: (leg: PickLeg) => void;
  onCopy: (t: string) => void;
  onOpenSettings: () => void;
  showQ1: boolean;
  showLongshots: boolean;
  myBookie?: string;
}

export function TodayScreen({
  data,
  slateDate,
  todayDate,
  tomorrowDate,
  onSlateDateChange,
  onLegTap,
  onCopy,
  onOpenSettings,
  showQ1,
  showLongshots,
  myBookie,
}: Props) {
  const stale = Object.values(data.meta.sources).some(
    (s) => s === "stale" || s === "paused" || String(s).includes("paused")
  );

  const official = data.officialCard;
  const useOfficial =
    official != null &&
    official.slateDate === (data.meta.slateTipDate ?? official.slateDate);

  const picksById = useOfficial
    ? picksByIdFromOfficialSnapshots(official!.legSnapshots, data.picks)
    : new Map(data.picks.map((p) => [p.id, p]));

  const displayMultis = useOfficial ? official.multis : data.multis;
  const displayNotBuilt = useOfficial ? official.notBuilt : data.multisNotBuilt;
  const officialBookie = official?.bookie ?? data.meta.officialCard?.bookie ?? "";
  const headerOddsPull =
    official?.oddsLastPulled && useOfficial
      ? official.oddsLastPulled
      : data.meta.oddsLastPulled;
  const oddsForCard = headerOddsPull;
  const oddsFreshness = formatOddsFreshnessSummary(
    data.picks,
    data.slate,
    headerOddsPull
  );
  const publishedAt = official?.publishedAt ?? official?.lockedAt;
  const republishedAt = official?.republishedAt;
  const whatChanged = useOfficial
    ? official?.whatChanged
    : data.meta.whatChanged;

  const badgeInjuries = injuriesForBadges(data.injuries);

  const cardPlayerIds = new Set(
    displayMultis.flatMap((m) =>
      m.legs
        .map((id) => picksById.get(id)?.playerId)
        .filter(Boolean) as string[]
    )
  );
  const injuryAlerts = useOfficial
    ? injuryAlertsForCard(official.injuries, data.injuries, cardPlayerIds)
    : [];

  const { multis: personalMultis, addMulti, removeMulti } = usePersonalMultis(data.picks);
  const [builderOpen, setBuilderOpen] = useState(false);
  const slateFairOnly = !slateHasFeedOdds(data.picks);
  const slateOddsNote = slateOddsAvailabilityNote(data.meta, data.picks);

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
  const settleSummary = formatHomeSettleSummary(data.results);

  return (
    <div className="pb-24">
      <DateSwitcher
        todayDate={todayDate}
        tomorrowDate={tomorrowDate}
        selected={slateDate}
        onSelect={onSlateDateChange}
      />
      <header className="mb-4 flex justify-between items-start">
        <div>
          <h1 className="text-xl font-bold">{slateDate === todayDate ? "Home" : "Tomorrow"}</h1>
          {(data.meta.slatePublicationStatus === "draft" ||
            data.meta.slateStatusLabel?.toLowerCase().includes("draft")) && (
            <span className="inline-flex text-[11px] px-2 py-0.5 rounded-full bg-white/[0.08] text-white/55 border border-white/[0.06] mt-1">
              Draft
            </span>
          )}
          {useOfficial && publishedAt && (
            <span className="inline-flex text-[11px] px-2 py-0.5 rounded-full bg-white/[0.08] text-white/70 border border-white/[0.06] mt-1">
              Official · {sydneyTimeFromIso(publishedAt)}
              {republishedAt ? ` · Republished ${sydneyTimeFromIso(republishedAt)}` : ""}
            </span>
          )}
          {data.meta.slateStatusLabel &&
            !data.meta.slateStatusLabel.toLowerCase().includes("draft") && (
            <p className="text-xs text-white/45 mt-1">{data.meta.slateStatusLabel}</p>
          )}
          <p className="text-sm text-white/70">
            {data.slate.length} games · Updated {sydneyTimeFromIso(data.meta.lastUpdated)}
            {stale && <span className="text-accent-warn ml-1" title="Source stale or paused">●</span>}
          </p>
          {oddsFreshness && (
            <p className="text-[11px] text-white/45 mt-0.5">{oddsFreshness}</p>
          )}
          {settleSummary && (
            <p className="text-[11px] text-white/55 mt-0.5 tabular-nums">{settleSummary}</p>
          )}
          {useOfficial && officialBookie && (
            <p className="text-xs text-white/45 mt-1">Card bookie · {officialBookie}</p>
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

      {whatChanged && whatChanged.length > 0 && (
        <div className="text-[11px] text-white/55 mb-3 space-y-0.5">
          <p className="text-white/45 uppercase tracking-wide">What changed</p>
          {whatChanged.slice(0, 4).map((line) => (
            <p key={line}>• {line}</p>
          ))}
        </div>
      )}

      <NotBuiltSection items={notBuilt} />

      {useOfficial && (
        <h2 className="text-sm font-semibold text-white/80 mb-2">
          Official card
          {publishedAt ? (
            <span className="block text-xs font-normal text-white/55 mt-0.5">
              Published {sydneyTimeFromIso(publishedAt)}
            </span>
          ) : null}
        </h2>
      )}

      {multis.map((m) => {
        const cardFairOnly =
          m.type === "q1Multi" || (slateFairOnly && m.type !== "q1Multi");
        return (
          <MultiCard
            key={`${m.type}-${m.variant ?? ""}-${m.legs.join()}`}
            multi={m}
            picksById={picksById}
            injuries={badgeInjuries}
            slate={data.slate}
            compact
            preferredBookie={myBookie}
            lockedBookie={useOfficial && !cardFairOnly ? m.bestBookie : undefined}
            publishedAt={useOfficial ? publishedAt : undefined}
            republishedAt={useOfficial ? republishedAt : undefined}
            slateDate={data.meta.slateTipDate ?? slateDate}
            officialDisplayOnly={useOfficial && !cardFairOnly}
            hideBookieSelect={m.type === "q1Multi" || (slateFairOnly && !useOfficial)}
            oddsLastPulled={oddsForCard}
            fairOnly={cardFairOnly}
            oddsNote={m.type === "q1Multi" ? undefined : slateOddsNote}
            discordCopy={useOfficial}
            liveCatalog={data.picks}
            onLegTap={onLegTap}
            onCopy={onCopy}
          />
        );
      })}

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
              injuries={badgeInjuries}
              slate={data.slate}
              preferredBookie={myBookie}
              oddsLastPulled={data.meta.oddsLastPulled}
              fairOnly={slateFairOnly || multi.type === "q1Multi"}
              oddsNote={slateOddsNote}
              hideBookieSelect={slateFairOnly || multi.type === "q1Multi"}
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