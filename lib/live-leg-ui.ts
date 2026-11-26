import type { LiveBetView } from "./live-bet.js";
import type { LiveLegView } from "./live-leg.js";

export function liveLegChipLabel(view: LiveLegView): string | null {
  switch (view.state) {
    case "won":
      return view.actual != null ? `Hit ${view.actual}` : "Hit";
    case "lost":
      return view.actual != null ? `Miss ${view.actual}` : "Miss";
    case "live":
      return view.actual != null ? `Live ${view.actual}/${view.line}` : "Live";
    case "void":
      return "Void";
    default:
      return null;
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