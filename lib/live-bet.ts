import type { LiveLegState } from "./live-leg.js";

export type LiveBetState = "pending" | "live" | "won" | "lost";

export interface LiveBetView {
  state: LiveBetState;
  /** Active legs excluding void */
  total: number;
  won: number;
  lost: number;
  live: number;
  pending: number;
  voided: number;
  /** Share of active legs already at or past line (won) while multi still live */
  progress: number | null;
}

export function liveBetView(legStates: LiveLegState[]): LiveBetView {
  const voided = legStates.filter((s) => s === "void").length;
  const active = legStates.filter((s) => s !== "void");
  const total = active.length;
  const won = active.filter((s) => s === "won").length;
  const lost = active.filter((s) => s === "lost").length;
  const live = active.filter((s) => s === "live").length;
  const pending = active.filter((s) => s === "pending").length;

  const base: LiveBetView = {
    state: "pending",
    total,
    won,
    lost,
    live,
    pending,
    voided,
    progress: null,
  };

  if (!active.length) {
    return { ...base, state: "pending" };
  }

  if (lost > 0) {
    return { ...base, state: "lost", progress: won / Math.max(1, total) };
  }

  if (total > 0 && won === total) {
    return { ...base, state: "won", progress: 1 };
  }

  if (live > 0 || (won > 0 && (pending > 0 || live > 0))) {
    const progress = (won + live * 0.5) / Math.max(1, total);
    return { ...base, state: "live", progress };
  }

  if (pending === total) {
    return { ...base, state: "pending", progress: 0 };
  }

  if (won > 0 && pending === 0 && live === 0) {
    return { ...base, state: "won", progress: 1 };
  }

  return { ...base, state: "live", progress: won / Math.max(1, total) };
}

/** Settle-style roll-up: lost is immediate; void excluded from totals */
export function activeLegStates(states: LiveLegState[]): LiveLegState[] {
  return states.filter((s) => s !== "void");
}