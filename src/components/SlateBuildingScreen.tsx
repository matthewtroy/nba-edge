import { useEffect, useState } from "react";
import type { DataIndexFile } from "@lib/data-index";
import type { SlateGame } from "@lib/types";
import {
  buildingCardHeadline,
  noNbaOnCalendarTomorrow,
} from "@lib/slate-tab-labels";
import { viewerTimeZone } from "@lib/viewer-slate";
import {
  dropCountdownParts,
  formatCountdownClock,
  tomorrowNoNbaTease,
} from "@lib/premium-drop-countdown";
import { slateGamesFromIndexPreviews } from "@lib/slate-preview";
import { loadDataIndex } from "../hooks/useData";
import { viewerTimeFromIso } from "../utils/format";

interface Props {
  index: DataIndexFile | null;
  slateDate: string;
  todayDate: string;
  viewerTodayYmd: string;
  viewerTimeZone?: string;
  slate?: SlateGame[];
  showNoNbaTomorrow?: boolean;
  onIndexRefreshed?: (index: DataIndexFile) => void;
  className?: string;
}

function LockedPlaceholder({ title }: { title: string }) {
  return (
    <div
      className="rounded-card border border-white/[0.06] bg-white/[0.03] px-3 py-4 mb-2 overflow-hidden relative"
      data-testid="building-placeholder"
    >
      <div
        className="absolute inset-0 backdrop-blur-md bg-white/[0.02]"
        aria-hidden
      />
      <p className="text-[10px] uppercase tracking-wide text-white/40 relative z-[1]">
        Locked
      </p>
      <p className="text-sm font-semibold text-white/55 mt-1 relative z-[1] blur-[3px] select-none">
        {title}
      </p>
    </div>
  );
}

export function SlateBuildingScreen({
  index,
  slateDate,
  todayDate,
  viewerTodayYmd,
  viewerTimeZone: tz = viewerTimeZone(),
  slate,
  showNoNbaTomorrow,
  onIndexRefreshed,
  className = "",
}: Props) {
  const [now, setNow] = useState(() => new Date());
  const [fadingIn, setFadingIn] = useState(false);

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const reduced =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const headline = buildingCardHeadline(slateDate, tz);
  const noNbaTomorrow =
    showNoNbaTomorrow ??
    (index
      ? noNbaOnCalendarTomorrow(index, viewerTodayYmd, tz) && slateDate !== todayDate
      : false);

  const games =
    slate && slate.length > 0
      ? slate
      : slateGamesFromIndexPreviews(index?.games);

  const parts = index?.nextPublishAt
    ? dropCountdownParts(index.nextPublishAt, now, tz)
    : null;

  useEffect(() => {
    if (!parts?.done || !onIndexRefreshed) return;
    setFadingIn(true);
    void loadDataIndex().then((fresh) => {
      if (fresh) onIndexRefreshed(fresh);
    });
  }, [parts?.done, onIndexRefreshed]);

  return (
    <section
      className={`relative rounded-card border border-white/[0.08] bg-gradient-to-b from-white/[0.07] via-card to-page px-4 py-5 mb-4 shadow-[0_0_40px_rgba(56,189,248,0.06)] ${fadingIn ? "opacity-90 transition-opacity duration-700" : ""} ${className}`}
      data-testid="slate-building-screen"
      aria-label="Official card building"
    >
      <div
        className="absolute -top-8 right-6 w-24 h-24 rounded-full bg-sky-400/10 blur-3xl pointer-events-none"
        aria-hidden
      />
      <div
        className="flex items-center justify-center mb-4"
        data-testid="building-basketball-anim"
        aria-hidden
      >
        <svg
          viewBox="0 0 64 64"
          className={`w-14 h-14 text-orange-400/90 drop-shadow-[0_0_12px_rgba(251,146,60,0.35)] ${reduced ? "" : "animate-spin"}`}
        >
          <circle cx="32" cy="32" r="28" fill="currentColor" opacity="0.85" />
          <path
            d="M12 32c8-10 18-14 28-14M52 32c-8 10-18 14-28 14M32 6v52"
            stroke="rgba(15,23,42,0.45)"
            strokeWidth="2"
            fill="none"
          />
          <path
            d="M18 18c6 8 14 12 28 12M18 46c6-8 14-12 28-12"
            stroke="rgba(15,23,42,0.35)"
            strokeWidth="1.5"
            fill="none"
          />
        </svg>
      </div>
      <h2 className="text-lg font-semibold text-white text-center">{headline}</h2>
      {noNbaTomorrow && (
        <p className="text-sm text-white/55 text-center mt-1">{tomorrowNoNbaTease()}</p>
      )}
      {!index?.nextPublishAt ? (
        <p className="text-sm text-white/65 text-center mt-3">Card time TBC</p>
      ) : parts ? (
        <div className="mt-3 text-center">
          <p
            className={`text-sm ${parts.droppingNow ? "text-sky-300 font-medium" : "text-white/70"}`}
            aria-live="polite"
          >
            {parts.droppingNow ? parts.tease : parts.dropLine}
          </p>
          {!parts.done && (
            <p className="text-3xl font-semibold tabular-nums tracking-tight mt-2 text-white">
              {formatCountdownClock(parts)}
            </p>
          )}
          {parts.done && (
            <p className="text-sm text-sky-300 mt-2">Dropping now…</p>
          )}
        </div>
      ) : null}

      {games.length > 0 && (
        <div className="mt-5">
          <h3 className="text-xs uppercase tracking-wide text-white/45 mb-2">On the slate</h3>
          <ul className="space-y-1.5 text-sm text-white/75">
            {games.map((g) => (
              <li key={g.id} className="flex justify-between gap-2 tabular-nums">
                <span className="truncate">
                  {g.awayTeam} @ {g.homeTeam}
                </span>
                <span className="text-white/45 text-xs shrink-0">
                  {viewerTimeFromIso(g.startTime, tz)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-5">
        <LockedPlaceholder title="Main Play" />
        <LockedPlaceholder title="Best Double Up" />
        <LockedPlaceholder title="Best SGM" />
      </div>
    </section>
  );
}