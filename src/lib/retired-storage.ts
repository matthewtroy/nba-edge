/** localStorage keys from removed features; cleared on app load. */
export const RETIRED_STORAGE_KEYS = ["nba-edge-personal-multis-v1"] as const;
const RETIRED_STORAGE_PREFIXES = ["multi-bookie:personal:"] as const;

export function clearRetiredStorage(storage: Storage): string[] {
  const removed: string[] = [];
  try {
    const keys = Array.from({ length: storage.length }, (_, i) => storage.key(i)).filter(
      (k): k is string => k != null
    );
    for (const k of keys) {
      const retired =
        (RETIRED_STORAGE_KEYS as readonly string[]).includes(k) ||
        RETIRED_STORAGE_PREFIXES.some((p) => k.startsWith(p));
      if (!retired) continue;
      storage.removeItem(k);
      removed.push(k);
    }
  } catch {
    /* storage unavailable */
  }
  return removed;
}
