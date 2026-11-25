export interface SlateOddsSnapshot {
  lastPulled: string;
  oddsMap: Record<string, { price: number; bookie: string }>;
  allOddsMap?: Record<string, Record<string, number>>;
  pulledGameIds?: string[];
}

export interface OddsCacheFile {
  lastPulled?: string;
  creditsRemaining?: number;
  pullSlotsToday?: string[];
  oddsMap?: Record<string, { price: number; bookie: string }>;
  lastScheduled9pmSlate?: string;
  bySlateDate?: Record<string, SlateOddsSnapshot>;
}