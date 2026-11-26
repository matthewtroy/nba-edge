import type { MultiBet, PickLeg, SlateGame } from "./types.js";
import { applySlateTipFreeze } from "./slate-tip-freeze.js";

/** Client-side: merging a poll refresh must not drop started-game legs/prices. */
export function mergeViewerBundleOnRefresh(input: {
  previous: {
    slate: SlateGame[];
    picks: PickLeg[];
    multis: MultiBet[];
  };
  incoming: {
    slate: SlateGame[];
    picks: PickLeg[];
    multis: MultiBet[];
  };
  now?: Date;
}): { slate: SlateGame[]; picks: PickLeg[]; multis: MultiBet[] } {
  const now = input.now ?? new Date();
  return applySlateTipFreeze({
    previousSlate: input.previous.slate,
    incomingSlate: input.incoming.slate,
    previousPicks: input.previous.picks,
    incomingPicks: input.incoming.picks,
    previousMultis: input.previous.multis,
    incomingMultis: input.incoming.multis,
    now,
  });
}