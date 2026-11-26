#!/usr/bin/env npx tsx
/** Freeze reasons/tags/prob/fair/L5/L10 on every tipped slate folder to its last pre-tip data commit. */
import path from "path";
import { fileURLToPath } from "url";
import { freezeTippedSlateFolders } from "../lib/reasons-at-tip-restore.js";

export function runFreezeTippedReasons(rootDir: string, now = new Date()): void {
  const outDir = path.join(rootDir, "public/data");
  const summaries = freezeTippedSlateFolders({ rootDir, outDir, now });
  for (const s of summaries) {
    const from = s.frozenFrom
      ? `${s.frozenFrom.commit.slice(0, 7)} @ ${s.frozenFrom.committedAt} (first tip ${s.frozenFrom.firstTipAt})`
      : "none";
    console.log(
      `freeze-tipped ${s.slateDate}: ${s.status} · frozenFrom ${from} · legs ${s.legs} · zero-reason ${s.zeroReasonBefore} → ${s.zeroReasonAfter}`
    );
  }
  if (!summaries.length) console.log("freeze-tipped: no tipped slate folders");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  runFreezeTippedReasons(rootDir);
}
