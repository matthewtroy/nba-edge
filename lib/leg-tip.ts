import type { PickLeg, SlateGame } from "./types.js";

export function tipLabelForLeg(leg: PickLeg, slate: SlateGame[]): string | null {
  const g = slate.find((x) => x.id === leg.gameId);
  if (!g) return null;
  const label = g.startTimeSydney?.trim();
  if (label) return `Tip ${label}`;
  return null;
}

export function formatSydneyOddsTime(iso?: string): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleString("en-AU", {
    timeZone: "Australia/Sydney",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}