import type { SlateGame } from "../lib/types.js";

/** Sydney-local hour/minute parts */
function sydneyParts(d: Date): { h: number; m: number } {
  const fmt = new Intl.DateTimeFormat("en-AU", {
    timeZone: "Australia/Sydney",
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  }).formatToParts(d);
  return {
    h: Number(fmt.find((p) => p.type === "hour")?.value ?? 0),
    m: Number(fmt.find((p) => p.type === "minute")?.value ?? 0),
  };
}

export interface OddsCacheFile {
  lastPulled?: string;
  creditsRemaining?: number;
  pullSlotsToday?: string[];
  oddsMap?: Record<string, { price: number; bookie: string }>;
}

const SLOTS = [
  { label: "07:00", h: 7, m: 0, windowMin: 35 },
  { label: "09:30", h: 9, m: 30, windowMin: 35 },
] as const;

export function shouldPullOddsNow(
  now: Date,
  slate: SlateGame[],
  cache: OddsCacheFile
): boolean {
  const { h, m } = sydneyParts(now);
  const pulled = new Set(cache.pullSlotsToday ?? []);

  for (const slot of SLOTS) {
    if (pulled.has(slot.label)) continue;
    const after = h > slot.h || (h === slot.h && m >= slot.m);
    const beforeEnd =
      h < slot.h ||
      (h === slot.h && m <= slot.m + slot.windowMin) ||
      (h === slot.h + 1 && slot.m + slot.windowMin >= 60 && m <= (slot.m + slot.windowMin) % 60);
    if (after && (h * 60 + m) <= slot.h * 60 + slot.m + slot.windowMin) {
      return true;
    }
  }

  if (slate.length && !pulled.has("pre-tip")) {
    const first = slate
      .map((g) => new Date(g.startTime).getTime())
      .sort((a, b) => a - b)[0];
    const preTipStart = first - 60 * 60 * 1000;
    if (now.getTime() >= preTipStart && now.getTime() <= first) {
      return true;
    }
  }

  return false;
}

export function recordOddsPull(cache: OddsCacheFile, now: Date, slate: SlateGame[]): string {
  const { h, m } = sydneyParts(now);
  const pulled = new Set(cache.pullSlotsToday ?? []);
  let label = "adhoc";
  for (const slot of SLOTS) {
    if (h === slot.h && m >= slot.m && m <= slot.m + slot.windowMin) label = slot.label;
  }
  if (slate.length) {
    const first = new Date(slate[0].startTime).getTime();
    if (now.getTime() >= first - 60 * 60 * 1000) label = "pre-tip";
  }
  pulled.add(label);
  cache.pullSlotsToday = [...pulled];
  return label;
}

export function resetOddsDayIfNeeded(cache: OddsCacheFile, now: Date): void {
  const today = now.toLocaleDateString("en-CA", { timeZone: "Australia/Sydney" });
  const lastDay = cache.lastPulled
    ? new Date(cache.lastPulled).toLocaleDateString("en-CA", { timeZone: "Australia/Sydney" })
    : "";
  if (today !== lastDay) {
    cache.pullSlotsToday = [];
  }
}