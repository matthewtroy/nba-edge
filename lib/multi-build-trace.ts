import type { MultiType } from "./types.js";

export interface MultiBuildTrace {
  type: MultiType;
  variant?: string;
  eligible: number;
  bestEdgePool: number;
  bestBookie?: string;
  clashCandidates: number;
  rangeCandidates: number;
  built: boolean;
  detail: string;
}

const traces: MultiBuildTrace[] = [];

export function resetMultiBuildTraces(): void {
  traces.length = 0;
}

export function pushMultiBuildTrace(t: MultiBuildTrace): void {
  traces.push(t);
}

export function getMultiBuildTraces(): MultiBuildTrace[] {
  return [...traces];
}