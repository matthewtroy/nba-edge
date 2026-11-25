#!/usr/bin/env tsx
/**
 * Grade official card legs from ESPN finals; write results.json (idempotent).
 * No Supabase CLI — DB updates go through sync client when NBA_EDGE_* env is set.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { loadHistory } from "./run-model.js";
import { restorePersistedDataFromBranch } from "../lib/restore-data-branch.js";
import { settleOfficialCard } from "../lib/settle-core.js";
import { buildResultsJson } from "../lib/results-aggregate.js";
import type { OfficialCardFile } from "../lib/official-card-time.js";
import { fetchScoreboard, fetchSummary } from "./fetch/espn.js";
import { formatYyyymmddInZone, parseBoxscore } from "./espn-parse.js";

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

async function loadFinalBoxes(now: Date): Promise<Map<string, Map<string, BoxLine>>> {
  const cache = new Map<string, unknown>();
  const boxesByGame = new Map<string, Map<string, BoxLine>>();
  for (let i = 0; i <= 5; i++) {
    const d = new Date(now.getTime() - i * 86400000);
    const et = formatYyyymmddInZone(d, ET);
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

function listOfficialCards(): OfficialCardFile[] {
  const cards: OfficialCardFile[] = [];
  if (!fs.existsSync(outDir)) return cards;
  for (const name of fs.readdirSync(outDir)) {
    const cardPath = path.join(outDir, name, "official-card.json");
    if (fs.existsSync(cardPath)) {
      cards.push(JSON.parse(fs.readFileSync(cardPath, "utf8")) as OfficialCardFile);
    }
  }
  return cards;
}

async function main() {
  restorePersistedDataFromBranch(rootDir);
  const now = new Date();
  const boxes = fixtureMode ? loadFixtureBoxes() : await loadFinalBoxes(now);
  const cards = listOfficialCards();
  const allLegs = [];
  for (const card of cards) {
    const { legs } = settleOfficialCard(card, boxes);
    allLegs.push(...legs);
  }

  const history = loadHistory(rootDir);
  const resultsPath = path.join(outDir, "results.json");
  let previous: ReturnType<typeof buildResultsJson> | null = null;
  if (fs.existsSync(resultsPath)) {
    previous = JSON.parse(fs.readFileSync(resultsPath, "utf8"));
  }
  const next = buildResultsJson({ officialLegs: allLegs, history, now });
  const unchanged =
    previous &&
    JSON.stringify(previous.legs) === JSON.stringify(next.legs) &&
    previous.updatedAt === next.updatedAt;
  if (!unchanged) {
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(resultsPath, JSON.stringify(next, null, 2));
    console.log(
      `settle: ${allLegs.length} official legs graded · W-${next.official.record.won} L-${next.official.record.lost} V-${next.official.record.void}`
    );
  } else {
    console.log("settle: idempotent — no changes");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});