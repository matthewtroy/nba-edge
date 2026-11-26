import type { PickLeg, ReasonAtTipSnapshot, SlateGame } from "./types.js";
import { gameStarted } from "./slate-tip-freeze.js";
import { gateLegReasons } from "./reason-gate.js";

export function refreshReasonsAtTip(
  existing: ReasonAtTipSnapshot[] | undefined,
  picks: PickLeg[],
  slate: SlateGame[],
  now: Date
): ReasonAtTipSnapshot[] {
  const byId = new Map<string, ReasonAtTipSnapshot>();
  for (const row of existing ?? []) {
    byId.set(row.id, row);
  }
  for (const game of slate) {
    if (!gameStarted(game, now)) continue;
    for (const leg of picks) {
      if (leg.gameId !== game.id) continue;
      const reasons = gateLegReasons(leg.reasons ?? [], leg.market, 3, leg.line);
      byId.set(leg.id, {
        id: leg.id,
        gameId: leg.gameId,
        reasons,
        reasonLine: leg.reasonLine,
      });
    }
  }
  return [...byId.values()];
}

export function reasonsAtTipByLegId(
  atTip: ReasonAtTipSnapshot[] | undefined
): Map<string, ReasonAtTipSnapshot> {
  return new Map((atTip ?? []).map((r) => [r.id, r]));
}