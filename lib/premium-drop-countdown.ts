import { viewerZoneLabel } from "./viewer-slate.js";

export interface DropCountdownParts {
  hours: number;
  minutes: number;
  seconds: number;
  done: boolean;
  publishLabel: string;
  tease: string;
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
  return {
    hours,
    minutes,
    seconds,
    done: left <= 0,
    publishLabel: formatViewerPublishTime(nextPublishAt, viewerTz),
    tease: "Official card · multis lock at 9pm Sydney",
  };
}

export function tomorrowNoNbaTease(): string {
  return "No NBA tomorrow · next slate below";
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

export function formatCountdownClock(parts: Pick<DropCountdownParts, "hours" | "minutes" | "seconds">): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(parts.hours)}:${pad(parts.minutes)}:${pad(parts.seconds)}`;
}