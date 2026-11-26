import type { LiveBetView } from "./live-bet.js";
import type { LiveLegState, LiveLegView } from "./live-leg.js";

/** Right-side stat copy: `N ✓` / `N ✗` / live `N` — never Won/Lost/Hit words. */
export function legProgressRightLabel(view: LiveLegView): string | null {
  switch (view.state) {
    case "pending":
      return null;
    case "void":
      return "—";
    case "live":
      return view.actual != null ? String(view.actual) : "0";
    default:
      break;
  }
  if (view.actual == null) return "—";
  const n = view.actual;
  if (view.state === "won") return `${n} ✓`;
  if (view.state === "lost") return `${n} ✗`;
  return String(n);
}

/** Compact state glyph for the progress pill (no Won/Lost/Hit copy). */
export function legProgressPillSymbol(view: LiveLegView): string {
  switch (view.state) {
    case "won":
      return "✓";
    case "lost":
      return "✗";
    case "void":
      return "—";
    case "live":
      return "•";
    default:
      return "";
  }
}

export function legProgressValueTrackClass(valueAtBookie?: boolean): string {
  return valueAtBookie ? "leg-progress-value-track" : "";
}

export function legRowLiveTrackingClass(view: LiveLegView | undefined): string {
  if (!view || view.state === "pending" || view.state === "live") return "";
  switch (view.state) {
    case "won":
      return "leg-row-live-won";
    case "lost":
      return "leg-row-live-lost";
    default:
      return "";
  }
}

export function liveLegStateLabel(view: LiveLegView): string | null {
  const right = legProgressRightLabel(view);
  if (view.state === "live" && view.actual != null) {
    return `${view.actual}/${view.line}`;
  }
  return right;
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

export function legProgressRightClass(view: LiveLegView): string {
  switch (view.state) {
    case "won":
      return "text-emerald-400";
    case "lost":
      return "text-red-400";
    case "live":
      return "text-sky-300";
    case "void":
      return "text-white/40";
    default:
      return "text-white/55";
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

export function liveBetLandedLabel(view: LiveBetView): string | null {
  if (view.state === "pending" || view.total === 0) return null;
  return `${view.won} of ${view.total} landed`;
}

export function liveBetOutcomePill(
  view: LiveBetView
): { label: string; className: string } | null {
  switch (view.state) {
    case "won":
      return { label: "✓", className: "text-emerald-400 bg-emerald-400/12" };
    case "lost":
      return { label: "✗", className: "text-red-400 bg-red-400/12" };
    default:
      return null;
  }
}

export function betProgressSegmentClass(state: LiveLegState): string {
  switch (state) {
    case "won":
      return "bg-emerald-400/90";
    case "lost":
      return "bg-red-400/80";
    case "live":
      return "bg-sky-400/85 bet-progress-segment-live";
    case "void":
      return "bg-white/18";
    case "pending":
    default:
      return "bg-white/10";
  }
}

export function multiCardLiveBorderClass(view: LiveBetView | undefined): string {
  if (!view || view.state === "pending") return "";
  switch (view.state) {
    case "won":
      return "multi-card-live-won";
    case "lost":
      return "multi-card-live-lost";
    case "live":
      return "multi-card-live-tracking";
    default:
      return "";
  }
}

export function betProgressShouldShow(view: LiveBetView | undefined): boolean {
  return view != null && view.state !== "pending" && view.total > 0;
}