#!/usr/bin/env npx tsx
/** Freeze reasons/tags/prob/fair/L5/L10 on every tipped slate folder to its last pre-tip data commit. */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  freezeTippedSlateFolders,
  loadPicksAtCommit,
  loadSlateAtCommit,
} from "../lib/reasons-at-tip-restore.js";
import { backfillCardFreezes } from "../lib/card-freeze-backfill.js";
import type { OfficialCardFile } from "../lib/official-card-time.js";
import type { ReasonsFrozenFrom, SlateGame } from "../lib/types.js";

function backfillTippedCard(
  rootDir: string,
  outDir: string,
  slateDate: string,
  frozenFrom: ReasonsFrozenFrom
): void {
  const dir = path.join(outDir, slateDate);
  const cardPath = path.join(dir, "official-card.json");
  if (!fs.existsSync(cardPath)) return;
  const card = JSON.parse(fs.readFileSync(cardPath, "utf8")) as OfficialCardFile;
  if (card.gamesSgms && card.valueSingles) return;
  const picks = loadPicksAtCommit(rootDir, slateDate, frozenFrom.commit);
  const slate =
    loadSlateAtCommit(rootDir, slateDate, frozenFrom.commit) ??
    (JSON.parse(fs.readFileSync(path.join(dir, "slate.json"), "utf8")) as SlateGame[]);
  if (!picks?.length || !slate.length) {
    console.log(`freeze-backfill ${slateDate}: pre-tip ${frozenFrom.commit.slice(0, 7)} unreadable — skipped`);
    return;
  }
  const { card: next, added } = backfillCardFreezes(card, { frozenFrom, slate, picks });
  if (!added.length) return;
  fs.writeFileSync(cardPath, JSON.stringify(next, null, 2));
  console.log(
    `freeze-backfill ${slateDate}: ${added.join(", ")} from pre-tip ${frozenFrom.commit.slice(0, 7)} · ` +
      `games SGMs ${next.gamesSgms?.bets.length ?? 0} (not built ${next.gamesSgms?.notBuilt.length ?? 0}) · ` +
      `singles ${next.valueSingles?.length ?? 0}`
  );
}

export function runFreezeTippedReasons(rootDir: string, now = new Date()): void {
  const outDir = path.join(rootDir, "public/data");
  const summaries = freezeTippedSlateFolders({ rootDir, outDir, now });
  for (const s of summaries) {
    const from = s.frozenFrom
      ? `${s.frozenFrom.commit.slice(0, 7)} @ ${s.frozenFrom.committedAt} (first tip ${s.frozenFrom.firstTipAt})`
      : "none";
    console.log(
      `freeze-tipped ${s.slateDate}: ${s.status} · frozenFrom ${from} · legs ${s.legs} · zero-reason ${s.zeroReasonBefore} → ${s.zeroReasonAfter} · ` +
        `injuriesAtTip ${s.injuriesAtTip} (seeded ${s.injuriesSeededGames} games from pre-tip)`
    );
    if (s.frozenFrom) {
      backfillTippedCard(rootDir, outDir, s.slateDate, s.frozenFrom);
    }
  }
  if (!summaries.length) console.log("freeze-tipped: no tipped slate folders");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  runFreezeTippedReasons(rootDir);
}
