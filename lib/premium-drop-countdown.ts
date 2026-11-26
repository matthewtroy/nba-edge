import { intlLocaleForTimeZone, slateTabDateChip } from "./slate-tab-labels.js";
import { viewerZoneLabel } from "./viewer-slate.js";

export interface DropCountdownParts {
  hours: number;
  minutes: number;
  seconds: number;
  done: boolean;
  publishLabel: string;
  dropLine: string;
  tease: string;
  droppingNow: boolean;
  totalMs: number;
}

export function dropCountdownParts(
  nextPublishAt: string,
  now: Date,
  viewerTz: string
): DropCountdownParts {
  const target = new Date(nextPublishAt).getTime();
  const left = Math.max(0, target - now.getTime());
  const hours = Math.floor(left / 3_600_000);
  const minutes = Math.floor((left % 3_600_000) / 60_000);
  const seconds = Math.floor((left % 60_000) / 1000);
  const droppingNow = left > 0 && left <= 60_000;
  const publishLabel = formatViewerPublishTime(nextPublishAt, viewerTz);
  const dropLine = formatDropLine(nextPublishAt, viewerTz);
  return {
    hours,
    minutes,
    seconds,
    done: left <= 0,
    publishLabel,
    dropLine,
    tease: droppingNow ? "Dropping now…" : "Official card · multis lock at 9pm Sydney",
    droppingNow,
    totalMs: left,
  };
}

export function tomorrowNoNbaTease(): string {
  return "No NBA tomorrow";
}

function formatDropLine(iso: string, timeZone: string): string {
  const d = new Date(iso);
  const locale = intlLocaleForTimeZone(timeZone);
  const parts = new Intl.DateTimeFormat(locale, {
    timeZone,
    weekday: "short",
    day: "numeric",
    month: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).formatToParts(d);
  const weekday = parts.find((p) => p.type === "weekday")?.value ?? "";
  const day = parts.find((p) => p.type === "day")?.value ?? "";
  const month = parts.find((p) => p.type === "month")?.value ?? "";
  const hour = parts.find((p) => p.type === "hour")?.value ?? "";
  const minute = parts.find((p) => p.type === "minute")?.value ?? "";
  const dayPeriod = parts.find((p) => p.type === "dayPeriod")?.value?.toLowerCase() ?? "";
  const clock = `${hour}:${minute} ${dayPeriod}`.trim();
  return `Drops ${weekday} ${day}/${month} · ${clock}`;
}

function formatViewerPublishTime(iso: string, timeZone: string): string {
  const z = viewerZoneLabel(timeZone);
  const core = new Date(iso).toLocaleString("en-AU", {
    timeZone,
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  return z ? `${core} ${z}` : core;
}

export function formatCountdownClock(
  parts: Pick<DropCountdownParts, "hours" | "minutes" | "seconds">
): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(parts.hours)}:${pad(parts.minutes)}:${pad(parts.seconds)}`;
}

export function countdownSlateDateChip(publishIso: string, viewerTz: string): string {
  const ymd = new Date(publishIso).toLocaleDateString("en-CA", { timeZone: viewerTz });
  return slateTabDateChip(ymd, viewerTz);
}