import fs from "fs";
import path from "path";
import type { InjuryEntry, MetaJson, MultiBet, MultiNotBuilt, SlateGame } from "../lib/types.js";
import type { ModelPlayer } from "./model-engine.js";
import { runModel } from "./model-engine.js";
import { computeSlateStatus } from "../lib/slate-publication.js";
import type { DataIndexDateEntry } from "../lib/data-index.js";
import { slateDataDir } from "../lib/data-index.js";
import {
  loadOfficialCard,
  shouldPublishOfficialCard,
  writeOfficialCard,
  OFFICIAL_CARD_BOOKIE,
} from "../lib/official-card.js";
import { resolveOddsLastPulled } from "../lib/odds-pull-meta.js";
import { buildOddsCoverage } from "../lib/odds-coverage.js";
import { countPricedLegsByMarket, coverageAttachWarnings } from "../lib/odds-attach.js";
import { slateTeamIds, slateTipDateFromGames } from "../lib/slate-today.js";
import type { OddsCacheFile } from "./odds-schedule.js";

export interface SlateBundleInput {
  rootDir: string;
  rootOutDir: string;
  slate: SlateGame[];
  injuriesAll: InjuryEntry[];
  playersAll: ModelPlayer[];
  rosterIds: Set<string>;
  oddsMap: Map<string, { price: number; bookie: string }>;
  allOddsMap: Map<string, Record<string, number>>;
  oddsPulledAt?: string;
  oddsPayloads: unknown[];
  sources: Record<string, string>;
  cache: OddsCacheFile;
  now: Date;
  nbaOfficialUrl?: string;
  nbaOfficialLastTriedUrl?: string;
}

export function filterPlayersForSlate(
  players: ModelPlayer[],
  slate: SlateGame[]
): ModelPlayer[] {
  const gameByTeam = new Map<string, SlateGame>();
  for (const g of slate) {
    gameByTeam.set(g.homeTeamId, g);
    gameByTeam.set(g.awayTeamId, g);
  }
  return players.filter((p) => gameByTeam.has(p.teamId));
}

export function writeSlateBundle(input: SlateBundleInput): DataIndexDateEntry | null {
  const tipDate = slateTipDateFromGames(input.slate);
  if (!tipDate || !input.slate.length) return null;

  const outDir = slateDataDir(input.rootOutDir, tipDate);
  fs.mkdirSync(outDir, { recursive: true });

  const teams = slateTeamIds(input.slate);
  const injuries = input.injuriesAll.filter((i) => teams.has(i.teamId));
  const players = filterPlayersForSlate(input.playersAll, input.slate);
  const rosterIds = new Set([...input.rosterIds].filter((id) => players.some((p) => p.id === id)));

  const modelRun = runModel({
    rootDir: input.rootDir,
    slate: input.slate,
    injuries,
    players,
    rosterIds,
    oddsMap: input.oddsMap,
    allOddsMap: input.allOddsMap,
    oddsPulledAt: input.oddsPulledAt,
    metaSources: { ...input.sources },
  });

  const { picks, multis, multisPayload, meta, whatChanged } = modelRun;
  const existingOfficial = loadOfficialCard(outDir);
  const oddsCoverage = {
    ...buildOddsCoverage(input.oddsPayloads, input.oddsPulledAt ?? input.now.toISOString()),
    slateTipDate: tipDate,
    slateGameCount: input.slate.length,
  };
  const pricedLegCounts = countPricedLegsByMarket(picks);
  const oddsAttachWarnings = coverageAttachWarnings(oddsCoverage, pricedLegCounts);

  const oddsLastDisplayed = resolveOddsLastPulled(
    picks,
    input.cache.lastPulled,
    meta.oddsLastPulled
  );

  const metaOut: MetaJson = {
    ...meta,
    slateTipDate: tipDate,
    oddsLastPulled: oddsLastDisplayed,
    whatChanged,
    ...(input.nbaOfficialUrl ? { nbaOfficialUrl: input.nbaOfficialUrl } : {}),
    ...(input.nbaOfficialLastTriedUrl ? { nbaOfficialLastTriedUrl: input.nbaOfficialLastTriedUrl } : {}),
    pricedLegCounts,
    ...(oddsAttachWarnings.length ? { oddsAttachWarnings } : {}),
    ...(multisPayload.gateViolations?.length
      ? { gateViolations: multisPayload.gateViolations }
      : {}),
  };

  if (shouldPublishOfficialCard(input.now, picks, existingOfficial, tipDate)) {
    const official = writeOfficialCard(outDir, {
      now: input.now,
      slate: input.slate,
      multis,
      notBuilt: multisPayload.notBuilt,
      injuries,
      meta: metaOut,
      bookie: OFFICIAL_CARD_BOOKIE,
    });
    metaOut.officialCard = {
      lockedAt: official.lockedAt,
      publishedAt: official.publishedAt ?? official.lockedAt,
      slateDate: tipDate,
      bookie: official.bookie,
    };
    console.log(`Official card published (${tipDate}, ${official.bookie})`);
  } else if (existingOfficial?.slateDate === tipDate) {
    metaOut.officialCard = {
      lockedAt: existingOfficial.lockedAt,
      publishedAt: existingOfficial.publishedAt ?? existingOfficial.lockedAt,
      slateDate: existingOfficial.slateDate,
      bookie: existingOfficial.bookie,
    };
  }

  const officialForStatus = loadOfficialCard(outDir);
  const { status, statusLabel } = computeSlateStatus(
    input.slate,
    metaOut,
    officialForStatus,
    input.now
  );
  metaOut.slatePublicationStatus = status;
  metaOut.slateStatusLabel = statusLabel;

  fs.writeFileSync(path.join(outDir, "slate.json"), JSON.stringify(input.slate, null, 2));
  fs.writeFileSync(path.join(outDir, "injuries.json"), JSON.stringify(injuries, null, 2));
  fs.writeFileSync(path.join(outDir, "picks.json"), JSON.stringify(picks, null, 2));
  fs.writeFileSync(
    path.join(outDir, "multis.json"),
    JSON.stringify({ bets: multis, notBuilt: multisPayload.notBuilt }, null, 2)
  );
  fs.writeFileSync(
    path.join(outDir, "odds-coverage.json"),
    JSON.stringify(oddsCoverage, null, 2)
  );
  fs.writeFileSync(path.join(outDir, "meta.json"), JSON.stringify(metaOut, null, 2));

  const priced = picks.filter(
    (p) =>
      (p.bestPrice != null && p.bestPrice > 1) ||
      (p.bookiePrices && Object.values(p.bookiePrices).some((v) => v > 1))
  ).length;
  console.log(
    `slate ${tipDate}: ${input.slate.length} games, ${picks.length} legs, ${multis.length} multis, ${priced} priced`
  );

  return {
    date: tipDate,
    status,
    statusLabel,
    gameCount: input.slate.length,
    legCount: picks.length,
    multiCount: multis.length,
    lastUpdated: metaOut.lastUpdated,
  };
}