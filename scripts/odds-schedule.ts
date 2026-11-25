import type { SlateGame } from "../lib/types.js";
import type { OddsCacheFile } from "../lib/odds-cache-file.js";
export type { OddsCacheFile } from "../lib/odds-cache-file.js";

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

export interface ShouldPullOddsOpts {
  pretipPull?: boolean;
  forceOdds?: boolean;
  skipScheduled9pm?: boolean;
  /** Sydney tip date (YYYY-MM-DD) for the next slate odds target. */
  nextSlateTipDate?: string;
  /** Today's slate official card already locked. */
  officialPublishedToday?: boolean;
}

export function detectOddsPullTrigger(
  now: Date,
  slate: SlateGame[],
  cache: OddsCacheFile,
  opts: ShouldPullOddsOpts = {}
): OddsPullTrigger | null {
  if (opts.forceOdds) return "force";

  const pulled = new Set(cache.pullSlotsToday ?? []);
  const { h } = sydneyParts(now);

  if (opts.pretipPull && slate.length && !pulled.has("pretip")) {
    const first = Math.min(...slate.map((g) => new Date(g.startTime).getTime()));
    const preTipStart = first - 2 * 60 * 60 * 1000;
    if (now.getTime() >= preTipStart && now.getTime() < first) {
      return "pretip";
    }
  }

  if (!opts.skipScheduled9pm && h === 21) {
    if (pulled.has("scheduled_9pm")) return null;
    if (
      opts.nextSlateTipDate &&
      cache.lastScheduled9pmSlate === opts.nextSlateTipDate
    ) {
      return null;
    }
    if (opts.officialPublishedToday && pulled.has("scheduled_9pm")) {
      return null;
    }
    return "scheduled_9pm";
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
  trigger: OddsPullTrigger,
  nextSlateTipDate?: string
): string {
  const pulled = new Set(cache.pullSlotsToday ?? []);
  pulled.add(trigger === "force" ? "force" : trigger);
  cache.pullSlotsToday = [...pulled];
  if (trigger === "scheduled_9pm" && nextSlateTipDate) {
    cache.lastScheduled9pmSlate = nextSlateTipDate;
  }
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