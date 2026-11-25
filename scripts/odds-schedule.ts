import type { SlateGame } from "../lib/types.js";
import { isEveningSydney } from "../lib/official-card-time.js";

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

const PULL_WINDOW_MIN = 35;

export interface ShouldPullOddsOpts {
  /** Official card already published for today's Sydney slate */
  officialPublishedToday?: boolean;
}

export function shouldPullOddsNow(
  now: Date,
  slate: SlateGame[],
  cache: OddsCacheFile,
  opts: ShouldPullOddsOpts = {}
): boolean {
  const { h, m } = sydneyParts(now);
  const pulled = new Set(cache.pullSlotsToday ?? []);
  const nowMin = h * 60 + m;

  if (isEveningSydney(now) && !opts.officialPublishedToday) {
    const label = `evening-${h}`;
    if (!pulled.has(label)) {
      const slotStart = h * 60;
      if (nowMin >= slotStart && nowMin <= slotStart + PULL_WINDOW_MIN) return true;
    }
  }

  const morningLabel = "07:00";
  if (!pulled.has(morningLabel)) {
    const start = 7 * 60;
    if (nowMin >= start && nowMin <= start + PULL_WINDOW_MIN) return true;
  }

  if (slate.length && !pulled.has("pre-tip")) {
    const first = slate
      .map((g) => new Date(g.startTime).getTime())
      .sort((a, b) => a - b)[0];
    const preTipStart = first - 60 * 60 * 1000;
    if (now.getTime() >= preTipStart && now.getTime() < first) {
      return true;
    }
  }

  return false;
}

export function recordOddsPull(cache: OddsCacheFile, now: Date, slate: SlateGame[]): string {
  const { h, m } = sydneyParts(now);
  const pulled = new Set(cache.pullSlotsToday ?? []);
  let label = "adhoc";

  if (isEveningSydney(now)) {
    label = `evening-${h}`;
  } else if (h === 7 && m < PULL_WINDOW_MIN + 5) {
    label = "07:00";
  }

  if (slate.length) {
    const first = Math.min(...slate.map((g) => new Date(g.startTime).getTime()));
    if (now.getTime() >= first - 60 * 60 * 1000 && now.getTime() < first) {
      label = "pre-tip";
    }
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