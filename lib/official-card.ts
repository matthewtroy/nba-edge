import fs from "fs";
import path from "path";
import type { InjuryEntry, MetaJson, MultiBet, MultiNotBuilt, SlateGame } from "./types.js";
import {
  OFFICIAL_CARD_BOOKIE,
  type OfficialCardFile,
  sydneyDateString,
} from "./official-card-time.js";
import { slateTipDateFromGames } from "./slate-today.js";

export {
  OFFICIAL_CARD_BOOKIE,
  shouldPublishOfficialCard,
  shouldLockOfficialCardNow,
  hasAuPropPrices,
  isEveningSydney,
  sydneyDateString,
  sydneyHour,
  earliestTipIso,
  type OfficialCardFile,
  type OfficialCardMeta,
} from "./official-card-time.js";

export function writeOfficialCard(
  outDir: string,
  input: {
    now: Date;
    slate: SlateGame[];
    multis: MultiBet[];
    notBuilt: MultiNotBuilt[];
    injuries: InjuryEntry[];
    meta: MetaJson;
    bookie?: string;
    republishedAt?: string;
    preservePublishedAt?: string;
  }
): OfficialCardFile {
  const nowIso = input.now.toISOString();
  const publishedAt = input.preservePublishedAt ?? nowIso;
  const file: OfficialCardFile = {
    lockedAt: input.republishedAt ? nowIso : publishedAt,
    publishedAt,
    ...(input.republishedAt ? { republishedAt: input.republishedAt } : {}),
    slateDate: slateTipDateFromGames(input.slate) ?? sydneyDateString(input.now),
    bookie: input.bookie ?? OFFICIAL_CARD_BOOKIE,
    multis: input.multis,
    notBuilt: input.notBuilt,
    whatChanged: input.meta.whatChanged ?? [],
    injuries: input.injuries,
    oddsLastPulled: input.meta.oddsLastPulled,
  };
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(
    path.join(outDir, "official-card.json"),
    JSON.stringify(file, null, 2)
  );
  return file;
}

export function loadOfficialCard(outDir: string): OfficialCardFile | null {
  const p = path.join(outDir, "official-card.json");
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, "utf8")) as OfficialCardFile;
}