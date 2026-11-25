import type { MultiBet, PickLeg } from "./types.js";
import { combinedBetPrice } from "./multis.js";
import { multiHasClash } from "./clash.js";

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
  const p = legs.reduce((acc, l) => acc * l.probability, 1);
  const fair = Math.round((1 / p) * 100) / 100;
  const takeAt = Math.round(legs.reduce((acc, l) => acc * l.takeAt, 1) * 100) / 100;
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
  return combinedBetPrice(legs);
}