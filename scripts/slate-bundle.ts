import fs from "fs";
import path from "path";
import type {
  InjuryEntry,
  MetaJson,
  MultiBet,
  MultiNotBuilt,
  PickLeg,
  SlateGame,
} from "../lib/types.js";
import type { ModelPlayer } from "./model-engine.js";
import { runModel } from "./model-engine.js";
import { ensureTrackingCacheLoaded } from "../lib/player-tracking-espn.js";
import type { DefenseRatingsBundle } from "../lib/defense-ratings.js";
import type { PlayerPositionRankMap } from "../lib/player-position-rank.js";
import { computeSlateStatus } from "../lib/slate-publication.js";
import type { DataIndexDateEntry } from "../lib/data-index.js";
import { slateDataDir } from "../lib/data-index.js";
import {
  loadOfficialCard,
  shouldPublishOfficialCard,
  writeOfficialCard,
} from "../lib/official-card.js";
import { resolveOddsLastPulled } from "../lib/odds-pull-meta.js";
import { buildOddsCoverage } from "../lib/odds-coverage.js";
import { countPricedLegsByMarket, coverageAttachWarnings } from "../lib/odds-attach.js";
import { slateTeamIds, slateTipDateFromGames } from "../lib/slate-today.js";
import type { OddsCacheFile } from "../lib/odds-cache-file.js";
import { gameOddsLabelsForUnpulled, gameOddsPriceAge } from "../lib/unpulled-odds.js";
import { evaluateOfficialPublishGate } from "../lib/official-card-gate.js";
import { logOfficialCard } from "../lib/official-card-log.js";
import { hasAuPropPrices, isEveningSydney } from "../lib/official-card-time.js";
import { applySlateTipFreeze } from "../lib/slate-tip-freeze.js";
import { pickLegFromSnapshot } from "../lib/official-leg-snapshot.js";
import { countPricedPickLegs } from "../lib/odds-cache-guard.js";
import { freezeInjuriesAtTip, mergeInjuriesReportTime } from "../lib/injury-tip-freeze.js";
import { refreshInjuriesAtTip } from "../lib/injuries-at-tip.js";
import { freezeTippedSlate, gitPreTipLoader } from "../lib/reasons-at-tip-restore.js";
import { attachTeammateEffectsToInjuries } from "../lib/injury-teammate-effects.js";
import {
  INJURY_STATUS_HISTORY_FILE,
  loadInjuryStatusHistoryFile,
  recordInjuryStatusChanges,
  writeInjuryStatusHistoryFile,
} from "../lib/injury-status-history.js";

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
  unpulledGameIds?: Set<string>;
  skipOfficialPublish?: boolean;
  publishNow?: boolean;
  blockOfficialRepublish?: boolean;
  defense?: DefenseRatingsBundle;
  matchupSignalsEnabled?: boolean;
  positionRanks?: PlayerPositionRankMap;
}

/** Drop players not on this slate and pin gameId / opponent to today's slate game (not stale IDs). */
export function alignPlayersToSlate(
  players: ModelPlayer[],
  slate: SlateGame[]
): ModelPlayer[] {
  const gameByTeam = new Map<string, SlateGame>();
  for (const g of slate) {
    gameByTeam.set(g.homeTeamId, g);
    gameByTeam.set(g.awayTeamId, g);
  }
  const slateIds = new Set(slate.map((g) => g.id));
  return players
    .filter((p) => gameByTeam.has(p.teamId))
    .map((p) => {
      const game = gameByTeam.get(p.teamId)!;
      const home = game.homeTeamId === p.teamId;
      return {
        ...p,
        gameId: game.id,
        opponent: home ? game.awayTeam : game.homeTeam,
        opponentTeamId: home ? game.awayTeamId : game.homeTeamId,
      };
    })
    .filter((p) => slateIds.has(p.gameId));
}

