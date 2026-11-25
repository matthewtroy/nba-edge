import type { MetaJson, MultiBet, MultiNotBuilt, PickLeg, SlateGame } from "./types.js";
import { auditMultisForToday } from "./audit-multis.js";
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
  /** @deprecated use audit from auditMultisForToday */
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
    const bestTotal = multi.bestBookieTotal ?? multi.combinedBestPrice;
    const bestBook = multi.bestBookie ?? multi.combinedBestBookie;
    if (bestTotal != null && bestBook === "Best across books") {
      lines.push(
        `  Best multi odds: $${bestTotal.toFixed(2)}+ (cross-book — not one placeable multi)`
      );
    } else if (bestTotal != null && bestBook) {
      lines.push(`  Best multi odds: ${bestBook} $${bestTotal.toFixed(2)}+`);
    }
    const legs = multi.legs
      .map((id) => input.picksById.get(id))
      .filter(Boolean) as PickLeg[];
    for (const leg of legs) lines.push(`  ${formatLegLine(leg)}`);
    lines.push("");
  }

  const audit = auditMultisForToday({
    multis: input.multis,
    picksById: input.picksById,
    meta: input.meta,
  });
  if (audit.length) {
    lines.push("Audit");
    for (const v of audit) lines.push(`  • ${v}`);
  } else {
    lines.push("Audit: ok (one bookie where shown, take-at, no Check news)");
  }

  const text = lines.join("\n").trim();
  assertNoForbiddenStrings(text);
  return text;
}