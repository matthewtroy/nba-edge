import type { DataIndexFile } from "./data-index.js";
import { calendarTomorrowYmd, localDateFromIso, localDateString } from "./viewer-slate.js";

export function intlLocaleForTimeZone(timeZone: string): string {
  return timeZone.startsWith("America/") ? "en-US" : "en-AU";
}

/** Short weekday + calendar date in viewer locale order, e.g. AU `Thu 26/11`. */
export function slateTabDateChip(ymd: string, timeZone: string): string {
  const anchor = new Date(`${ymd}T12:00:00.000Z`);
  const locale = intlLocaleForTimeZone(timeZone);
  const parts = new Intl.DateTimeFormat(locale, {
    timeZone,
    weekday: "short",
    day: "numeric",
    month: "numeric",
  }).formatToParts(anchor);
  const weekday = parts.find((p) => p.type === "weekday")?.value ?? "";
  const day = parts.find((p) => p.type === "day")?.value ?? "";
  const month = parts.find((p) => p.type === "month")?.value ?? "";
  return `${weekday} ${day}/${month}`.trim();
}

export function todayTabLabel(viewerTodayYmd: string, timeZone: string): string {
  return `Today (${slateTabDateChip(viewerTodayYmd, timeZone)})`;
}

/** Settled slate tab when viewer local day has no games, e.g. `Thu (26/11)`. */
export function settledSlateTabLabel(folderYmd: string, timeZone: string): string {
  const chip = slateTabDateChip(folderYmd, timeZone);
  const space = chip.indexOf(" ");
  if (space === -1) return chip;
  return `${chip.slice(0, space)} (${chip.slice(space + 1)})`;
}

export function nextSlateTabLabel(nextFolderYmd: string, timeZone: string): string {
  return slateTabDateChip(nextFolderYmd, timeZone);
}

/** Next index folder after today’s pick (skips empty calendar days). */
export function nextSlateFolderDate(
  index: DataIndexFile,
  todayFolder: string
): string | null {
  const sorted = [...index.dates].map((d) => d.date).sort();
  const inIndex = sorted.find((d) => d > todayFolder);
  if (inIndex) return inIndex;
  if (
    index.nextSlateDate &&
    index.nextSlateDate !== todayFolder &&
    !sorted.includes(index.nextSlateDate)
  ) {
    return index.nextSlateDate;
  }
  return inIndex ?? null;
}

export function viewerCalendarTomorrowYmd(
  viewerTodayYmd: string,
  timeZone: string
): string {
  return calendarTomorrowYmd(viewerTodayYmd, timeZone);
}

/** True when the calendar day after viewer today has no slate folder (Thanksgiving gap). */
export function noNbaOnCalendarTomorrow(
  index: DataIndexFile,
  viewerTodayYmd: string,
  timeZone: string
): boolean {
  const tomorrow = viewerCalendarTomorrowYmd(viewerTodayYmd, timeZone);
  return !index.dates.some((d) => {
    const local =
      d.firstTipIso != null ? localDateFromIso(d.firstTipIso, timeZone) : d.date;
    return local === tomorrow || d.date === tomorrow;
  });
}

export function buildingCardHeadline(slateFolderYmd: string, timeZone: string): string {
  const anchor = new Date(`${slateFolderYmd}T12:00:00.000Z`);
  const locale = intlLocaleForTimeZone(timeZone);
  const weekday = anchor.toLocaleDateString(locale, {
    timeZone,
    weekday: "long",
  });
  return `We're building ${weekday}'s card`;
}

export function localDateStringFromNow(now: Date, timeZone: string): string {
  return localDateString(now, timeZone);
}