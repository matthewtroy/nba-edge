/** Matches rotation redistribution strings on legs (not matchup/form copy). */
export function isInjuryRedistributionReason(text: string): boolean {
  return /out\s*(?:→|:)|only big left|missing \d+ big|opponent missing/i.test(text);
}

export function pickPrimaryInjuryReason(reasons: string[]): string | undefined {
  return reasons.find(isInjuryRedistributionReason);
}