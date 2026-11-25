import { SYDNEY_TZ, viewerTimeZone, viewerZoneLabel } from "@lib/viewer-slate";

export function sydneyTimeFromIso(iso: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-AU", {
    timeZone: SYDNEY_TZ,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export function viewerTimeFromIso(iso: string, timeZone = viewerTimeZone()): string {
  if (!iso) return "—";
  const z = viewerZoneLabel(timeZone);
  const core = new Date(iso).toLocaleString("en-AU", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  return z ? `${core} ${z}` : core;
}

export { marketLabel } from "@lib/market-label";

export function verdict(price: number, takeAt: number): "value" | "fair" | "pass" {
  if (price >= takeAt) return "value";
  if (price >= takeAt * 0.95) return "fair";
  return "pass";
}