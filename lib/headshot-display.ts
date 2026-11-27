import { selfHostedHeadshotRelPath } from "./headshot-store.js";

function normalizeBase(baseUrl: string): string {
  return baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
}

/** Public URL for a leg avatar (self-hosted under `data/headshots/`). */
export function headshotPublicUrl(
  playerId: string,
  storedUrl: string | undefined,
  baseUrl: string
): string {
  const base = normalizeBase(baseUrl);
  const dataRoot = `${base}data/`;
  const trimmed = storedUrl?.trim() ?? "";
  if (trimmed.startsWith("headshots/")) {
    return `${dataRoot}${trimmed}`;
  }
  if (trimmed.startsWith("data/headshots/")) {
    return `${base}${trimmed}`;
  }
  if (trimmed.includes("espncdn.com")) {
    return `${dataRoot}${selfHostedHeadshotRelPath(playerId)}`;
  }
  if (trimmed) {
    return trimmed.startsWith("http") ? `${dataRoot}${selfHostedHeadshotRelPath(playerId)}` : `${dataRoot}${trimmed}`;
  }
  return `${dataRoot}${selfHostedHeadshotRelPath(playerId)}`;
}

export function isSameOriginHeadshotUrl(url: string, origin: string): boolean {
  const t = url.trim();
  if (!t) return false;
  if (t.startsWith("data:")) return true;
  try {
    const u = new URL(t, origin);
    return u.origin === origin;
  } catch {
    return t.startsWith("/") || !t.includes("://");
  }
}