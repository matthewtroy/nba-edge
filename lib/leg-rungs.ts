import type { PickLeg } from "./types.js";

export function siblingRungs(picks: PickLeg[], leg: PickLeg): PickLeg[] {
  return picks
    .filter((p) => p.playerId === leg.playerId && p.market === leg.market)
    .sort((a, b) => a.line - b.line);
}

export function rungStepIndex(rungs: PickLeg[], leg: PickLeg): number {
  return rungs.findIndex((r) => r.id === leg.id);
}