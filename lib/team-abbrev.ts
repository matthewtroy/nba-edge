import type { SlateGame } from "./types.js";

/** Full ESPN displayName → NBA tricode (stable for matchup subtitles). */
const NAME_TO_TRICODE: Record<string, string> = {
  "Atlanta Hawks": "ATL",
  "Boston Celtics": "BOS",
  "Brooklyn Nets": "BKN",
  "Charlotte Hornets": "CHA",
  "Chicago Bulls": "CHI",
  "Cleveland Cavaliers": "CLE",
  "Dallas Mavericks": "DAL",
  "Denver Nuggets": "DEN",
  "Detroit Pistons": "DET",
  "Golden State Warriors": "GSW",
  "Houston Rockets": "HOU",
  "Indiana Pacers": "IND",
  "LA Clippers": "LAC",
  "Los Angeles Clippers": "LAC",
  "Los Angeles Lakers": "LAL",
  "Memphis Grizzlies": "MEM",
  "Miami Heat": "MIA",
  "Milwaukee Bucks": "MIL",
  "Minnesota Timberwolves": "MIN",
  "New Orleans Pelicans": "NOP",
  "New York Knicks": "NYK",
  "Oklahoma City Thunder": "OKC",
  "Orlando Magic": "ORL",
  "Philadelphia 76ers": "PHI",
  "Phoenix Suns": "PHX",
  "Portland Trail Blazers": "POR",
  "Sacramento Kings": "SAC",
  "San Antonio Spurs": "SAS",
  "Toronto Raptors": "TOR",
  "Utah Jazz": "UTA",
  "Washington Wizards": "WAS",
};

export function teamTricode(fullName: string): string {
  const hit = NAME_TO_TRICODE[fullName.trim()];
  if (hit) return hit;
  const parts = fullName.trim().split(/\s+/);
  const last = parts[parts.length - 1] ?? fullName;
  return last.slice(0, 3).toUpperCase();
}

export function slateMatchupAbbrev(game: Pick<SlateGame, "awayTeam" | "homeTeam">): string {
  return `${teamTricode(game.awayTeam)} @ ${teamTricode(game.homeTeam)}`;
}

export function slateMatchupWithTip(
  game: Pick<SlateGame, "awayTeam" | "homeTeam" | "startTimeSydney">
): string {
  const matchup = slateMatchupAbbrev(game);
  const tip = game.startTimeSydney?.trim();
  return tip ? `${matchup} · ${tip}` : matchup;
}