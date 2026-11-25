export type FormTick = "hit" | "miss" | "na";

/**
 * Leg row Past-5 dots: index 0 = most recent game (data order).
 * UI renders left → right as oldest → newest (see docs/leg-row-meta.md).
 */
export function displayTicksChronological(ticks: FormTick[]): FormTick[] {
  return [...ticks].reverse();
}

/** Hot streak: cleared line in 4+ of last 5 graded games (≥3 with data). */
export function hotStreakHits(ticks: FormTick[]): number | null {
  const graded = ticks.filter((t) => t !== "na");
  if (graded.length < 3) return null;
  return graded.filter((t) => t === "hit").length;
}

export function isHotStreak(ticks: FormTick[]): boolean {
  const hits = hotStreakHits(ticks);
  return hits != null && hits >= 4;
}

export function hotStreakLabel(ticks: FormTick[]): string | null {
  const hits = hotStreakHits(ticks);
  if (hits == null || hits < 4) return null;
  const graded = ticks.filter((t) => t !== "na").length;
  return `${hits}/${graded} hot`;
}