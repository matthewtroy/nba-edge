import type { DataIndexFile } from "./data-index.js";

export const SYDNEY_TZ = "Australia/Sydney";

export function viewerTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || SYDNEY_TZ;
  } catch {
    return SYDNEY_TZ;
  }
}

export function localDateString(d: Date, timeZone: string): string {
  return d.toLocaleDateString("en-CA", { timeZone });
}

export function localDateFromIso(iso: string, timeZone: string): string {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone });
}

/** Viewer-local calendar day after `todayYmd` (always defined for a valid folder date). */
export function calendarTomorrowYmd(todayYmd: string, timeZone: string): string {
  const anchor = new Date(`${todayYmd}T12:00:00.000Z`);
  return localDateString(new Date(anchor.getTime() + 86_400_000), timeZone);
}

export function viewerZoneLabel(timeZone: string): string | null {
  if (timeZone === SYDNEY_TZ) return null;
  try {
    const parts = new Intl.DateTimeFormat("en-AU", {
      timeZone,
      timeZoneName: "short",
    }).formatToParts(new Date());
    return parts.find((p) => p.type === "timeZoneName")?.value ?? timeZone;
  } catch {
    return timeZone;
  }
}

export interface ViewerSlateSegment {
  todayFolder: string | null;
  tomorrowFolder: string | null;
  viewerTodayYmd: string;
  zoneLabel: string | null;
  /** Most recent slate folder whose local tip day is before viewer today. */
  previousFolder: string | null;
  /** Next slate folder whose local tip day is after viewer today. */
  nextAfterViewerToday: string | null;
}

export function mostRecentSlateFolderBeforeViewerToday(
  index: DataIndexFile,
  viewerTodayYmd: string,
  timeZone: string
): string | null {
  const dated = [...index.dates]
    .map((d) => ({
      folder: d.date,
      localTip:
        d.firstTipIso != null
          ? localDateFromIso(d.firstTipIso, timeZone)
          : d.date,
    }))
    .sort((a, b) => a.folder.localeCompare(b.folder));
  let best: string | null = null;
  for (const d of dated) {
    if (d.localTip < viewerTodayYmd) best = d.folder;
  }
  return best;
}

export function nextSlateFolderAfterViewerToday(
  index: DataIndexFile,
  viewerTodayYmd: string,
  timeZone: string
): string | null {
  const dated = [...index.dates]
    .map((d) => ({
      folder: d.date,
      localTip:
        d.firstTipIso != null
          ? localDateFromIso(d.firstTipIso, timeZone)
          : d.date,
    }))
    .sort((a, b) => a.folder.localeCompare(b.folder));
  return dated.find((d) => d.localTip > viewerTodayYmd)?.folder ?? null;
}

/**
 * TODAY = viewer-local calendar day for the slate (first tip in viewer TZ).
 * TOMORROW = next distinct slate folder by local tip date.
 */
export function resolveViewerSlateSegment(
  index: DataIndexFile,
  now = new Date(),
  timeZone = viewerTimeZone()
): ViewerSlateSegment {
  const viewerTodayYmd = localDateString(now, timeZone);
  const dated = [...index.dates]
    .map((d) => ({
      folder: d.date,
      localTip:
        d.firstTipIso != null
          ? localDateFromIso(d.firstTipIso, timeZone)
          : d.date,
    }))
    .sort((a, b) => a.folder.localeCompare(b.folder));

  const todayFolder = dated.find((d) => d.localTip === viewerTodayYmd)?.folder ?? null;

  const tomorrowYmd = localDateString(new Date(now.getTime() + 86_400_000), timeZone);
  let tomorrowFolder =
    dated.find((d) => d.localTip === tomorrowYmd && d.folder !== todayFolder)?.folder ?? null;

  if (!tomorrowFolder && todayFolder) {
    tomorrowFolder = dated.find((d) => d.folder > todayFolder)?.folder ?? null;
  }
  if (!tomorrowFolder && !todayFolder) {
    tomorrowFolder = dated.find((d) => d.localTip > viewerTodayYmd)?.folder ?? null;
  }

  const previousFolder = mostRecentSlateFolderBeforeViewerToday(
    index,
    viewerTodayYmd,
    timeZone
  );
  const nextAfterViewerToday = nextSlateFolderAfterViewerToday(
    index,
    viewerTodayYmd,
    timeZone
  );

  return {
    todayFolder,
    tomorrowFolder: tomorrowFolder === todayFolder ? null : tomorrowFolder,
    viewerTodayYmd,
    zoneLabel: viewerZoneLabel(timeZone),
    previousFolder,
    nextAfterViewerToday,
  };
}

/** Next 21:00 Sydney formatted in viewer local time (pipeline publish window). */
export function nextSydneyEveningPublishLabel(
  now = new Date(),
  viewerTz = viewerTimeZone()
): string {
  const stepMs = 15 * 60_000;
  for (let t = now.getTime(); t < now.getTime() + 48 * 3_600_000; t += stepMs) {
    const d = new Date(t);
    const hour = Number(
      d.toLocaleString("en-AU", { timeZone: SYDNEY_TZ, hour: "numeric", hour12: false })
    );
    const minute = Number(
      d.toLocaleString("en-AU", { timeZone: SYDNEY_TZ, minute: "numeric" })
    );
    if (hour === 21 && minute < 15 && d.getTime() > now.getTime() + 30_000) {
      const local = d.toLocaleString("en-AU", {
        timeZone: viewerTz,
        weekday: "short",
        day: "numeric",
        month: "short",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
      const z = viewerZoneLabel(viewerTz);
      return z ? `${local} ${z}` : local;
    }
  }
  return "9pm Sydney";
}

export function noGamesTodayMessage(now = new Date(), viewerTz = viewerTimeZone()): string {
  return `No NBA slate for your local day · next card ~9pm Sydney (${nextSydneyEveningPublishLabel(now, viewerTz)})`;
}

export const NO_NBA_TODAY_BUILDING_TEASE = "No NBA today";

/** True when the index has no slate whose local tip day is viewer today (same rule as date tabs). */
export function viewerLocalDayHasNoSlate(
  index: DataIndexFile,
  now = new Date(),
  timeZone = viewerTimeZone()
): boolean {
  return resolveViewerSlateSegment(index, now, timeZone).todayFolder === null;
}