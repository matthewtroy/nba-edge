import type { HistoryJson, HistoryLeg, HistoryMulti, MultiBet, PickLeg } from "../lib/types.js";
import { gradeLegFromBox, computeCalibration } from "../lib/grading.js";
import type { BoxLine } from "./espn-parse.js";

export function appendRecommendations(
  history: HistoryJson,
  picks: PickLeg[],
  multis: MultiBet[],
  date: string
): HistoryJson {
  const legIds = new Set(history.legs.map((l) => `${l.id}|${l.date}`));
  const multiIds = new Set(history.multis.map((m) => `${m.type}|${m.date}|${m.legIds.join()}`));

  for (const leg of picks) {
    const key = `${leg.id}|${date}`;
    if (!legIds.has(key)) {
      history.legs.push({
        id: leg.id,
        date,
        probability: leg.probability,
        playerId: leg.playerId,
        gameId: leg.gameId,
        market: leg.market,
        line: leg.line,
      });
    }
  }

  for (const m of multis) {
    const key = `${m.type}|${date}|${m.legs.join()}`;
    if (!multiIds.has(key)) {
      history.multis.push({
        id: `${m.type}-${date}`,
        type: m.type,
        date,
        legIds: m.legs,
      });
    }
  }

  return history;
}

function legForGrade(h: HistoryLeg, picksById: Map<string, PickLeg>): PickLeg | null {
  const fromPicks = picksById.get(h.id);
  if (fromPicks) return fromPicks;
  if (h.market && h.line != null && h.playerId && h.gameId) {
    return {
      id: h.id,
      gameId: h.gameId,
      team: "",
      opponent: "",
      playerId: h.playerId,
      playerName: "",
      headshotUrl: "",
      market: h.market,
      line: h.line,
      probability: h.probability,
      fairPrice: 0,
      takeAt: 0,
      tags: [],
      reasons: [],
    };
  }
  return null;
}

export function gradeOpenLegs(
  history: HistoryJson,
  picksById: Map<string, PickLeg>,
  boxesByGame: Map<string, Map<string, BoxLine>>
): HistoryJson {
  const now = new Date().toISOString();
  for (const h of history.legs) {
    if (h.result) continue;
    const leg = legForGrade(h, picksById);
    if (!leg) continue;
    const boxGame = boxesByGame.get(leg.gameId);
    const line = boxGame?.get(leg.playerId);
    if (!line) continue;
    h.result = gradeLegFromBox(leg, line);
    h.gradedAt = now;
  }

  for (const m of history.multis) {
    if (m.result) continue;
    const legs = m.legIds.map((id) => history.legs.find((l) => l.id === id && l.date === m.date));
    if (legs.some((l) => !l?.result)) continue;
    const anyMiss = legs.some((l) => l?.result === "miss");
    const anyVoid = legs.every((l) => l?.result === "void");
    m.result = anyVoid ? "partial" : anyMiss ? "miss" : "hit";
    m.gradedAt = now;
  }

  history.calibration = computeCalibration(history.legs);
  return history;
}