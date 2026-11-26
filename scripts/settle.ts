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
import { valueLegRowsFromGraded } from "../lib/value-leg-track.js";
import { slateResultsFrozen } from "../lib/settle-slate-freeze.js";
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

function listSlateDates(): string[] {
  const dates = new Set<string>();
  if (!fs.existsSync(outDir)) return [];
  for (const name of fs.readdirSync(outDir)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(name)) continue;
  if (fs.existsSync(path.join(outDir, name, "picks.json"))) dates.add(name);
  }
  for (const name of fs.readdirSync(outDir)) {
    const cardPath = path.join(outDir, name, "official-card.json");
    if (fs.existsSync(cardPath)) dates.add(name);
  }
  return [...dates].sort();
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

function sliceUnchanged(a: ResultsSlice | null, b: ResultsSlice): boolean {
  if (!a) return false;
  return (
    JSON.stringify(a.official.legs) === JSON.stringify(b.official.legs) &&
    JSON.stringify(a.official.bets) === JSON.stringify(b.official.bets) &&
    JSON.stringify(a.gradedLegs) === JSON.stringify(b.gradedLegs)
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
  const slateDates = listSlateDates();

  const regradeDates: string[] = [];
  for (const slateDate of slateDates) {
    const prev = loadPrevSlateSlice(slateDate);
    if (!prev || !slateResultsFrozen(prev)) regradeDates.push(slateDate);
  }

  const boxes = fixtureMode
    ? loadFixtureBoxes()
    : await loadFinalBoxes(now, regradeDates);

  const allOfficialLegs: ReturnType<typeof settleOfficialCard>["legs"] = [];
  const allOfficialBets: ReturnType<typeof settleOfficialBets> = [];
  const allGraded: ReturnType<typeof gradePickCatalog> = [];
  const allValue: ReturnType<typeof valueLegRowsFromGraded> = [];

  const extraBets = loadExtraOfficialBets(rootDir);
  for (const slateDate of slateDates) {
    const prevSlate = loadPrevSlateSlice(slateDate);
    const frozen = prevSlate && slateResultsFrozen(prevSlate) ? prevSlate : null;

    const picks = loadPicks(slateDate);
    const graded = frozen ? frozen.gradedLegs : gradePickCatalog(picks, slateDate, boxes);
    allGraded.push(...graded);

    const card = loadOfficialCard(slateDate);
    let officialLegs: ReturnType<typeof settleOfficialCard>["legs"] = [];
    let officialBets: ReturnType<typeof settleOfficialBets> = [];
    if (card) {
      officialLegs = frozen ? frozen.official.legs : settleOfficialCard(card, boxes).legs;
      officialBets = [
        ...settleOfficialBets(card, officialLegs),
        ...extraOfficialBetRows(
          slateDate,
          new Map([
            ...graded.map((g) => [g.id, g.result] as const),
            ...officialLegs.map((l) => [l.id, l.result] as const),
          ]),
          extraBets
        ),
      ];
      allOfficialLegs.push(...officialLegs);
      allOfficialBets.push(...officialBets);
    } else if (frozen) {
      officialLegs = frozen.official.legs;
      officialBets = frozen.official.bets;
      allOfficialLegs.push(...officialLegs);
      allOfficialBets.push(...officialBets);
    }

    const valueRows = valueLegRowsFromGraded(picks, graded);
    allValue.push(...valueRows);

    const slateSlice = buildResultsSlice({
      officialLegs,
      officialBets,
      valueLegRows: valueRows,
      gradedLegs: graded,
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
        `staked ${record.staked}u profit ${record.profit.toFixed(2)}u` +
        (record.roi != null ? ` ROI ${(record.roi * 100).toFixed(1)}%` : "")
    );
  } else {
    console.log("settle: idempotent — no changes");
  }
  const mainPlay = aggregate.official.byBetType[BET_LABELS.mainPlay];
  if (mainPlay) {
    console.log(
      `settle: Main Play ${mainPlay.won}-${mainPlay.lost} · staked ${mainPlay.staked}u · ` +
        `profit ${mainPlay.profit >= 0 ? "+" : ""}${mainPlay.profit.toFixed(2)}u` +
        (mainPlay.roi != null ? ` · ROI ${(mainPlay.roi * 100).toFixed(1)}%` : "")
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