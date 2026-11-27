import type { PickLeg } from "./types.js";
import { isSameOriginHeadshotUrl } from "./headshot-display.js";

export const SHARE_CAPTURE_WIDTH_PX = 430;
export const SHARE_CAPTURE_PADDING_PX = 16;
export const SHARE_CAPTURE_DPR = 3;
/** Dark page behind card — not card green (html-to-image fallback). */
export const SHARE_CAPTURE_PAGE_BG = "#0a0a0a";

/** Transparent 1×1 PNG — html-to-image placeholder for broken / cross-origin images. */
export const SHARE_CAPTURE_IMAGE_PLACEHOLDER =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

export function shareCaptureFooterText(slateDate?: string): string {
  const date =
    slateDate?.trim() ||
    new Date().toLocaleDateString("en-AU", {
      timeZone: "Australia/Sydney",
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  return `NBA Edge · ${date} · 18+ · Gamble Responsibly`;
}

export async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/** Inline headshots for off-screen capture (CORS-safe data URLs). */
export async function prefetchLegHeadshots(
  legs: PickLeg[],
  fetchFn: typeof fetch = fetch
): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  const urls = [
    ...new Set(
      legs
        .map((l) => l.headshotUrl?.trim())
        .filter((u): u is string => Boolean(u))
    ),
  ];
  const origin =
    typeof globalThis.location !== "undefined" && globalThis.location.origin
      ? globalThis.location.origin
      : "http://localhost";

  await Promise.all(
    urls.map(async (url) => {
      if (!isSameOriginHeadshotUrl(url, origin)) return;
      try {
        const res = await fetchFn(url);
        if (!res.ok) return;
        const blob = await res.blob();
        const dataUrl = await blobToDataUrl(blob);
        for (const leg of legs) {
          if (leg.headshotUrl?.trim() === url) out[leg.playerId] = dataUrl;
        }
      } catch {
        /* initials fallback */
      }
    })
  );
  return out;
}

export function legsWithHeadshotOverrides(
  legs: PickLeg[],
  overrides: Record<string, string>
): PickLeg[] {
  if (!Object.keys(overrides).length) return legs;
  return legs.map((leg) => {
    const url = overrides[leg.playerId];
    return url ? { ...leg, headshotUrl: url } : leg;
  });
}