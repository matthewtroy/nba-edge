#!/usr/bin/env tsx
/**
 * Grade official card + priced projections; write per-slate and aggregate results.json.
 * Idempotent. Supabase settle sync uses NBA_EDGE_* when configured (no Supabase CLI).
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { restorePersistedDataFromBranch } from "../lib/restore-data-branch.js";
import { settleOfficialCard } from "../lib/settle-core.js";
import { buildResultsSlice } from "../lib/results-aggregate.js";
import type { OfficialCardFile } from "../lib/official-card-time.js";
import type { PickLeg } from "../lib/types.js";
import type { ResultsSlice } from "../lib/results-types.js";
import { fetchScoreboard, fetchSummary } from "./fetch/espn.js";
import { formatYyyymmddInZone, parseBoxscore } from "./espn-parse.js";
import { gradePickCatalog } from "../lib/graded-leg.js";
import { BET_LABELS, settleOfficialBets } from "../lib/official-bet-settle.js";
import { extraOfficialBetRows, loadExtraOfficialBets } from "../lib/extra-official-bets.js";
import { loadPreAppMainPlays, preAppMainPlayRows } from "../lib/pre-app-main-plays.js";
import { settleGamesSgms, type GamesSgmBetRow } from "../lib/games-sgm-freeze.js";
import { valueLegRowsFromSingles } from "../lib/value-leg-track.js";
import { valueSinglesForSlate, valueSinglesSourceLabel } from "../lib/value-singles-source.js";
import { loadPicksAtCommit } from "../lib/reasons-at-tip-restore.js";
import type { MetaJson } from "../lib/types.js";
import { slateResultsFrozen } from "../lib/settle-slate-freeze.js";
import {
  listRegradeSlateDates,
  listSettleSlateDates,
} from "../lib/settle-slate-list.js";
import { retentionMinYmd } from "../lib/slate-retention.js";
import { syncSettleToSupabase } from "./supabase-sync.js";

const ET = "America/New_York";

function dateFromYyyymmdd(s: string): Date {
  const y = Number(s.slice(0, 4));
  const m = Number(s.slice(4, 6)) - 1;
  const d = Number(s.slice(6, 8));
  return new Date(Date.UTC(y, m, d, 17, 0, 0));
}

import type { BoxLine } from "./espn-parse.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const outDir = path.join(rootDir, "public/data");
const fixtureMode = process.argv.includes("--fixture");

async function loadFinalBoxes(
  now: Date,
  extraSlateDates: string[] = []
): Promise<Map<string, Map<string, BoxLine>>> {
  const cache = new Map<string, unknown>();
  const boxesByGame = new Map<string, Map<string, BoxLine>>();
  const etDays = new Set<string>();
  for (let i = 0; i <= 5; i++) {
    const d = new Date(now.getTime() - i * 86400000);
    etDays.add(formatYyyymmddInZone(d, ET));
  }
  for (const slate of extraSlateDates) {
    etDays.add(slate.replace(/-/g, ""));
  }
  for (const et of etDays) {
    try {
      const board = await fetchScoreboard(dateFromYyyymmdd(et));
      const data = board as { events?: { id: string; status?: { type?: { name?: string } } }[] };
      for (const ev of data.events ?? []) {
        if (!(ev.status?.type?.name ?? "").toLowerCase().includes("final")) continue;
        const sum = cache.get(ev.id) ?? (await fetchSummary(ev.id));
        cache.set(ev.id, sum);
        boxesByGame.set(ev.id, parseBoxscore(sum, (sum as { plays?: unknown }).plays));
      }
    } catch {
      /* day */
    }
  }
  return boxesByGame;
}

function loadFixtureBoxes(): Map<string, Map<string, BoxLine>> {
  const p = path.join(rootDir, "fixtures/settle-boxes.json");
  const raw = JSON.parse(fs.readFileSync(p, "utf8")) as Record<
    string,
    Record<string, BoxLine>
  >;
  const out = new Map<string, Map<string, BoxLine>>();
  for (const [gameId, players] of Object.entries(raw)) {
    out.set(gameId, new Map(Object.entries(players)));
  }
  return out;
}

function appendFrozenSlice(
  frozen: ResultsSlice,
  allOfficialLegs: ReturnType<typeof settleOfficialCard>["legs"],
  allOfficialBets: ReturnType<typeof settleOfficialBets>,
  allGraded: ReturnType<typeof gradePickCatalog>,
  allValue: ReturnType<typeof valueLegRowsFromSingles>,
  allGamesSgmBets: GamesSgmBetRow[]
): void {
  allGraded.push(...frozen.gradedLegs);
  allOfficialLegs.push(...frozen.official.legs);
  allOfficialBets.push(...frozen.official.bets);
  allValue.push(...frozen.valueLegs.legs);
  if (frozen.gamesSgm?.bets?.length) {
    allGamesSgmBets.push(...frozen.gamesSgm.bets);
  }
}

