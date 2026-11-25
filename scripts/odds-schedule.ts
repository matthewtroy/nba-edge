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

export type OddsPullTrigger = "scheduled_9pm" | "pretip" | "force";

export interface OddsCacheFile {
  lastPulled?: string;
  creditsRemaining?: number;
  pullSlotsToday?: string[];
  oddsMap?: Record<string, { price: number; bookie: string }>;
}

const PULL_WINDOW_MIN = 35;

export interface ShouldPullOddsOpts {
  officialPublishedToday?: boolean;
  pretipPull?: boolean;
  forceOdds?: boolean;
  /** When set, only evaluate pretip (injury refresh runs). */
  skipScheduled9pm?: boolean;
}

export function detectOddsPullTrigger(
  now: Date,
  slate: SlateGame[],
  cache: OddsCacheFile,
  opts: ShouldPullOddsOpts = {}
): OddsPullTrigger | null {
  if (opts.forceOdds) return "force";

  const pulled = new Set(cache.pullSlotsToday ?? []);
  const { h, m } = sydneyParts(now);
  const nowMin = h * 60 + m;

  if (opts.pretipPull && slate.length && !pulled.has("pretip")) {
    const first = Math.min(...slate.map((g) => new Date(g.startTime).getTime()));
    const preTipStart = first - 2 * 60 * 60 * 1000;
    if (now.getTime() >= preTipStart && now.getTime() < first) {
      return "pretip";
    }
  }

  if (!opts.skipScheduled9pm && !pulled.has("scheduled_9pm")) {
    const start = 21 * 60;
    if (nowMin >= start && nowMin <= start + PULL_WINDOW_MIN) {
      return "scheduled_9pm";
    }
  }

  return null;
}

export function shouldPullOddsNow(
  now: Date,
  slate: SlateGame[],
  cache: OddsCacheFile,
  opts: ShouldPullOddsOpts = {}
): boolean {
  return detectOddsPullTrigger(now, slate, cache, opts) != null;
}

export function recordOddsPull(
  cache: OddsCacheFile,
  now: Date,
  trigger: OddsPullTrigger
): string {
  const pulled = new Set(cache.pullSlotsToday ?? []);
  pulled.add(trigger === "force" ? "force" : trigger);
  cache.pullSlotsToday = [...pulled];
  return trigger;
}

export function resetOddsDayIfNeeded(cache: OddsCacheFile, now: Date): void {
  const today = now.toLocaleDateString("en-CA", { timeZone: "Australia/Sydney" });
  const lastDay = cache.lastPulled
    ? new Date(cache.lastPulled).toLocaleDateString("en-CA", {
        timeZone: "Australia/Sydney",
      })
    : "";
  if (today !== lastDay) {
    cache.pullSlotsToday = [];
  }
}

/** True when workflow sets SKIP_ODDS_PULL for injury-only refreshes. */
export function injuryRefreshSkipsOdds(): boolean {
  return process.env.SKIP_ODDS_PULL === "1";
}