import type { InjuryEntry, PickLeg, SlateGame } from "./types.js";
import { isOutOrDoubtful } from "./injury-match.js";
import { displayPlayerName } from "./player-names.js";
import { buildWhatChanged } from "./what-changed.js";

const BOOST_RE =
  /\+\s*(\d+(?:\.\d+)?)\s*(pts|points|reb|rebounds|ast|assists|threes|3pm)/i;

export interface GameInjuryRank {
  gameId: string;
  matchup: string;
  score: number;
  summary: string;
}

function gameMatchup(g: SlateGame): string {
  return `${g.awayTeam} @ ${g.homeTeam}`;
}

function injuryScoreForGame(
  game: SlateGame,
  injuries: InjuryEntry[],
  picks: PickLeg[]
): { score: number; blurb: string } {
  const teamIds = new Set([game.homeTeamId, game.awayTeamId]);
  const gameInjuries = injuries.filter(
    (i) => teamIds.has(i.teamId) && isOutOrDoubtful(i.status)
  );
  if (!gameInjuries.length) return { score: 0, blurb: "no major outs" };

  const gamePicks = picks.filter((p) => p.gameId === game.id);
  let score = 0;
  const parts: string[] = [];

  for (const inj of gameInjuries) {
    let best = 0;
    let bestLine = "";
    for (const leg of gamePicks) {
      if (leg.team !== inj.teamName) continue;
      for (const r of leg.reasons) {
        const text = typeof r === "string" ? r : r.text;
        if (!text.toLowerCase().includes(inj.playerName.split(" ").pop()!.toLowerCase())) continue;
        const m = text.match(BOOST_RE);
        if (!m) continue;
        const d = Number(m[1]);
        if (d > best) {
          best = d;
          const stat = m[2].startsWith("pt") ? "pts" : m[2].slice(0, 3);
          bestLine = `${displayPlayerName(inj.playerName)} out → ${displayPlayerName(leg.playerName)} +${m[1]} ${stat}`;
        }
      }
    }
    if (best > 0) {
      score += best;
      parts.push(bestLine);
    }
  }

  if (!parts.length) {
    const lines = buildWhatChanged(gameInjuries, gamePicks, 2, {
      slateGameIds: new Set([game.id]),
    });
    for (const line of lines) {
      const m = line.match(BOOST_RE);
      if (m) score += Number(m[1]);
      parts.push(line);
    }
  }

  const blurb = parts[0] ?? "injury angle";
  return { score, blurb };
}

/** Rank slate games by injury redistribution angle; tiebreak higher game total. */
export function rankGamesByInjuryAngle(
  slate: SlateGame[],
  injuries: InjuryEntry[],
  picks: PickLeg[]
): GameInjuryRank[] {
  const ranked: GameInjuryRank[] = [];
  for (const g of slate) {
    const { score, blurb } = injuryScoreForGame(g, injuries, picks);
    ranked.push({
      gameId: g.id,
      matchup: gameMatchup(g),
      score: Math.round(score * 10) / 10,
      summary: `score ${score.toFixed(1)} (${blurb})`,
    });
  }
  ranked.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const ga = slate.find((g) => g.id === a.gameId);
    const gb = slate.find((g) => g.id === b.gameId);
    return (gb?.total ?? 0) - (ga?.total ?? 0);
  });
  return ranked;
}

export function logGameInjuryRanks(ranked: GameInjuryRank[]): void {
  for (const r of ranked) {
    console.log(`${r.matchup}: ${r.summary}`);
  }
}