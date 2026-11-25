import type { PickLeg } from "./types.js";

function legGameTeam(leg: PickLeg) {
  return { gameId: leg.gameId, team: leg.team };
}

function isReb(market: string) {
  return market === "reb" || market === "q1reb";
}
function isPts(market: string) {
  return market === "pts" || market === "q1pts";
}
function isAst(market: string) {
  return market === "ast" || market === "q1ast";
}

const MILESTONE_MARKETS = new Set(["dd", "td"]);

/** Two legs clash and must not be in the same multi */
export function legsClash(a: PickLeg, b: PickLeg): boolean {
  if (a.id === b.id) return true;

  // 6: same player except booster rungs and DD/TD — handled by caller for booster
  if (a.playerId === b.playerId) {
    const aM = MILESTONE_MARKETS.has(a.market);
    const bM = MILESTONE_MARKETS.has(b.market);
    if (!aM && !bM) return true;
    if (aM && bM && a.market !== b.market) return true;
  }

  if (a.gameId !== b.gameId) return false;

  // 3: two rebounds same game
  if (isReb(a.market) && isReb(b.market)) return true;

  // 1 & 2: reb vs pts/ast opposing team
  if (isReb(a.market) && (isPts(b.market) || isAst(b.market))) {
    if (a.team !== b.team) return true;
  }
  if (isReb(b.market) && (isPts(a.market) || isAst(a.market))) {
    if (a.team !== b.team) return true;
  }

  // 4: two points same team (same multi)
  if (isPts(a.market) && isPts(b.market) && a.team === b.team) return true;

  // 5: q1 pts + q1 ast same player
  if (
    a.playerId === b.playerId &&
    ((a.market === "q1pts" && b.market === "q1ast") ||
      (a.market === "q1ast" && b.market === "q1pts"))
  )
    return true;

  return false;
}

export function multiHasClash(legs: PickLeg[]): boolean {
  for (let i = 0; i < legs.length; i++) {
    for (let j = i + 1; j < legs.length; j++) {
      if (legsClash(legs[i], legs[j])) return true;
    }
  }
  return false;
}

export function describeClash(a: PickLeg, b: PickLeg): string {
  if (a.playerId === b.playerId && a.gameId === b.gameId) {
    return `${a.playerName}: same player twice`;
  }
  if (a.gameId !== b.gameId) return `${a.playerName} vs ${b.playerName}`;
  if (isReb(a.market) && isReb(b.market)) {
    return `${a.playerName} reb + ${b.playerName} reb (same game)`;
  }
  if (isReb(a.market) && (isPts(b.market) || isAst(b.market)) && a.team !== b.team) {
    return `reb (${a.playerName}) vs opp ${b.market} (${b.playerName})`;
  }
  if (isReb(b.market) && (isPts(a.market) || isAst(a.market)) && a.team !== b.team) {
    return `reb (${b.playerName}) vs opp ${a.market} (${a.playerName})`;
  }
  if (isPts(a.market) && isPts(b.market) && a.team === b.team) {
    return `two pts same team: ${a.playerName}, ${b.playerName}`;
  }
  if (a.playerId === b.playerId && a.market === "q1pts" && b.market === "q1ast") {
    return `${a.playerName} Q1 pts + Q1 ast`;
  }
  return `${a.playerName} ${a.market}${a.line}+ vs ${b.playerName} ${b.market}${b.line}+`;
}

/** Same-game SGM (Games tab + Best SGM): narrow rules only — no full multi clash set. */
export function sameGameSgmLegsClash(a: PickLeg, b: PickLeg): boolean {
  if (a.id === b.id) return true;
  if (a.gameId !== b.gameId) return false;

  if (a.playerId === b.playerId && a.market === b.market) return true;

  if (
    a.playerId === b.playerId &&
    ((a.market === "q1pts" && b.market === "q1ast") ||
      (a.market === "q1ast" && b.market === "q1pts"))
  ) {
    return true;
  }

  const reb = (m: string) => m === "reb" || m === "q1reb";
  if (
    reb(a.market) &&
    reb(b.market) &&
    a.team === b.team &&
    a.line >= 10 &&
    b.line >= 10
  ) {
    return true;
  }

  return false;
}

export function sameGameSgmHasClash(legs: PickLeg[]): boolean {
  for (let i = 0; i < legs.length; i++) {
    for (let j = i + 1; j < legs.length; j++) {
      if (sameGameSgmLegsClash(legs[i], legs[j])) return true;
    }
  }
  return false;
}

export function multiClashSummary(legs: PickLeg[]): string {
  for (let i = 0; i < legs.length; i++) {
    for (let j = i + 1; j < legs.length; j++) {
      if (legsClash(legs[i], legs[j])) {
        return describeClash(legs[i], legs[j]);
      }
    }
  }
  return "unknown clash";
}