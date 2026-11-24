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

/** Two legs clash and must not be in the same multi */
export function legsClash(a: PickLeg, b: PickLeg): boolean {
  if (a.id === b.id) return true;

  // 6: same player except booster rungs and combo — handled by caller for booster
  if (a.playerId === b.playerId) {
  const comboMarkets = new Set(["dd", "td", "combo"]);
    if (!(comboMarkets.has(a.market) || comboMarkets.has(b.market))) {
      return true;
    }
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