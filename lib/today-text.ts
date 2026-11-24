import type { MetaJson, MultiBet, MultiNotBuilt, PickLeg, SlateGame } from "./types.js";
import {
  assertNoForbiddenStrings,
  formatLegLine,
  formatMultiHeadline,
} from "./multi-card-text.js";

function formatSydneyTime(iso: string): string {
  return new Date(iso).toLocaleString("en-AU", {
    timeZone: "Australia/Sydney",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export function renderTodayText(input: {
  meta: MetaJson;
  slate: SlateGame[];
  multis: MultiBet[];
  notBuilt: MultiNotBuilt[];
  picksById: Map<string, PickLeg>;
  gateViolations?: string[];
}): string {
  const lines: string[] = [];
  const stale = Object.values(input.meta.sources).some(
    (s) => s === "stale" || s === "paused" || String(s).includes("paused")
  );

  lines.push("Today");
  lines.push(
    `${input.slate.length} games · Updated ${formatSydneyTime(input.meta.lastUpdated)}${
      input.meta.oddsLastPulled
        ? ` · Odds from ${formatSydneyTime(input.meta.oddsLastPulled)}`
        : ""
    }${stale ? " · (stale)" : ""}`
  );

  if (input.meta.smallSlate) {
    lines.push("Small slate");
  }
  lines.push("");

  const changed = input.meta.whatChanged ?? [];
  if (changed.length) {
    lines.push("What changed");
    for (const line of changed.slice(0, 3)) lines.push(`  ${line}`);
  } else {
    lines.push("What changed");
    lines.push("  (none)");
  }
  lines.push("");

  if (input.notBuilt.length) {
    lines.push(`Not built today (${input.notBuilt.length})`);
    for (const n of input.notBuilt) {
      lines.push(
        `  ${n.label}${n.variant ? ` (${n.variant})` : ""}: ${n.reason}`
      );
    }
    lines.push("");
  }

  for (const multi of input.multis) {
    const title = multi.variant ? `${multi.label} (${multi.variant})` : multi.label;
    lines.push(title);
    lines.push(`  ${formatMultiHeadline(multi)}`);
    if (multi.combinedBestPrice != null && multi.combinedBestBookie) {
      lines.push(
        `  ${multi.combinedBestBookie} $${multi.combinedBestPrice.toFixed(2)}+ (all legs)`
      );
    }
    const legs = multi.legs
      .map((id) => input.picksById.get(id))
      .filter(Boolean) as PickLeg[];
    for (const leg of legs) lines.push(`  ${formatLegLine(leg)}`);
    lines.push("");
  }

  const violations = input.gateViolations?.filter(Boolean) ?? [];
  if (violations.length) {
    lines.push("Gate violations");
    for (const v of violations) lines.push(`  • ${v}`);
  } else {
    lines.push("Gate violations: none");
  }

  const text = lines.join("\n").trim();
  assertNoForbiddenStrings(text);
  return text;
}