/** Header bookie line when some legs lack prices at the selected bookie (priced count, not missing). */
export function multiCardBookieHeaderLabel(input: {
  legBookie?: string;
  pricedCount: number;
  legCount: number;
  displayBook?: string;
  fallback?: string;
  showFairOnly?: boolean;
}): string | undefined {
  if (input.showFairOnly) return undefined;
  const { legBookie, pricedCount, legCount, displayBook, fallback } = input;
  if (!legBookie) return displayBook ?? fallback;
  if (pricedCount < legCount) {
    return `${legBookie} · ${pricedCount} of ${legCount}`;
  }
  return displayBook ?? legBookie ?? fallback;
}