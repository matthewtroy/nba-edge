import fs from "fs";
import path from "path";
import type { PlayerGameLog } from "./types.js";
import {
  type InjuryCombineLogEntry,
  type InjuryCombineLogFile,
  INJURY_COMBINE_LOG_FILE,
} from "./injury-combine-log-ui.js";

export {
  INJURY_COMBINE_LOG_FILE,
  INJURY_COMBINE_LOG_REL,
  type InjuryCombineLogEntry,
  type InjuryCombineLogFile,
} from "./injury-combine-log-ui.js";

export function emptyInjuryCombineLog(): InjuryCombineLogFile {
  return { version: 1, entries: [] };
}

export function loadInjuryCombineLog(filePath: string): InjuryCombineLogFile {
  if (!fs.existsSync(filePath)) return emptyInjuryCombineLog();
  try {
    const raw = JSON.parse(fs.readFileSync(filePath, "utf8")) as InjuryCombineLogFile;
    if (raw?.version === 1 && Array.isArray(raw.entries)) return raw;
  } catch {
    /* corrupt */
  }
  return emptyInjuryCombineLog();
}

export function writeInjuryCombineLog(filePath: string, file: InjuryCombineLogFile): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(file, null, 2)}\n`);
}

function entryKey(e: InjuryCombineLogEntry): string {
  return `${e.slateDate}:${e.playerId}:${e.stat}`;
}

export function mergeInjuryCombineEntries(
  file: InjuryCombineLogFile,
  additions: InjuryCombineLogEntry[]
): InjuryCombineLogFile {
  if (!additions.length) return file;
  const byKey = new Map(file.entries.map((e) => [entryKey(e), e] as const));
  for (const row of additions) byKey.set(entryKey(row), row);
  return { version: 1, entries: [...byKey.values()] };
}

export function injuryCombineEntryCount(file: InjuryCombineLogFile | null | undefined): number {
  if (!file || !Array.isArray(file.entries)) {
    console.warn("injuryCombineEntryCount: unexpected shape — treating as 0 entries");
    return 0;
  }
  return file.entries.length;
}

/** Settle: attach box-score actual for the beneficiary stat. */
export function settleInjuryCombineForSlate(
  rootDir: string,
  slateDate: string,
  boxesByGame: Map<string, Map<string, { pts: number; reb: number; ast: number }>>
): void {
  const combinePath = path.join(rootDir, "public/data", INJURY_COMBINE_LOG_FILE);
  const file = loadInjuryCombineLog(combinePath);
  const actualByPlayer = new Map<string, Pick<PlayerGameLog, "pts" | "reb" | "ast">>();
  for (const byPlayer of boxesByGame.values()) {
    for (const [playerId, box] of byPlayer) {
      actualByPlayer.set(playerId, { pts: box.pts, reb: box.reb, ast: box.ast });
    }
  }
  const next = applyInjuryCombineActuals(file, slateDate, actualByPlayer);
  if (next.entries !== file.entries) writeInjuryCombineLog(combinePath, next);
}

export function applyInjuryCombineActuals(
  file: InjuryCombineLogFile,
  slateDate: string,
  actualByPlayer: Map<string, Pick<PlayerGameLog, "pts" | "reb" | "ast">>
): InjuryCombineLogFile {
  let changed = false;
  const entries = file.entries.map((e) => {
    if (e.slateDate !== slateDate || e.actualStat != null) return e;
    const row = actualByPlayer.get(e.playerId);
    if (!row) return e;
    const actual = row[e.stat];
    if (actual == null) return e;
    changed = true;
    return { ...e, actualStat: actual };
  });
  return changed ? { version: 1, entries } : file;
}