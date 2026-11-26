import type { LiveBetView } from "./live-bet.js";
import type { LiveLegView } from "./live-leg.js";

export function liveLegStateLabel(view: LiveLegView): string | null {
  switch (view.state) {
    case "won":
      return "Won";
    case "lost":
      return "Lost";
    case "void":
      return "Void";
    case "live":
      return view.actual != null ? `Live ${view.actual}/${view.line}` : "Live";
    case "pending":
      return "Pending";
    default:
      return null;
  }
}

/** @deprecated Use liveLegStateLabel — kept for share capture code paths. */
export function liveLegChipLabel(view: LiveLegView): string | null {
  const label = liveLegStateLabel(view);
  return view.state === "pending" ? null : label;
}

export function legProgressFillPercent(view: LiveLegView): number {
  if (view.state === "won") return 100;
  if (view.line <= 0) return 0;
  if (view.state === "void") return 0;
  const ratio =
    view.progress != null
      ? view.progress
      : view.actual != null
        ? view.actual / view.line
        : 0;
  if (view.state === "live") return Math.min(99, Math.max(0, ratio * 100));
  if (view.state === "lost") return Math.min(100, Math.max(0, ratio * 100));
  return 0;
}

export function legProgressMarkerPercent(line: number): number {
  return line > 0 ? 100 : 0;
}

export function legProgressPillClass(view: LiveLegView): string {
  switch (view.state) {
    case "won":
      return "text-emerald-400 bg-emerald-400/12";
    case "lost":
      return "text-red-400 bg-red-400/12";
    case "live":
      return "text-sky-400 bg-sky-400/12";
    case "void":
      return "text-white/40 bg-white/8";
    case "pending":
      return "text-white/35 bg-white/5";
    default:
      return "";
  }
}

export function legProgressFillClass(view: LiveLegView): string {
  switch (view.state) {
    case "won":
      return "bg-emerald-400/85";
    case "lost":
      return "bg-red-400/70";
    case "live":
      return "bg-sky-400/80";
    case "void":
      return "bg-white/20";
    default:
      return "bg-white/15";
  }
}

export function liveLegChipClass(view: LiveLegView): string {
  switch (view.state) {
    case "won":
      return "text-emerald-400 bg-emerald-400/10";
    case "lost":
      return "text-red-400 bg-red-400/10";
    case "live":
      return "text-sky-400 bg-sky-400/10";
    case "void":
      return "text-white/35 bg-white/5";
    default:
      return "";
  }
}

export function liveBetHeaderLabel(view: LiveBetView): string | null {
  switch (view.state) {
    case "won":
      return "Multi won";
    case "lost":
      return "Multi lost";
    case "live":
      return `Tracking ${view.won + view.live}/${view.total}`;
    case "pending":
      return null;
    default:
      return null;
  }
}