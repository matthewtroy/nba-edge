import { useEffect, useMemo, useState, type ReactNode } from "react";
import { bookieWithMostCoverage } from "@lib/card-bookie";
import { loadDataIndex, useData } from "./hooks/useData";
import { useSlateDate } from "./hooks/useSlateDate";
import type { DataIndexFile } from "@lib/data-index";
import { TabBar } from "./components/TabBar";
import { LegSheet } from "./components/LegSheet";
import { TodayScreen } from "./screens/TodayScreen";
import { PicksScreen } from "./screens/PicksScreen";
import { InjuriesScreen } from "./screens/InjuriesScreen";
import { ResultsScreen } from "./screens/ResultsScreen";
import { GamesScreen } from "./screens/GamesScreen";
import type { PickLeg } from "@lib/types";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { LoadingSkeleton } from "./components/LoadingSkeleton";
import { BrandedLoadState } from "./components/BrandedLoadState";
import { OfficialDropCountdown } from "./components/OfficialDropCountdown";
import { injuriesForBadges } from "@lib/injury-display";
import { useLiveTracking } from "./hooks/useLiveTracking";
import { officialLiveTrackingInputs } from "@lib/official-live-tracking";

type Tab = "today" | "picks" | "games" | "injuries" | "results";

function PhoneShell({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`mx-auto w-full max-w-phone min-h-full bg-page text-white ${className}`}>
      {children}
    </div>
  );
}

export default function App() {
  const [index, setIndex] = useState<DataIndexFile | null>(null);
  useEffect(() => {
    loadDataIndex().then(setIndex);
  }, []);
  const {
    date: slateDate,
    setDate: setSlateDate,
    segment,
    noGamesToday,
    timeZone,
  } = useSlateDate(index);
  const data = useData(slateDate);
  const multisForLive =
    data.officialCard &&
    data.officialCard.slateDate === (data.meta.slateTipDate ?? data.officialCard.slateDate)
      ? data.officialCard.multis
      : data.multis;
  const liveInputs = officialLiveTrackingInputs(
    slateDate,
    data.slate,
    data.picks,
    data.officialCard
  );
  const liveTracking = useLiveTracking(
    slateDate,
    liveInputs.slate,
    liveInputs.legs,
    multisForLive,
    !data.loading && !data.error
  );
  const badgeInjuries = injuriesForBadges(data.injuries, {
    slate: data.slate,
    now: new Date(),
    previous: data.meta.injuriesAtTip,
  });
  const myBookie = useMemo(
    () => (data.picks.length ? bookieWithMostCoverage(data.picks) : "Sportsbet"),
    [data.picks]
  );
  const [tab, setTab] = useState<Tab>("today");
  const [leg, setLeg] = useState<PickLeg | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const refreshIndex = (next: DataIndexFile) => {
    setIndex(next);
    if (next.nextSlateDate && !next.dates.some((d) => d.date === slateDate)) {
      setSlateDate(next.nextSlateDate);
    }
  };

  const copy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setToast("Copied");
    setTimeout(() => setToast(null), 1500);
  };

  if (!index && data.loading) {
    return <LoadingSkeleton />;
  }

  if (!index) {
    return (
      <PhoneShell className="px-4 pt-4">
        <BrandedLoadState kind={data.errorKind ?? "missing"} />
      </PhoneShell>
    );
  }

  if (!index.dates.length && index.nextPublishAt) {
    return (
      <PhoneShell className="px-4 pt-4">
        <BrandedLoadState kind="updating" title="Updating" />
        <OfficialDropCountdown index={index} show />
      </PhoneShell>
    );
  }

  if (data.loading) {
    return <LoadingSkeleton />;
  }

  return (
    <PhoneShell className="px-4 pt-4">
      {data.errorKind && !data.previewSlate && (
        <BrandedLoadState kind={data.errorKind} title="Couldn’t load this slate" />
      )}
      {liveTracking.error && (
        <p className="text-sm text-white/60 mb-2" role="status">
          Live scores are delayed — picks still show last known lines.
        </p>
      )}
      {tab === "today" && (
        <ErrorBoundary name="TodayScreen">
          <TodayScreen
            data={data}
            slateDate={slateDate}
            todayDate={segment.today}
            tomorrowDate={segment.tomorrow}
            viewerTodayYmd={segment.viewerTodayYmd}
            noGamesToday={noGamesToday}
            viewerTimeZone={timeZone}
            onIndexRefreshed={refreshIndex}
            onSlateDateChange={setSlateDate}
            onLegTap={setLeg}
            onCopy={copy}
            showQ1
            showLongshots
            myBookie={myBookie}
            liveTracking={liveTracking}
          />
        </ErrorBoundary>
      )}
      {tab === "picks" && (
        <ErrorBoundary name="PicksScreen">
          <PicksScreen
            data={data}
            slateDate={slateDate}
            todayDate={segment.today}
            tomorrowDate={segment.tomorrow}
            viewerTodayYmd={segment.viewerTodayYmd}
            viewerTimeZone={timeZone}
            onIndexRefreshed={refreshIndex}
            onSlateDateChange={setSlateDate}
            myBookie={myBookie}
            onLegTap={setLeg}
            liveTracking={liveTracking}
          />
        </ErrorBoundary>
      )}
      {tab === "games" && (
        <ErrorBoundary name="GamesScreen">
          <GamesScreen
            data={data}
            slateDate={slateDate}
            todayDate={segment.today}
            tomorrowDate={segment.tomorrow}
            viewerTodayYmd={segment.viewerTodayYmd}
            viewerTimeZone={timeZone}
            onIndexRefreshed={refreshIndex}
            onSlateDateChange={setSlateDate}
            myBookie={myBookie}
            onLegTap={setLeg}
            onCopy={copy}
            liveTracking={liveTracking}
          />
        </ErrorBoundary>
      )}
      {tab === "injuries" && (
        <ErrorBoundary name="InjuriesScreen">
          <InjuriesScreen
            data={data}
            todayDate={segment.today}
            tomorrowDate={segment.tomorrow}
          />
        </ErrorBoundary>
      )}
      {tab === "results" && (
        <ErrorBoundary name="ResultsScreen">
          <ResultsScreen data={data} />
        </ErrorBoundary>
      )}
      <TabBar active={tab} onChange={setTab} />
      <LegSheet
        leg={leg}
        picks={data.picks}
        slate={data.slate}
        injuries={badgeInjuries}
        myBookie={myBookie}
        onClose={() => setLeg(null)}
        onSelectLeg={setLeg}
        liveView={leg ? liveTracking.legViews.get(leg.id) : undefined}
      />
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 bg-card px-4 py-2 rounded-lg text-sm z-50">
          {toast}
        </div>
      )}
    </PhoneShell>
  );
}