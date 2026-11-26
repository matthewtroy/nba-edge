export interface SlateOddsSnapshot {
  lastPulled: string;
  oddsMap: Record<string, { price: number; bookie: string }>;
  allOddsMap?: Record<string, Record<string, number>>;
  pulledGameIds?: string[];
}

export interface OddsCacheFile {
  lastPulled?: string;
  /** From the Odds API `x-requests-remaining` response header. */
  creditsRemaining?: number;
  /** When `creditsRemaining` was last read from that header. */
  creditsRemainingAt?: string;
  pullSlotsToday?: string[];
  oddsMap?: Record<string, { price: number; bookie: string }>;
  lastScheduled9pmSlate?: string;
  bySlateDate?: Record<string, SlateOddsSnapshot>;
}
export function oddsCreditsLogLine(cache: OddsCacheFile): string {
  if (cache.creditsRemaining == null) return "odds credits: unknown (no Odds API response recorded)";
  const at = cache.creditsRemainingAt ?? cache.lastPulled;
  return `odds credits: ${cache.creditsRemaining} remaining (Odds API x-requests-remaining${at ? `, read ${at}` : ""})`;
}
