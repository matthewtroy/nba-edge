import type { PickLeg } from "./types.js";
import { gradeLegFromBox } from "./grading.js";
import { boxStatForMarket, type CardLegResult } from "./settle-core.js";
import type { BoxLine } from "../scripts/espn-parse.js";

export interface GradedProjectionLeg {
  id: string;
  slateDate: string;
  playerId: string;
  playerName: string;
  gameId: string;
  market: string;
  line: number;
  result: CardLegResult;
  actualValue: number | null;
  probability: number;
  probabilityMatchupShadow?: number;
  fairPrice: number;
  bestPrice?: number;
  bestBookie?: string;
  tags: string[];
}

function hasPublishedPrice(leg: PickLeg): boolean {
  return (
    (leg.bestPrice != null && leg.bestPrice > 1) ||
    (leg.bookiePrices != null && Object.values(leg.bookiePrices).some((v) => v > 1))
  );
}

export function gradePickLeg(
  leg: PickLeg,
  slateDate: string,
  box: BoxLine | undefined
): GradedProjectionLeg | null {
  if (!hasPublishedPrice(leg)) return null;
  if (!box) {
    return {
      id: leg.id,
      slateDate,
      playerId: leg.playerId,
      playerName: leg.playerName,
      gameId: leg.gameId,
      market: leg.market,
      line: leg.line,
      result: "pending",
      actualValue: null,
      probability: leg.probability,
      probabilityMatchupShadow: leg.probabilityMatchupShadow,
      fairPrice: leg.fairPrice,
      bestPrice: leg.bestPrice,
      bestBookie: leg.bestBookie,
      tags: leg.tags ?? [],
    };
  }
  const graded = gradeLegFromBox(leg, box);
  const actual = boxStatForMarket(leg.market, box);
  let result: CardLegResult;
  if (graded === "void") result = "void";
  else if (graded === "hit") result = "won";
  else result = "lost";

  return {
    id: leg.id,
    slateDate,
    playerId: leg.playerId,
    playerName: leg.playerName,
    gameId: leg.gameId,
    market: leg.market,
    line: leg.line,
    result,
    actualValue: actual,
    probability: leg.probability,
    probabilityMatchupShadow: leg.probabilityMatchupShadow,
    fairPrice: leg.fairPrice,
    bestPrice: leg.bestPrice,
    bestBookie: leg.bestBookie,
    tags: leg.tags ?? [],
  };
}

export function gradePickCatalog(
  picks: PickLeg[],
  slateDate: string,
  boxesByGame: Map<string, Map<string, BoxLine>>
): GradedProjectionLeg[] {
  const out: GradedProjectionLeg[] = [];
  for (const leg of picks) {
    const box = boxesByGame.get(leg.gameId)?.get(leg.playerId);
    const row = gradePickLeg(leg, slateDate, box);
    if (row) out.push(row);
  }
  return out;
}