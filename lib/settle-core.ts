import type { Market, MultiType, PickLeg } from "./types.js";
import { gradeLegFromBox } from "./grading.js";
import type { BoxLine } from "../scripts/espn-parse.js";
import type { OfficialCardFile, OfficialLegSnapshot } from "./official-card-time.js";

export type CardLegResult = "won" | "lost" | "void" | "pending";
export type CardBetResult = "won" | "lost" | "void" | "pending";

export function boxStatForMarket(
  market: Market | string,
  box: BoxLine
): number | null {
  if (box.minutes <= 0) return null;
  switch (market) {
    case "pts":
      return box.pts;
    case "reb":
      return box.reb;
    case "ast":
      return box.ast;
    case "3pm":
      return box.threes;
    case "q1pts":
      return box.q1?.pts ?? null;
    case "q1reb":
      return box.q1?.reb ?? null;
    case "q1ast":
      return box.q1?.ast ?? null;
    default:
      return null;
  }
}

/**
 * Settle boxes hold final games only, so a player missing from a final box did not play:
 * a zero-minute line grades the leg void, as bookies do.
 */
export function finalPlayerBox(
  boxesByGame: Map<string, Map<string, BoxLine>>,
  gameId: string,
  playerId: string
): BoxLine | undefined {
  const game = boxesByGame.get(gameId);
  if (!game) return undefined;
  return game.get(playerId) ?? { playerId, minutes: 0, pts: 0, reb: 0, ast: 0, threes: 0 };
}

/** Multi price with void legs divided out; undefined when a void leg has no known price. */
export function voidAdjustedPrice(
  total: number,
  legIds: string[],
  legResults: Map<string, CardLegResult>,
  legPrice: (id: string) => number | undefined
): number | undefined {
  let price = total;
  for (const id of legIds) {
    if (legResults.get(id) !== "void") continue;
    const p = legPrice(id);
    if (p == null || p <= 1) return undefined;
    price /= p;
  }
  return Math.round(price * 100) / 100;
}

export function gradeOfficialLeg(
  snap: OfficialLegSnapshot,
  box: BoxLine | undefined
): { result: CardLegResult; actualValue: number | null } {
  if (!box) return { result: "pending", actualValue: null };
  const pick: PickLeg = {
    id: snap.id,
    gameId: snap.gameId,
    team: snap.team,
    opponent: snap.opponent ?? "",
    playerId: snap.playerId,
    playerName: snap.playerName,
    headshotUrl: snap.headshotUrl ?? "",
    market: snap.market as Market,
    line: snap.line,
    probability: snap.probability,
    fairPrice: snap.fairPrice,
    takeAt: snap.takeAt,
    tags: snap.tags ?? [],
    reasons: snap.reasons ?? [],
  };
  const graded = gradeLegFromBox(pick, box);
  const actual = boxStatForMarket(snap.market, box);
  if (graded === "void") return { result: "void", actualValue: actual };
  if (graded === "hit") return { result: "won", actualValue: actual };
  return { result: "lost", actualValue: actual };
}

export function settleMultiLegs(results: CardLegResult[]): CardBetResult {
  if (!results.length) return "void";
  const active = results.filter((r) => r !== "void");
  if (!active.length) return "void";
  if (active.some((r) => r === "lost")) return "lost";
  if (active.some((r) => r === "pending")) return "pending";
  return active.every((r) => r === "won") ? "won" : "lost";
}

export interface SettledLegRow {
  id: string;
  slateDate: string;
  betType: MultiType;
  playerName: string;
  market: string;
  line: number;
  result: CardLegResult;
  actualValue: number | null;
  probability: number;
  bestBookie?: string;
  bestPrice?: number;
  tags: string[];
}

export function settleOfficialCard(
  card: OfficialCardFile,
  boxesByGame: Map<string, Map<string, BoxLine>>
): {
  legs: SettledLegRow[];
  bets: { type: MultiType; legIds: string[]; result: CardBetResult }[];
} {
  const snaps = card.legSnapshots ?? {};
  const legResults = new Map<string, { result: CardLegResult; actualValue: number | null }>();
  const legs: SettledLegRow[] = [];

  for (const snap of Object.values(snaps)) {
    const box = finalPlayerBox(boxesByGame, snap.gameId, snap.playerId);
    const graded = gradeOfficialLeg(snap, box);
    legResults.set(snap.id, graded);
    const best = snap.bookiePrices
      ? Object.entries(snap.bookiePrices).sort((a, b) => b[1] - a[1])[0]
      : undefined;
    legs.push({
      id: snap.id,
      slateDate: card.slateDate,
      playerName: snap.playerName,
      market: snap.market,
      line: snap.line,
      result: graded.result,
      actualValue: graded.actualValue,
      probability: snap.probability,
      bestBookie: best?.[0],
      bestPrice: best?.[1],
      tags: snap.tags ?? [],
      betType: "mainPlay",
    });
  }

  const bets = card.multis.map((m) => {
    const results = m.legs.map((id) => legResults.get(id)?.result ?? "pending");
    return { type: m.type, legIds: m.legs, result: settleMultiLegs(results) };
  });

  for (const leg of legs) {
  const multi = card.multis.find((m) => m.legs.includes(leg.id));
    if (multi) leg.betType = multi.type;
  }

  return { legs, bets };
}