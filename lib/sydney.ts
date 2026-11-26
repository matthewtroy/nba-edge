export function toSydney(iso: string): string {
  return new Date(iso).toLocaleString("en-AU", {
    timeZone: "Australia/Sydney",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

/** Sydney tip label for UI — always derived from ISO when possible so stale strings cannot drift. */
export function gameStartTimeSydney(
  game: { startTime?: string; startTimeSydney?: string } | null | undefined
): string {
  if (!game) return "";
  const iso = game.startTime?.trim();
  if (iso) {
    const ms = Date.parse(iso);
    if (Number.isFinite(ms)) return toSydney(iso);
  }
  return game.startTimeSydney?.trim() ?? "";
}

export function formatSydneyDate(d: Date): string {
  return d.toLocaleDateString("en-AU", {
    timeZone: "Australia/Sydney",
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

export function sydneyNow(): Date {
  return new Date();
}