export const OFFICIAL_CARD_BOOKIE = "bet365";

export interface OfficialCardMeta {
  lockedAt: string;
  slateDate: string;
  bookie: string;
}

export interface OfficialCardFile {
  lockedAt: string;
  slateDate: string;
  bookie: string;
  multis: import("./types.js").MultiBet[];
  notBuilt: import("./types.js").MultiNotBuilt[];
  whatChanged: string[];
  injuries: import("./types.js").InjuryEntry[];
  oddsLastPulled?: string;
}

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

/** Evening lock window ~7–9pm Sydney (pipeline may also force via env). */
export function shouldLockOfficialCardNow(now: Date): boolean {
  if (process.env.OFFICIAL_CARD_LOCK === "1") return true;
  const h = sydneyHour(now);
  return h >= 19 && h <= 21;
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