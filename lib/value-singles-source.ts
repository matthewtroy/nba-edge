import type { MetaJson, PickLeg } from "./types.js";
import type { OfficialCardFile } from "./official-card-time.js";
import { freezeValueSingles, type FrozenValueSingle } from "./value-leg-track.js";

export type ValueSinglesSource =
  | { kind: "card" }
  | { kind: "preTip"; commit: string }
  | { kind: "currentPicks" };

/**
 * Singles come from the 9pm publish freeze on the card. Cards published before that
 * freeze existed fall back to the pinned pre-tip picks commit, then to picks on disk.
 */
export function valueSinglesForSlate(input: {
  card: Pick<OfficialCardFile, "valueSingles"> | null;
  meta: Pick<MetaJson, "reasonsFrozenFrom"> | null;
  currentPicks: PickLeg[];
  loadPicksAtCommit: (commit: string) => PickLeg[] | null;
}): { singles: FrozenValueSingle[]; source: ValueSinglesSource } {
  if (input.card?.valueSingles) {
    return { singles: input.card.valueSingles, source: { kind: "card" } };
  }
  const commit = input.meta?.reasonsFrozenFrom?.commit;
  if (commit) {
    const preTip = input.loadPicksAtCommit(commit);
    if (preTip?.length) {
      return { singles: freezeValueSingles(preTip), source: { kind: "preTip", commit } };
    }
  }
  return { singles: freezeValueSingles(input.currentPicks), source: { kind: "currentPicks" } };
}

export function valueSinglesSourceLabel(source: ValueSinglesSource): string {
  if (source.kind === "card") return "card publish freeze";
  if (source.kind === "preTip") return `pre-tip ${source.commit.slice(0, 7)}`;
  return "picks on disk";
}
