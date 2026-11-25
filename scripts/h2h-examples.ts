import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import type { PickLeg, SlateGame } from "../lib/types.js";
import { loadGameLogCache } from "../lib/game-log-cache.js";
import { filterH2hLogs, h2hReasonPhrase } from "../lib/h2h-reason.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

function loadJson<T>(p: string): T {
  return JSON.parse(fs.readFileSync(p, "utf8")) as T;
}

function opponentTeamIdForLeg(leg: PickLeg, slate: SlateGame[]): string | undefined {
  const game = slate.find((g) => g.id === leg.gameId);
  if (!game) return undefined;
  return leg.team === game.homeTeam ? game.awayTeamId : game.homeTeamId;
}

function main(): void {
  const slateDate = process.argv[2] ?? "2026-11-26";
  const picks = loadJson<PickLeg[]>(path.join(root, "public/data", slateDate, "picks.json"));
  const slate = loadJson<SlateGame[]>(path.join(root, "public/data", slateDate, "slate.json"));
  const cache = loadGameLogCache(path.join(root, "public/data"));
  const examples: {
    player: string;
    market: string;
    line: number;
    opponent: string;
    meetings: number;
    text: string;
  }[] = [];

  const sengun = picks.find(
    (l) => /sengün|sengun/i.test(l.playerName) && l.market === "ast"
  );
  if (sengun) {
    const logs = cache[sengun.playerId]?.logs ?? [];
    const oppId = opponentTeamIdForLeg(sengun, slate);
    const meetings = oppId ? filterH2hLogs(logs, oppId, sengun.opponent).length : 0;
    const text =
      oppId &&
      h2hReasonPhrase({
        logs,
        playerId: sengun.playerId,
        defendingTeamId: oppId,
        market: sengun.market,
        line: sengun.line,
        opponentName: sengun.opponent,
        seasonAvg: sengun.seasonAvg,
      });
    examples.push({
      player: sengun.playerName,
      market: sengun.market,
      line: sengun.line,
      opponent: sengun.opponent,
      meetings,
      text:
        text ??
        (meetings < 3
          ? `No h2h copy (${meetings} ESPN meetings vs ${sengun.opponent} in cache; need ≥3)`
          : "No standout pattern"),
    });
  }

  for (const leg of picks) {
    if (examples.length >= 5) break;
    const logs = cache[leg.playerId]?.logs ?? [];
    const oppId = opponentTeamIdForLeg(leg, slate);
    if (!oppId) continue;
    const meetings = filterH2hLogs(logs, oppId, leg.opponent).length;
    if (meetings < 3) continue;
    const text = h2hReasonPhrase({
      logs,
      playerId: leg.playerId,
      defendingTeamId: oppId,
      market: leg.market,
      line: leg.line,
      opponentName: leg.opponent,
      seasonAvg: leg.seasonAvg,
    });
    if (!text) continue;
    const key = `${leg.playerId}:${leg.market}:${leg.line}`;
    if (examples.some((e) => `${e.player}:${e.market}:${e.line}` === key)) continue;
    examples.push({
      player: leg.playerName,
      market: leg.market,
      line: leg.line,
      opponent: leg.opponent,
      meetings,
      text,
    });
  }

  console.log(JSON.stringify({ slateDate, examples: examples.slice(0, 5) }, null, 2));
}

main();