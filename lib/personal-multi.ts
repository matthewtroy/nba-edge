import type { MultiBet, PickLeg } from "./types.js";
import { multiHasClash } from "./clash.js";
import { combinedFairAndTakeAt } from "./multi-combined.js";

export interface PersonalMultiDraft {
  id: string;
  label: string;
  legIds: string[];
  createdAt: string;
}

export function buildPersonalMultiBet(
  draft: PersonalMultiDraft,
  picksById: Map<string, PickLeg>
): MultiBet | null {
  const legs = draft.legIds.map((id) => picksById.get(id)).filter(Boolean) as PickLeg[];
  if (legs.length < 2 || legs.length !== draft.legIds.length) return null;
  if (multiHasClash(legs)) return null;
  const { p, fair, takeAt } = combinedFairAndTakeAt(legs);
  return {
    type: "mainPlay",
    label: draft.label,
    legs: draft.legIds,
    combinedProbability: p,
    combinedFairPrice: fair,
    combinedTakeAt: takeAt,
    bookieTotals: {},
    summary: "Personal multi",
    variant: "Personal",
  };
}

export function personalMultiPrice(legs: PickLeg[]): number {
  return combinedFairAndTakeAt(legs).fair;
}