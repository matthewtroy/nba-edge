#!/usr/bin/env npx tsx
/** Rebuild leg reasons from origin/data caches (no odds, no public/data writes). */
import { execSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import type { DefenseRatingsBundle, PickLeg, SlateGame } from "../lib/types.js";
import type { GameLogCacheFile } from "../lib/game-log-cache.js";
import type { TrackingCacheFile } from "../lib/player-tracking-cache.js";
import { stampLegacyLogSources } from "../lib/game-log-cache.js";
import { buildLegReasons } from "../lib/leg-reason-builder.js";
import { gateLegReasons } from "../lib/reason-gate.js";
import { ensureLegReasonMinimum } from "../lib/leg-reason-minimum.js";
import { sampleLegsByMarket } from "../lib/reason-histogram.js";
import { normalizeLegReasons, reasonTexts } from "../lib/leg-reason-types.js";
import { filterPicksWithSupportiveReasons } from "../lib/picks-supportive-filter.js";
import { logSupportiveExclusionsByMarket } from "../lib/leg-reason-supportive.js";

const date = process.argv[2] ?? "2026-11-28";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function fromData(rel: string): string {
  return execSync(`git show origin/data:${rel}`, {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 80_000_000,
  });
}

function positionHint(reasons: PickLeg["reasons"]): string | undefined {
  for (const r of normalizeLegReasons(reasons ?? [])) {
    const t = r.text.toLowerCase();
    if (t.includes("forwards")) return "F";
    if (t.includes("centers")) return "C";
    if (t.includes("guards")) return "G";
  }
  return undefined;
}

function teamIdsForPick(gameId: string, teamName: string, slate: SlateGame[]): {
  playerTeamId?: string;
  defendingTeamId?: string;
} {
  const game = slate.find((g) => g.id === gameId);
  if (!game) return {};
  const home = game.homeTeam === teamName;
  const away = game.awayTeam === teamName;
  if (!home && !away) return {};
  return {
    playerTeamId: home ? game.homeTeamId : game.awayTeamId,
    defendingTeamId: home ? game.awayTeamId : game.homeTeamId,
  };
}

const picks = JSON.parse(fromData(`public/data/${date}/picks.json`)) as PickLeg[];
const slate = JSON.parse(fromData(`public/data/${date}/slate.json`)) as SlateGame[];
const defense = JSON.parse(fromData("public/data/defense-ratings.json")) as DefenseRatingsBundle;
const gameLogCache = JSON.parse(fromData("public/data/game-log-cache.json")) as GameLogCacheFile;
for (const row of Object.values(gameLogCache)) {
  row.logs = stampLegacyLogSources(row.logs);
}
const tracking = JSON.parse(
  fromData(`public/data/tracking/${date}.json`)
) as TrackingCacheFile;

const rebuilt: PickLeg[] = [];
for (const leg of picks) {
  const cacheRow = gameLogCache[leg.playerId];
  const logs = cacheRow?.logs ?? [];
  const game = slate.find((g) => g.id === leg.gameId);
  const home = game?.homeTeam === leg.team;
  const b2b = home ? game?.homeB2B : game?.awayB2B;
  const { playerTeamId, defendingTeamId } = teamIdsForPick(leg.gameId, leg.team, slate);
  const injurySeeds = normalizeLegReasons(leg.reasons ?? []).filter((r) => r.type === "injury");
  const reasons = buildLegReasons({
    leg: { ...leg, b2b: b2b === true ? true : leg.b2b },
    logs,
    h2hLogs: logs,
    seasonAvg: leg.seasonAvg,
    defense,
    defendingTeamId,
    playerTeamId,
    playerPosition: positionHint(leg.reasons),
    teamName: leg.team,
    opponentName: leg.opponent,
    tracking: tracking.players[leg.playerId],
    seedReasons: injurySeeds,
    playerId: leg.playerId,
  });
  const gated = gateLegReasons(reasons, leg.market, 3, leg.line);
  const display = ensureLegReasonMinimum(leg, gated);
  rebuilt.push({ ...leg, reasons: display, reasonLine: reasonTexts(display).slice(0, 3).join(" · ") });
}

const kept = filterPicksWithSupportiveReasons(rebuilt);
logSupportiveExclusionsByMarket(rebuilt, kept);

const hist: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0 };
for (const leg of kept) {
  const n = ensureLegReasonMinimum(leg, leg.reasons ?? []).length;
  const bucket = n > 3 ? 3 : n;
  hist[bucket] = (hist[bucket] ?? 0) + 1;
}
console.log(
  `Rebuilt ${rebuilt.length} legs for ${date} · kept ${kept.length} with supportive · reason counts ${JSON.stringify(hist)}`
);

let opponentInjury = 0;
let restB2b = 0;
let longShot = 0;
for (const leg of kept) {
  const lines = ensureLegReasonMinimum(leg, leg.reasons ?? []);
  if (lines.some((r) => /without .+ →/i.test(r.text))) opponentInjury += 1;
  if (lines.some((r) => /on a back-to-back/i.test(r.text))) restB2b += 1;
  if (leg.probability < 0.25) longShot += 1;
}
console.log(`opponent-injury lines: ${opponentInjury} · b2b context: ${restB2b} · long-shot legs kept: ${longShot}`);

const samples = sampleLegsByMarket(kept, 3);
for (const market of ["pts", "reb", "ast", "3pm"] as const) {
  console.log(`\n${market.toUpperCase()}`);
  for (const leg of samples[market] ?? []) {
    const lines = reasonTexts(ensureLegReasonMinimum(leg, leg.reasons ?? []));
    console.log(`- ${leg.playerName} ${leg.line}+ (p=${leg.probability.toFixed(2)}) — ${lines.join(" · ") || "(none)"}`);
  }
}