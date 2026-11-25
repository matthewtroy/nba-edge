export type FormTick = "hit" | "miss" | "na";

/**
 * Leg row Past-5 dots: index 0 = most recent game (data order).
 * UI renders left → right as oldest → newest.
 */
export function displayTicksChronological(ticks: FormTick[]): FormTick[] {
  return [...ticks].reverse();
}