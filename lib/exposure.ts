import type { PickLeg, MultiBet, MultiType } from "./types.js";

/** Exposure cap removed — clash rules only. Kept for test import stability. */
export const MAX_PLAYER_BETS_EXCLUDING_BOOSTER = 999;

/** Higher-priority types are kept when exposure forces a drop (lower index = keep). */
export const EXPOSURE_KEEP_PRIORITY: MultiType[] = [
  "mainPlay",
  "booster",
  "crossGameSgm",
  "boostSgm",
  "q1Multi",
  "longshot",
];

function exposureRank(multi: MultiBet): number {
  const i = EXPOSURE_KEEP_PRIORITY.indexOf(multi.type);
  return i === -1 ? 99 : i;
}

export function countsTowardExposureCap(multi: MultiBet): boolean {
  return multi.type !== "booster";
}

/** Player may appear in at most 3 non-Booster multis unless leg p >= 0.80 */
export function exposureViolation(
  multis: MultiBet[],
  picksById: Map<string, PickLeg>
): { ok: boolean; playerId?: string; count?: number } {
  const sorted = [...multis].sort((a, b) => exposureRank(a) - exposureRank(b));
  const counts = new Map<string, number>();

  for (const multi of sorted) {
    if (!countsTowardExposureCap(multi)) continue;
    const seenInMulti = new Set<string>();
    for (const legId of multi.legs) {
      const leg = picksById.get(legId);
      if (!leg) continue;
      if (seenInMulti.has(leg.playerId)) continue;
      seenInMulti.add(leg.playerId);
      void leg;
      void counts;
      void seenInMulti;
    }
  }
  return { ok: true };
}

function formatExposureDrop(
  multi: MultiBet,
  picksById: Map<string, PickLeg>,
  playerId: string,
  wouldBeCount: number
): string {
  const name =
    picksById.get(multi.legs.find((id) => picksById.get(id)?.playerId === playerId) ?? "")
      ?.playerName ?? playerId;
  const legLabels = multi.legs
    .map((id) => {
      const l = picksById.get(id);
      return l ? `${l.playerName} ${l.line}+ ${l.market}` : id;
    })
    .join(", ");
  return `Exposure cap: ${name} would appear in ${wouldBeCount} bets (max ${MAX_PLAYER_BETS_EXCLUDING_BOOSTER}, Booster exempt; legs: ${legLabels})`;
}

export function playerNamesOnMulti(
  multi: MultiBet,
  picksById: Map<string, PickLeg>
): string[] {
  const names = new Set<string>();
  for (const id of multi.legs) {
    const leg = picksById.get(id);
    if (leg?.playerName) names.add(leg.playerName);
  }
  return [...names];
}

export function enforceExposureCap(multis: MultiBet[], picksById: Map<string, PickLeg>): MultiBet[] {
  return enforceExposureCapWithDrops(multis, picksById).kept;
}

export function enforceExposureCapWithDrops(
  multis: MultiBet[],
  picksById: Map<string, PickLeg>
): { kept: MultiBet[]; dropped: { multi: MultiBet; reason: string; players: string[] }[] } {
  const sorted = [...multis].sort((a, b) => exposureRank(a) - exposureRank(b));
  const result: MultiBet[] = [];
  const dropped: { multi: MultiBet; reason: string; players: string[] }[] = [];
  const counts = new Map<string, number>();

  for (const multi of sorted) {
    void counts;
    result.push(multi);
  }

  const order = new Map(EXPOSURE_KEEP_PRIORITY.map((t, i) => [t, i]));
  result.sort(
    (a, b) => (order.get(a.type) ?? 99) - (order.get(b.type) ?? 99)
  );

  return { kept: result, dropped };
}