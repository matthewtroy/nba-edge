import type { PickLeg, SlateGame } from "./types.js";
import { gradeLegFromBox } from "./grading.js";
import { boxStatForMarket } from "./settle-core.js";
import type { BoxLine } from "../scripts/espn-parse.js";
import { isGameFinal, isGameLive } from "./slate-game-ui.js";

export type LiveLegState = "pending" | "live" | "won" | "lost" | "void";

export interface LiveLegView {
  state: LiveLegState;
  actual: number | null;
  line: number;
  /** 0–1 toward clearing the line while still live */
  progress: number | null;
}

function isQ1Market(market: string): boolean {
  return market.startsWith("q1");
}

/** True while Q1 counting still matters for q1* markets */
export function q1TrackingOpen(
  game: SlateGame,
  period: number | null,
  statusDetail?: string
): boolean {
  const s = `${game.status} ${statusDetail ?? ""}`.toLowerCase();
  if (isGameFinal(s)) return false;
  if (period != null && period > 1) return false;
  if (s.includes("q2") || s.includes("q3") || s.includes("q4") || s.includes("halftime")) {
    return false;
  }
  return isGameLive(s) || s.includes("q1") || s.includes("1st");
}

export function liveLegView(
  leg: PickLeg,
  game: SlateGame | undefined,
  box: BoxLine | undefined,
  ctx?: { period?: number | null; statusDetail?: string }
): LiveLegView {
  const line = leg.line;
  const base = { line, actual: null as number | null, progress: null as number | null };

  if (!game || (!isGameLive(game.status) && !isGameFinal(game.status))) {
    return { ...base, state: "pending" };
  }

  if (!box) {
    if (isGameFinal(game.status)) return { ...base, state: "pending" };
    return { ...base, state: "live", progress: 0 };
  }

  if (box.minutes <= 0) {
    return { ...base, state: "void", actual: null, progress: null };
  }

  const actual = boxStatForMarket(leg.market, box);

  if (isQ1Market(leg.market)) {
    const q1Open = q1TrackingOpen(game, ctx?.period ?? null, ctx?.statusDetail);
    if (actual != null && actual >= line) {
      return { state: "won", actual, line, progress: 1 };
    }
    if (!q1Open) {
      const won = actual != null && actual >= line;
      return { state: won ? "won" : "lost", actual, line, progress: null };
    }
    const progress =
      actual != null && line > 0 ? Math.min(0.99, actual / line) : 0;
    return { state: "live", actual, line, progress };
  }

  if (actual != null && actual >= line) {
    return { state: "won", actual, line, progress: 1 };
  }

  if (isGameFinal(game.status)) {
    const graded = gradeLegFromBox(leg, box);
    if (graded === "void") return { state: "void", actual, line, progress: null };
    return {
      state: graded === "hit" ? "won" : "lost",
      actual,
      line,
      progress: null,
    };
  }

  const progress =
    actual != null && line > 0 ? Math.min(0.99, actual / line) : 0;
  return { state: "live", actual, line, progress };
}