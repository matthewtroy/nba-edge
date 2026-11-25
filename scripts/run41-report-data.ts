#!/usr/bin/env tsx
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { probeNbaStats } from "../lib/nba-tracking-probe.js";
import { loadTrackingCache } from "../lib/player-tracking-cache.js";
import { buildEspnTrackingCache } from "../lib/player-tracking-espn.js";
import { normalizeLegReasons, reasonTexts } from "../lib/leg-reason-types.js";
import { createSupabaseClient, syncRunToSupabase } from "./supabase-sync.js";
import type { SlateGame } from "../lib/types.js";
import { readFileSync } from "fs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const date = process.argv[2] ?? "2026-11-26";
const dir = path.join(root, "public/data", date);

function read<T>(f: string): T {
  return JSON.parse(readFileSync(path.join(dir, f), "utf8")) as T;
}

async function main() {
  const probe = await probeNbaStats(8000);
  let tracking = loadTrackingCache(root, date);
  if (!tracking) {
    const picks = read<import("../lib/types.js").PickLeg[]>("picks.json");
    const players = [
      ...new Map(
        picks.map((p) => [
          p.playerId,
          {
            id: p.playerId,
            name: p.playerName,
            gameLogs: [] as import("../lib/types.js").PlayerGameLog[],
            teamId: "",
            teamName: p.team,
            gameId: p.gameId,
            opponent: p.opponent,
            headshotUrl: p.headshotUrl,
            position: "",
            age: 0,
          },
        ])
      ).values(),
    ];
    tracking = buildEspnTrackingCache(root, date, players as never);
  }

  const picks = read<import("../lib/types.js").PickLeg[]>("picks.json");
  const multis = read<{ bets: import("../lib/types.js").MultiBet[] }>("multis.json");
  const probDeltas = picks
    .filter((p) => p.modelProbability != null)
    .slice(0, 20)
    .map((p) => ({
      player: p.playerName,
      market: `${p.market} ${p.line}+`,
      modelP: p.modelProbability,
      finalP: p.probability,
      deltaPp: Math.round((p.probability - (p.modelProbability ?? p.probability)) * 1000) / 10,
    }))
    .slice(0, 5);

  const reasonSamples = picks
    .flatMap((p) =>
      reasonTexts(normalizeLegReasons(p.reasons)).slice(0, 2).map((text) => ({
        player: p.playerName,
        market: p.market,
        text,
      }))
    )
    .slice(0, 10);

  const longshots = multis.bets.filter((b) => b.type === "longshot");

  let supabase = { failed: ["skipped"], counts: {} as Record<string, number> };
  const conn = await createSupabaseClient(root);
  if (conn.client) {
    const slate = read<SlateGame[]>("slate.json");
    const result = await syncRunToSupabase(conn.client, {
      slateDate: date,
      slate,
      injuries: read("injuries.json"),
      players: [],
      ranking: [],
      picks,
    });
    supabase = { failed: result.failed, counts: result.counts as unknown as Record<string, number> };
  }

  const lines = [
    `# Run #41 report — ${date}`,
    "",
    "## Tracking",
    `- nba.com probe: **${probe.status}**${probe.detail ? ` (${probe.detail})` : ""}`,
    `- cache: ${tracking.nbaStatus} · ${Object.keys(tracking.players).length} players`,
    "",
    "## Prob deltas (sample)",
    ...probDeltas.map(
      (d) => `- ${d.player} ${d.market}: model ${d.modelP?.toFixed(3)} → final ${d.finalP.toFixed(3)} (${d.deltaPp}pp)`
    ),
    "",
    "## Longshots",
    ...longshots.map(
      (m) =>
        `- ${m.label}${m.variant ? ` (${m.variant})` : ""}: ${m.legs.length} legs @ ${m.bestBookie} $${m.bestBookieTotal?.toFixed(2)}`
    ),
    longshots.length ? "" : "- (none in cached multis)",
    "",
    "## Supabase sync (mock/dry)",
    `- failed: ${supabase.failed.length ? supabase.failed.join(", ") : "none"}`,
    `- counts: injuries ${supabase.counts.injuries ?? 0}, logs ${supabase.counts.logs ?? 0}, defense ${supabase.counts.defenseRows ?? 0}, pace ${supabase.counts.paceRows ?? 0}`,
    "",
    "## Reason samples (10)",
    ...reasonSamples.map((s) => `- ${s.player} ${s.market}: ${s.text}`),
  ];
  const out = lines.join("\n");
  console.log(out);
  return out;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});