/** @deprecated use alignPlayersToSlate */
export function filterPlayersForSlate(
  players: ModelPlayer[],
  slate: SlateGame[]
): ModelPlayer[] {
  return alignPlayersToSlate(players, slate);
}

export function writeSlateBundle(input: SlateBundleInput): DataIndexDateEntry | null {
  const tipDate = slateTipDateFromGames(input.slate);
  if (!tipDate || !input.slate.length) return null;

  const outDir = slateDataDir(input.rootOutDir, tipDate);
  fs.mkdirSync(outDir, { recursive: true });

  const teams = slateTeamIds(input.slate);
  let injuries = mergeInjuriesReportTime(
    input.injuriesAll.filter((i) => teams.has(i.teamId))
  );
  const players = filterPlayersForSlate(input.playersAll, input.slate);
  const rosterIds = new Set([...input.rosterIds].filter((id) => players.some((p) => p.id === id)));

  ensureTrackingCacheLoaded(input.rootDir, tipDate, players);

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
    defense: input.defense,
    matchupSignalsEnabled: input.matchupSignalsEnabled,
    slateTipDate: tipDate,
    positionRanks: input.positionRanks,
  });

  let { picks, multis, multisPayload, meta, whatChanged } = modelRun;
  injuries = attachTeammateEffectsToInjuries(injuries, players);
  const preFreezeOfficial = loadOfficialCard(outDir);
  if (preFreezeOfficial?.legSnapshots && countPricedPickLegs(picks) === 0) {
    const snapLegs = Object.values(preFreezeOfficial.legSnapshots).map(pickLegFromSnapshot);
    const pricedSnaps = snapLegs.filter(
      (p) =>
        (p.bestPrice != null && p.bestPrice > 1) ||
        (p.bookiePrices && Object.values(p.bookiePrices).some((v) => v != null && v > 1))
    );
    if (pricedSnaps.length) {
      console.log(
        `slate bundle: rebuilt ${pricedSnaps.length} priced legs from official snapshots (no live prices)`
      );
      const byId = new Map(picks.map((p) => [p.id, p]));
      for (const leg of pricedSnaps) byId.set(leg.id, leg);
      picks = [...byId.values(), ...picks.filter((p) => !byId.has(p.id))];
    }
  }
  const publishGate = evaluateOfficialPublishGate({
    slateGameCount: input.slate.length,
    pickCount: picks.length,
    players,
    sanity: modelRun.modelSanity,
  });
  const blockOfficialRepublish = publishGate.block;

  const picksPath = path.join(outDir, "picks.json");
  let previousLegCount = 0;
  if (fs.existsSync(picksPath)) {
    try {
      const prev = JSON.parse(fs.readFileSync(picksPath, "utf8")) as unknown[];
      if (Array.isArray(prev)) previousLegCount = prev.length;
    } catch {
      previousLegCount = 0;
    }
  }
  if (picks.length === 0 && input.slate.length > 0 && previousLegCount > 0) {
    console.log(
      `slate bundle blocked: refusing to overwrite ${tipDate} picks (${previousLegCount} legs) with 0 legs`
    );
    return null;
  }
  const unpulledLabels = input.unpulledGameIds?.size
    ? gameOddsLabelsForUnpulled(picks, input.unpulledGameIds)
    : undefined;
  const priceAge = gameOddsPriceAge(
    picks,
    input.slate,
    input.oddsPulledAt ?? input.cache.lastPulled
  );
  if (unpulledLabels || priceAge) {
    meta = {
      ...meta,
      ...(unpulledLabels ? { gameOddsLabels: unpulledLabels } : {}),
      ...(priceAge ? { gameOddsPriceAge: priceAge } : {}),
    };
  }
  const existingOfficial = loadOfficialCard(outDir);
  const oddsCoverage = {
    ...buildOddsCoverage(input.oddsPayloads, input.oddsPulledAt ?? input.now.toISOString()),
    slateTipDate: tipDate,
    slateGameCount: input.slate.length,
  };
  const pricedLegCounts = countPricedLegsByMarket(picks);
  const oddsAttachWarnings = coverageAttachWarnings(oddsCoverage, pricedLegCounts);

  const oddsLastDisplayed =
    countPricedPickLegs(picks) === 0
      ? undefined
      : resolveOddsLastPulled(
          picks,
          input.oddsPulledAt ?? input.cache.lastPulled,
          meta.oddsLastPulled
        );

  const priorMeta = fs.existsSync(path.join(outDir, "meta.json"))
    ? (JSON.parse(fs.readFileSync(path.join(outDir, "meta.json"), "utf8")) as MetaJson)
    : undefined;

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
    ...(meta.gameOddsLabels ? { gameOddsLabels: meta.gameOddsLabels } : {}),
    ...(meta.gameOddsPriceAge ? { gameOddsPriceAge: meta.gameOddsPriceAge } : {}),
  };

  if (
    !input.skipOfficialPublish &&
    !blockOfficialRepublish &&
    !input.blockOfficialRepublish &&
    shouldPublishOfficialCard(input.now, picks, existingOfficial, tipDate, {
      publishNow: input.publishNow,
    })
  ) {
    const official = writeOfficialCard(outDir, {
      now: input.now,
      slate: input.slate,
      multis,
      notBuilt: multisPayload.notBuilt,
      injuries,
      meta: metaOut,
      picks,
    });
    metaOut.officialCard = {
      lockedAt: official.lockedAt,
      publishedAt: official.publishedAt ?? official.lockedAt,
      slateDate: tipDate,
      bookie: official.bookie,
    };
    logOfficialCard("published", `${tipDate}, ${official.bookie}`);
  } else if (existingOfficial?.slateDate === tipDate) {
    metaOut.officialCard = {
      lockedAt: existingOfficial.lockedAt,
      publishedAt: existingOfficial.publishedAt ?? existingOfficial.lockedAt,
      slateDate: existingOfficial.slateDate,
      bookie: existingOfficial.bookie,
    };
    const pub = existingOfficial.publishedAt ?? existingOfficial.lockedAt;
    logOfficialCard("kept", `published ${pub}`);
  } else {
    const reasons: string[] = [];
    if (input.skipOfficialPublish) reasons.push("skip official publish flag");
    if (blockOfficialRepublish || publishGate.block) {
      reasons.push(...publishGate.reasons);
    }
    if (modelRun.modelSanity.blockRepublish) {
      reasons.push("model sanity degraded (card not blocked)");
    }
    if (existingOfficial?.slateDate === tipDate) reasons.push("already locked");
    if (
      !input.publishNow &&
      !isEveningSydney(input.now) &&
      process.env.OFFICIAL_CARD_LOCK !== "1" &&
      process.env.PIPELINE_PUBLISH_NOW !== "1"
    ) {
      reasons.push("outside evening window");
    }
    if (!hasAuPropPrices(picks)) reasons.push("no AU prop prices");
    logOfficialCard("blocked", reasons.join("; ") || "gate");
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

  let slateOut = input.slate;
  let picksOut = picks;
  let multisOut = multis;
  const prevSlatePath = path.join(outDir, "slate.json");
  const prevPicksPath = path.join(outDir, "picks.json");
  const prevMultisPath = path.join(outDir, "multis.json");
  if (
    fs.existsSync(prevSlatePath) &&
    fs.existsSync(prevPicksPath) &&
    fs.existsSync(prevMultisPath)
  ) {
    try {
      const previousSlate = JSON.parse(
        fs.readFileSync(prevSlatePath, "utf8")
      ) as SlateGame[];
      const previousPicks = JSON.parse(
        fs.readFileSync(prevPicksPath, "utf8")
      ) as PickLeg[];
      const previousMultisRaw = JSON.parse(
        fs.readFileSync(prevMultisPath, "utf8")
      ) as { bets?: MultiBet[] };
      const previousMultis = previousMultisRaw.bets ?? [];
      const frozen = applySlateTipFreeze({
        previousSlate,
        incomingSlate: input.slate,
        previousPicks,
        incomingPicks: picks,
        previousMultis,
        incomingMultis: multis,
        now: input.now,
      });
      slateOut = frozen.slate;
      picksOut = frozen.picks;
      multisOut = frozen.multis;
      const prevInjuries = JSON.parse(
        fs.readFileSync(path.join(outDir, "injuries.json"), "utf8")
      ) as InjuryEntry[];
      injuries = freezeInjuriesAtTip(
        prevInjuries,
        injuries,
        slateOut,
        input.now
      );
    } catch {
      /* first publish */
    }
  }

  const injuryHistory = [...(priorMeta?.injuriesAtTip ?? []), ...injuries];
  metaOut.injuriesAtTip = refreshInjuriesAtTip(
    priorMeta?.injuriesAtTip,
    injuryHistory,
    slateOut,
    input.now
  );
  const restored = freezeTippedSlate({
    slateDate: tipDate,
    slate: slateOut,
    picks: picksOut,
    meta: priorMeta,
    now: input.now,
    loadPreTip: gitPreTipLoader(input.rootDir),
  });
  picksOut = restored.picks;
  metaOut.reasonsAtTip = restored.reasonsAtTip;
  if (restored.reasonsFrozenFrom) metaOut.reasonsFrozenFrom = restored.reasonsFrozenFrom;

  fs.writeFileSync(path.join(outDir, "slate.json"), JSON.stringify(slateOut, null, 2));
  const priorInjuriesPath = path.join(outDir, "injuries.json");
  const priorInjuries = fs.existsSync(priorInjuriesPath)
    ? (JSON.parse(fs.readFileSync(priorInjuriesPath, "utf8")) as InjuryEntry[])
    : [];
  const historyPath = path.join(input.rootOutDir, INJURY_STATUS_HISTORY_FILE);
  let statusHistory = loadInjuryStatusHistoryFile(historyPath);
  statusHistory = recordInjuryStatusChanges(statusHistory, {
    slateDate: tipDate,
    previous: priorInjuries,
    next: injuries,
    observedAt: input.now.toISOString(),
  });
  writeInjuryStatusHistoryFile(historyPath, statusHistory);
  fs.writeFileSync(priorInjuriesPath, JSON.stringify(injuries, null, 2));
  fs.writeFileSync(path.join(outDir, "picks.json"), JSON.stringify(picksOut, null, 2));
  fs.writeFileSync(
    path.join(outDir, "multis.json"),
    JSON.stringify({ bets: multisOut, notBuilt: multisPayload.notBuilt }, null, 2)
  );
  fs.writeFileSync(
    path.join(outDir, "odds-coverage.json"),
    JSON.stringify(oddsCoverage, null, 2)
  );
  fs.writeFileSync(path.join(outDir, "meta.json"), JSON.stringify(metaOut, null, 2));

  const priced = picksOut.filter(
    (p) =>
      (p.bestPrice != null && p.bestPrice > 1) ||
      (p.bookiePrices && Object.values(p.bookiePrices).some((v) => v > 1))
  ).length;
  console.log(
    `slate ${tipDate}: ${slateOut.length} games, ${picksOut.length} legs, ${multisOut.length} multis, ${priced} priced`
  );

  const firstTipMs = Math.min(
    ...input.slate.map((g) => new Date(g.startTime).getTime()).filter(Number.isFinite)
  );
  const firstTipIso = Number.isFinite(firstTipMs)
    ? new Date(firstTipMs).toISOString()
    : undefined;

  return {
    date: tipDate,
    status,
    statusLabel,
    gameCount: slateOut.length,
    legCount: picksOut.length,
    multiCount: multisOut.length,
    lastUpdated: metaOut.lastUpdated,
    firstTipIso,
  };
}