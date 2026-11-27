import type { HistoryJson } from "./types.js";
import { historyEntryCount, recordKeyCount } from "./espn-cache-guard.js";
import { injuryStatusHistoryEntryCount } from "./injury-status-history.js";
import type { InjuryStatusHistoryFile } from "./injury-status-history-ui.js";
import {
  injuryCombineEntryCount,
  type InjuryCombineLogFile,
} from "./injury-combine-log.js";

export const PERSIST_JSON_SHRINK_CHECKS: { rel: string; label: string }[] = [
  { rel: "public/data/game-log-cache.json", label: "game-log-cache.json" },
  { rel: "public/data/h2h-season-cache.json", label: "h2h-season-cache.json" },
  { rel: "public/data/history.json", label: "history.json" },
  { rel: "public/data/injury-status-history.json", label: "injury-status-history.json" },
  { rel: "public/data/injury-combine-log.json", label: "injury-combine-log.json" },
];

/** Count entries for a persisted JSON file using exact `public/data/...` rel paths. */
export function persistJsonEntryCount(relPath: string, raw: unknown): number {
  switch (relPath) {
    case "public/data/history.json":
      return historyEntryCount(raw as HistoryJson);
    case "public/data/injury-status-history.json":
      return injuryStatusHistoryEntryCount(raw as InjuryStatusHistoryFile);
    case "public/data/injury-combine-log.json":
      return injuryCombineEntryCount(raw as InjuryCombineLogFile);
    case "public/data/game-log-cache.json":
    case "public/data/h2h-season-cache.json":
      return recordKeyCount(raw as Record<string, unknown>);
    default:
      return recordKeyCount(raw as Record<string, unknown>);
  }
}