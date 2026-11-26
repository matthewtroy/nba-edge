import fs from "fs";
import path from "path";
import type { InjuryEntry, MetaJson, MultiBet, MultiNotBuilt, SlateGame } from "./types.js";
import {
  type OfficialCardFile,
  sydneyDateString,
} from "./official-card-time.js";
import { slateTipDateFromGames } from "./slate-today.js";
import {
  freezeOfficialLegSnapshots,
  officialCardPrimaryBookie,
} from "./official-leg-snapshot.js";
import type { PickLeg } from "./types.js";
import { officialStakeUnits } from "./pricing-config.js";
import { freezeGamesSgms } from "./games-sgm-freeze.js";

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
    picks: PickLeg[];
    republishedAt?: string;
    preservePublishedAt?: string;
  }
): OfficialCardFile {
  const nowIso = input.now.toISOString();
  const publishedAt = input.preservePublishedAt ?? nowIso;
  const picksById = new Map(input.picks.map((p) => [p.id, p]));
  const multisWithStake = input.multis.map((m) => ({
    ...m,
    stakeUnits: m.stakeUnits ?? officialStakeUnits(m.type, m.bestBookieTotal ?? m.combinedFairPrice),
  }));
  const legSnapshots = freezeOfficialLegSnapshots(
    multisWithStake,
    picksById,
    input.picks
  );
  const file: OfficialCardFile = {
    lockedAt: input.republishedAt ? nowIso : publishedAt,
    publishedAt,
    ...(input.republishedAt ? { republishedAt: input.republishedAt } : {}),
    slateDate: slateTipDateFromGames(input.slate) ?? sydneyDateString(input.now),
    bookie: officialCardPrimaryBookie(input.multis),
    legSnapshots,
    multis: multisWithStake,
    notBuilt: input.notBuilt,
    whatChanged: input.meta.whatChanged ?? [],
    injuries: input.injuries,
    oddsLastPulled: input.meta.oddsLastPulled,
    gamesSgms: freezeGamesSgms(input.slate, input.picks),
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