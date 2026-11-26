import type { PickLeg, ReasonsFrozenFrom, SlateGame } from "./types.js";
import type { OfficialCardFile } from "./official-card-time.js";
import { freezeGamesSgms } from "./games-sgm-freeze.js";
import { freezeValueSingles } from "./value-leg-track.js";

/**
 * Cards published before a publish-time freeze existed get it from the pinned pre-tip
 * picks commit, with the same builders and stakes. Fields already frozen are never rebuilt.
 */
export function backfillCardFreezes(
  card: OfficialCardFile,
  preTip: { frozenFrom: ReasonsFrozenFrom; slate: SlateGame[]; picks: PickLeg[] }
): { card: OfficialCardFile; added: ("gamesSgms" | "valueSingles")[] } {
  const added: ("gamesSgms" | "valueSingles")[] = [];
  const next: OfficialCardFile = { ...card };
  if (!card.gamesSgms) {
    next.gamesSgms = freezeGamesSgms(preTip.slate, preTip.picks);
    added.push("gamesSgms");
  }
  if (!card.valueSingles) {
    next.valueSingles = freezeValueSingles(preTip.picks);
    added.push("valueSingles");
  }
  if (added.length) {
    next.freezeBackfill = {
      commit: preTip.frozenFrom.commit,
      committedAt: preTip.frozenFrom.committedAt,
      fields: [...(card.freezeBackfill?.fields ?? []), ...added],
    };
  }
  return { card: next, added };
}
