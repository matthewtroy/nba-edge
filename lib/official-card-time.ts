import type { LegReason } from "./leg-reason-types.js";
import type { PickLeg } from "./types.js";

/** @deprecated Official card uses each multi's bestBookie — not a single default. */
export const OFFICIAL_CARD_BOOKIE = "";

export interface OfficialLegSnapshot {
  id: string;
  playerId: string;
  playerName: string;
  headshotUrl?: string;
  gameId: string;
  team: string;
  opponent?: string;
  market: string;
  line: number;
  publishedBookie: string;
  publishedPrice?: number;
  fairPrice: number;
  takeAt: number;
  probability: number;
  reasons: LegReason[];
  reasonLine?: string;
  recentVsLine?: ("hit" | "miss" | "na")[];
  recentTenVsLine?: ("hit" | "miss" | "na")[];
  lastTenStatValues?: (number | null)[];
  bookiePrices?: Record<string, number>;
  feedLineNote?: string;
  questionable?: boolean;
  tags?: string[];
}

export interface OfficialCardMeta {
  lockedAt: string;
  slateDate: string;
  bookie: string;
  publishedAt?: string;
  republishedAt?: string;
}

export interface OfficialCardFile {
  lockedAt: string;
  slateDate: string;
  /** Primary bookie (Main Play bestBookie when present). */
  bookie: string;
  legSnapshots?: Record<string, OfficialLegSnapshot>;
  multis: import("./types.js").MultiBet[];
  notBuilt: import("./types.js").MultiNotBuilt[];
  whatChanged: string[];
  injuries: import("./types.js").InjuryEntry[];
  oddsLastPulled?: string;
  publishedAt?: string;
  republishedAt?: string;
  /** Games-tab SGMs for every price filter, frozen at publish. */
  gamesSgms?: import("./games-sgm-freeze.js").FrozenGamesSgms;
  /** Value singles (1u each), frozen at publish. */
  valueSingles?: import("./value-leg-track.js").FrozenValueSingle[];
  /** Freezes rebuilt after the fact from the pinned pre-tip picks commit. */
  freezeBackfill?: { commit: string; committedAt: string; fields: string[] };
}

const EVENING_HOURS = new Set([21, 22, 23, 0, 1]);

export function sydneyDateString(d: Date): string {
  return d.toLocaleDateString("en-CA", { timeZone: "Australia/Sydney" });
}

export function sydneyHour(d: Date): number {
  return Number(
    d.toLocaleString("en-AU", {
      timeZone: "Australia/Sydney",
      hour: "numeric",
      hour12: false,
    })
  );
}

/** 21:00–01:00 Sydney — official card publish window */
export function isEveningSydney(now: Date): boolean {
  return EVENING_HOURS.has(sydneyHour(now));
}

export function hasAuPropPrices(picks: PickLeg[]): boolean {
  return picks.some(
    (p) =>
      (p.bookiePrices && Object.values(p.bookiePrices).some((v) => v > 1)) ||
      (p.bestPrice != null && p.bestPrice > 1)
  );
}

/**
 * First evening run with AU props for this slate date; never overwrite an existing lock.
 */
export function shouldPublishOfficialCard(
  now: Date,
  picks: PickLeg[],
  existing: OfficialCardFile | null,
  slateDate: string,
  opts?: { publishNow?: boolean }
): boolean {
  if (process.env.OFFICIAL_CARD_LOCK === "1") {
    if (existing?.slateDate === slateDate) return false;
    return true;
  }
  if (existing?.slateDate === slateDate) return false;
  const publishNow = opts?.publishNow === true || process.env.PIPELINE_PUBLISH_NOW === "1";
  if (!publishNow && !isEveningSydney(now)) return false;
  return hasAuPropPrices(picks);
}

/** @deprecated use shouldPublishOfficialCard */
export function shouldLockOfficialCardNow(now: Date): boolean {
  return isEveningSydney(now) || process.env.OFFICIAL_CARD_LOCK === "1";
}

export function earliestTipIso(
  legs: import("./types.js").PickLeg[],
  slate: import("./types.js").SlateGame[]
): string | null {
  const ids = new Set(legs.map((l) => l.gameId));
  const times = slate
    .filter((g) => ids.has(g.id))
    .map((g) => new Date(g.startTime).getTime())
    .filter(Number.isFinite);
  if (!times.length) return null;
  return new Date(Math.min(...times)).toISOString();
}

export function latestOddsPullIso(
  ...candidates: (string | undefined)[]
): string | undefined {
  const ok = candidates.filter((c): c is string => Boolean(c));
  if (!ok.length) return undefined;
  return ok.sort()[ok.length - 1];
}