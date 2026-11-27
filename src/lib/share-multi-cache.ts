import type { CaptureMultiCardShareInput } from "./share-multi-image";

export const SHARE_PNG_DEBOUNCE_MS = 400;
export const SHARE_PNG_LIVE_REFRESH_MS = 30_000;

export function sharePngCacheVersion(input: CaptureMultiCardShareInput): string {
  const legIds = input.shareLegs.map((l) => l.id).join(",");
  const bookie =
    input.lockedBookie ??
    input.preferredBookie ??
    input.multi.bestBookie ??
    "";
  const live =
    input.liveBetView?.state ?? String(input.legViews?.size ?? 0);
  const cross = input.multi.type === "crossGameSgm" ? legIds : "";
  return [
    input.multi.type,
    input.multi.variant ?? "",
    input.multi.legs.join(","),
    legIds,
    cross,
    bookie,
    input.officialDisplayOnly ? "1" : "0",
    input.slateDate ?? "",
    String(live),
  ].join("|");
}