function loadPicks(slateDate: string): PickLeg[] {
  const p = path.join(outDir, slateDate, "picks.json");
  if (!fs.existsSync(p)) return [];
  return JSON.parse(fs.readFileSync(p, "utf8")) as PickLeg[];
}

function loadOfficialCard(slateDate: string): OfficialCardFile | null {
  const cardPath = path.join(outDir, slateDate, "official-card.json");
  if (!fs.existsSync(cardPath)) return null;
  return JSON.parse(fs.readFileSync(cardPath, "utf8")) as OfficialCardFile;
}

function loadMeta(slateDate: string): MetaJson | null {
  const p = path.join(outDir, slateDate, "meta.json");
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, "utf8")) as MetaJson;
}

function sliceUnchanged(a: ResultsSlice | null, b: ResultsSlice): boolean {
  if (!a) return false;
  return (
    JSON.stringify(a.official.legs) === JSON.stringify(b.official.legs) &&
    JSON.stringify(a.official.bets) === JSON.stringify(b.official.bets) &&
    JSON.stringify(a.gradedLegs) === JSON.stringify(b.gradedLegs) &&
    JSON.stringify(a.valueLegs.legs) === JSON.stringify(b.valueLegs.legs) &&
    JSON.stringify(a.gamesSgm ?? null) === JSON.stringify(b.gamesSgm ?? null)
  );
}

function loadPrevSlateSlice(slateDate: string): ResultsSlice | null {
  const slatePath = path.join(outDir, slateDate, "results.json");
  if (!fs.existsSync(slatePath)) return null;
  return JSON.parse(fs.readFileSync(slatePath, "utf8")) as ResultsSlice;
}

