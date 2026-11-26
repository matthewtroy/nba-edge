import { useMemo, useState } from "react";
import type { DataBundle } from "../hooks/useData";
import type { LiveTrackingState } from "../hooks/useLiveTracking";
import { liveMultiKey } from "@lib/live-tracking";
import type { MultiType, PickLeg } from "@lib/types";
import { MultiCard } from "../components/MultiCard";
import { PersonalMultiBuilder } from "../components/PersonalMultiBuilder";
import { usePersonalMultis } from "../hooks/usePersonalMultis";
import { DateSwitcher } from "../components/DateSwitcher";
import { TomorrowSlateTease } from "../components/TomorrowSlateTease";
import { slateHasFeedOdds, slateOddsAvailabilityNote } from "@lib/slate-odds-ui";
import { picksByIdFromOfficialSnapshots } from "@lib/official-leg-snapshot";
import { injuriesForBadges } from "@lib/injury-display";
import { shouldShowSlateBuildingScreen } from "@lib/slate-building-mode";

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
  viewerTodayYmd: string;
  noGamesToday?: boolean;
  viewerTimeZone?: string;
  onIndexRefreshed?: (index: import("@lib/data-index").DataIndexFile) => void;
  onSlateDateChange: (d: string) => void;
  onLegTap: (leg: PickLeg) => void;
  onCopy: (t: string) => void;
  showQ1: boolean;
  showLongshots: boolean;
  myBookie?: string;
  liveTracking: LiveTrackingState;
}

export function TodayScreen({
  data,
  slateDate,
  todayDate,
  tomorrowDate,
  viewerTodayYmd,
  viewerTimeZone,
  noGamesToday,
  onIndexRefreshed,
  onSlateDateChange,
  onLegTap,
  onCopy,
  showQ1,
  showLongshots,
  myBookie,
  liveTracking,
}: Props) {
  const official = data.officialCard;
  const useOfficial =
    official != null &&
    official.slateDate === (data.meta.slateTipDate ?? official.slateDate);

  const picksById = useOfficial
    ? picksByIdFromOfficialSnapshots(official!.legSnapshots, data.picks)
    : new Map(data.picks.map((p) => [p.id, p]));

  const displayMultis = useOfficial ? official.multis : data.multis;
  const headerOddsPull =
    official?.oddsLastPulled && useOfficial
      ? official.oddsLastPulled
      : data.meta.oddsLastPulled;
  const oddsForCard = headerOddsPull;
  const publishedAt = official?.publishedAt ?? official?.lockedAt;
  const republishedAt = official?.republishedAt;
  const badgeInjuries = injuriesForBadges(data.injuries, {
    slate: data.slate,
    now: new Date(),
    previous: data.meta.injuriesAtTip,
  });

  const { multis: personalMultis, addMulti, removeMulti } = usePersonalMultis(data.picks);
  const [builderOpen, setBuilderOpen] = useState(false);
  const slateFairOnly = !slateHasFeedOdds(data.picks);
  const slateOddsNote = slateOddsAvailabilityNote(data.meta, data.picks);

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

  const building = shouldShowSlateBuildingScreen({
    index: data.index,
    slateDate,
    todayDate,
    slateEmpty: !data.slate.length,
    officialCard: official,
    officialInUse: useOfficial,
    noGamesToday,
    previewSlate: data.previewSlate,
  });

  return (
    <div className="pb-24">
      <div className="mb-3">
        <DateSwitcher
          todayDate={todayDate}
          viewerTodayYmd={viewerTodayYmd}
          nextSlateDate={tomorrowDate}
          selected={slateDate}
          onSelect={onSlateDateChange}
          viewerTimeZone={viewerTimeZone}
        />
      </div>

      <TomorrowSlateTease
        index={data.index}
        slateDate={slateDate}
        todayDate={todayDate}
        viewerTodayYmd={viewerTodayYmd}
        viewerTimeZone={viewerTimeZone}
        slateEmpty={!data.slate.length}
        slate={data.slate}
        officialCard={official}
        officialInUse={useOfficial}
        noGamesToday={noGamesToday}
        previewSlate={data.previewSlate}
        onIndexRefreshed={onIndexRefreshed}
      />

      {!building &&
        multis.map((m) => {
        const multiType = m.type as MultiType | string;
        const cardFairOnly =
          multiType === "q1Multi" || (slateFairOnly && multiType !== "q1Multi");
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
            legViews={liveTracking.legViews}
            liveBetView={liveTracking.betViews.get(liveMultiKey(m))}
            liveSnapshot={liveTracking.snapshot}
            reasonsAtTip={data.meta.reasonsAtTip}
          />
        );
      })}

      {!building && (
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
              legViews={liveTracking.legViews}
              liveBetView={liveTracking.betViews.get(liveMultiKey(multi))}
              liveSnapshot={liveTracking.snapshot}
            />
          ))
        )}
      </section>
      )}

      <PersonalMultiBuilder
        open={builderOpen}
        picks={data.picks}
        onClose={() => setBuilderOpen(false)}
        onSave={addMulti}
      />
    </div>
  );
}