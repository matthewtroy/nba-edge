export const ODDS_CORE_MARKETS = [
  "player_points",
  "player_rebounds",
  "player_assists",
  "player_points_alternate",
  "player_rebounds_alternate",
  "player_assists_alternate",
] as const;

export const ODDS_THREES_MARKETS = [
  "player_threes",
  "player_threes_alternate",
] as const;

export interface OddsCoverageJson {
  pulledAt: string;
  eventsProbed: number;
  marketsRequested: string[];
  marketsPresent: Record<string, number>;
  uniquePlayersByCoreMarket: Record<string, number>;
  corePlayerLines: number;
  threesPlayerLines: number;
  onlyThreesOffered: boolean;
  note?: string;
}

function normMarket(key: string): string {
  let m = key.replace("player_", "").replace("_alternate", "");
  if (m === "threes") return "3pm";
  if (m === "points") return "pts";
  if (m === "rebounds") return "reb";
  if (m === "assists") return "ast";
  return m;
}

export function buildOddsCoverage(
  events: unknown[],
  pulledAt: string
): OddsCoverageJson {
  const marketsPresent: Record<string, number> = {};
  const playersByCore: Record<string, Set<string>> = {
    pts: new Set(),
    reb: new Set(),
    ast: new Set(),
    "3pm": new Set(),
  };
  let threesLines = 0;
  let coreLines = 0;

  for (const ev of events) {
    if (!ev) continue;
    const e = ev as {
      id?: string;
      bookmakers?: { markets?: { key: string; outcomes?: { description?: string }[] }[] }[];
    };
    for (const bm of e.bookmakers ?? []) {
      for (const m of bm.markets ?? []) {
        marketsPresent[m.key] = (marketsPresent[m.key] ?? 0) + 1;
        const nk = normMarket(m.key);
        const nPlayers = new Set(
          (m.outcomes ?? [])
            .map((o) => o.description?.trim())
            .filter(Boolean) as string[]
        );
        if (nk === "pts" || nk === "reb" || nk === "ast") {
          coreLines += nPlayers.size;
          for (const p of nPlayers) playersByCore[nk].add(p);
        }
        if (nk === "3pm") threesLines += nPlayers.size;
      }
    }
  }

  const hasPts = (marketsPresent.player_points ?? 0) + (marketsPresent.player_points_alternate ?? 0) > 0;
  const hasReb = (marketsPresent.player_rebounds ?? 0) + (marketsPresent.player_rebounds_alternate ?? 0) > 0;
  const hasAst = (marketsPresent.player_assists ?? 0) + (marketsPresent.player_assists_alternate ?? 0) > 0;
  const hasThrees =
    (marketsPresent.player_threes ?? 0) + (marketsPresent.player_threes_alternate ?? 0) > 0;
  const onlyThreesOffered = hasThrees && !hasPts && !hasReb && !hasAst;

  const uniquePlayersByCoreMarket: Record<string, number> = {
    pts: playersByCore.pts.size,
    reb: playersByCore.reb.size,
    ast: playersByCore.ast.size,
  };

  let note: string | undefined;
  if (onlyThreesOffered) {
    note = "Bookmakers returned threes-only props; pts/reb/ast missing — check API plan or slate.";
  } else if (!hasPts && !hasReb && !hasAst && events.length > 0) {
    note = "No player prop markets returned on probed events.";
  }

  return {
    pulledAt,
    eventsProbed: events.filter(Boolean).length,
    marketsRequested: [...ODDS_CORE_MARKETS, ...ODDS_THREES_MARKETS],
    marketsPresent,
    uniquePlayersByCoreMarket,
    corePlayerLines: coreLines,
    threesPlayerLines: threesLines,
    onlyThreesOffered,
    note,
  };
}