async function main() {
  if (process.env.SETTLE_DATA_RESTORED !== "1") restorePersistedDataFromBranch(rootDir);
  const now = new Date();
  const minRetention = retentionMinYmd(now);
  const slateDates = listSettleSlateDates(rootDir, outDir, now);

  const frozenByDate = new Map<string, ResultsSlice>();
  for (const slateDate of slateDates) {
    const prev = loadPrevSlateSlice(slateDate);
    if (prev && slateResultsFrozen(prev)) frozenByDate.set(slateDate, prev);
  }

  const regradeDates = listRegradeSlateDates(slateDates, now, (d) => frozenByDate.has(d));

  const boxes = fixtureMode
    ? loadFixtureBoxes()
    : await loadFinalBoxes(now, regradeDates);

  const allOfficialLegs: ReturnType<typeof settleOfficialCard>["legs"] = [];
  const allOfficialBets: ReturnType<typeof settleOfficialBets> = [];
  const allGraded: ReturnType<typeof gradePickCatalog> = [];
  const allValue: ReturnType<typeof valueLegRowsFromSingles> = [];
  const allGamesSgmBets: GamesSgmBetRow[] = [];

  const extraBets = loadExtraOfficialBets(rootDir);
  for (const slateDate of slateDates) {
    const prevSlate = loadPrevSlateSlice(slateDate);
    const frozen = frozenByDate.get(slateDate) ?? null;
    const inRetention = slateDate >= minRetention;

    if (!inRetention) {
      if (frozen) {
        appendFrozenSlice(
          frozen,
          allOfficialLegs,
          allOfficialBets,
          allGraded,
          allValue,
          allGamesSgmBets
        );
      } else {
        console.warn(`settle: skip ${slateDate} — outside retention, no frozen results.json`);
      }
      continue;
    }

    if (frozen) {
      appendFrozenSlice(
        frozen,
        allOfficialLegs,
        allOfficialBets,
        allGraded,
        allValue,
        allGamesSgmBets
      );
      continue;
    }

    const picks = loadPicks(slateDate);
    const graded = frozen ? frozen.gradedLegs : gradePickCatalog(picks, slateDate, boxes);
    allGraded.push(...graded);

    const card = loadOfficialCard(slateDate);
    let officialLegs: ReturnType<typeof settleOfficialCard>["legs"] = [];
    let officialBets: ReturnType<typeof settleOfficialBets> = [];
    let gamesSgmBets: GamesSgmBetRow[] = [];
    if (card) {
      officialLegs = frozen ? frozen.official.legs : settleOfficialCard(card, boxes).legs;
      const legResults = new Map([
        ...graded.map((g) => [g.id, g.result] as const),
        ...officialLegs.map((l) => [l.id, l.result] as const),
      ]);
      officialBets = [
        ...settleOfficialBets(card, officialLegs),
        ...extraOfficialBetRows(slateDate, legResults, extraBets),
      ];
      gamesSgmBets = settleGamesSgms(slateDate, card.gamesSgms, legResults);
      allOfficialLegs.push(...officialLegs);
      allOfficialBets.push(...officialBets);
      allGamesSgmBets.push(...gamesSgmBets);
    } else if (frozen) {
      officialLegs = frozen.official.legs;
      officialBets = frozen.official.bets;
      allOfficialLegs.push(...officialLegs);
      allOfficialBets.push(...officialBets);
    }

    const { singles, source } = valueSinglesForSlate({
      card,
      meta: loadMeta(slateDate),
      currentPicks: picks,
      loadPicksAtCommit: (commit) => loadPicksAtCommit(rootDir, slateDate, commit),
    });
    const valueRows = valueLegRowsFromSingles(slateDate, singles, graded);
    console.log(
      `settle: singles ${slateDate} · ${singles.length} frozen (${valueSinglesSourceLabel(source)}) · ${valueRows.length} settled`
    );
    allValue.push(...valueRows);

    const slateSlice = buildResultsSlice({
      officialLegs,
      officialBets,
      valueLegRows: valueRows,
      gradedLegs: graded,
      gamesSgmBets,
      now,
    });

    const slateDir = path.join(outDir, slateDate);
    const slatePath = path.join(slateDir, "results.json");
    if (!sliceUnchanged(prevSlate, slateSlice)) {
      fs.mkdirSync(slateDir, { recursive: true });
      fs.writeFileSync(slatePath, JSON.stringify(slateSlice, null, 2));
    }
  }

  const cardDates = new Set(slateDates.filter((d) => loadOfficialCard(d) != null));
  const preAppBets = preAppMainPlayRows(loadPreAppMainPlays(rootDir), cardDates);

  const aggregate = buildResultsSlice({
    officialLegs: allOfficialLegs,
    officialBets: [...preAppBets, ...allOfficialBets],
    valueLegRows: allValue,
    gradedLegs: allGraded,
    gamesSgmBets: allGamesSgmBets,
    now,
  });

  const resultsPath = path.join(outDir, "results.json");
  let previous: ResultsSlice | null = null;
  if (fs.existsSync(resultsPath)) {
    previous = JSON.parse(fs.readFileSync(resultsPath, "utf8")) as ResultsSlice;
  }

  const unchanged = sliceUnchanged(previous, aggregate);
  if (!unchanged) {
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(resultsPath, JSON.stringify(aggregate, null, 2));
    const { record } = aggregate.official;
    console.log(
      `settle: bets ${record.bets} · W-${record.won} L-${record.lost} V-${record.void} · ` +
        `staked ${record.staked}u profit ${record.profit.toFixed(2)}u`
    );
  } else {
    console.log("settle: idempotent — no changes");
  }
  const mainPlay = aggregate.official.byBetType[BET_LABELS.mainPlay];
  if (mainPlay) {
    console.log(
      `settle: Main Play ${mainPlay.won}-${mainPlay.lost} · staked ${mainPlay.staked}u · ` +
        `profit ${mainPlay.profit >= 0 ? "+" : ""}${mainPlay.profit.toFixed(2)}u`
    );
  }

  await syncSettleToSupabase(rootDir, {
    slates: slateDates.map((slateDate) => ({
      slateDate,
      graded: allGraded
        .filter((g) => g.slateDate === slateDate)
        .map((g) => ({
          id: g.id,
          slateDate: g.slateDate,
          playerId: g.playerId,
          gameId: g.gameId,
          market: g.market,
          line: g.line,
          result: g.result,
          actualValue: g.actualValue,
          probability: g.probability,
          probabilityMatchupShadow: g.probabilityMatchupShadow,
          bestPrice: g.bestPrice,
          bestBookie: g.bestBookie,
          fairPrice: g.fairPrice,
        })),
      officialBets: allOfficialBets
        .filter((b) => b.slateDate === slateDate)
        .map((b) => ({
          slateDate: b.slateDate,
          betType: b.betType,
          label: b.label,
          variant: b.variant,
          result: b.result,
          profitUnits: b.profitUnits,
          stakeUnits: b.stakeUnits,
        })),
      officialLegs: allOfficialLegs.filter((l) => l.slateDate === slateDate),
    })),
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});