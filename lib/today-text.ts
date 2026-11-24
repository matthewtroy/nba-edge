import type { MetaJson, MultiBet, MultiNotBuilt, PickLeg, SlateGame } from "./types.js";
import { marketLabel } from "./market-label.js";

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
  lines.push("");

  for (const line of (input.meta.whatChanged ?? []).slice(0, 3)) {
    lines.push(`What changed: ${line}`);
  }
  if ((input.meta.whatChanged ?? []).length) lines.push("");

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
    if (multi.smallSlateNote) lines.push("Small slate");
    const title = multi.variant ? `${multi.label} (${multi.variant})` : multi.label;
    lines.push(title);
    lines.push(
      `  Take ${multi.combinedTakeAt.toFixed(2)}+ · Fair ${multi.combinedFairPrice.toFixed(2)} · ~1 in ${multi.oneInX}`
    );
    if (multi.combinedBestPrice != null && multi.combinedBestBookie) {
      lines.push(
        `  At ${multi.combinedBestBookie}: ${multi.combinedBestPrice.toFixed(2)}+ (single bookie)`
      );
    }
    const legs = multi.legs
      .map((id) => input.picksById.get(id))
      .filter(Boolean) as PickLeg[];
    for (const leg of legs) {
      const extra =
        leg.bestPrice != null
          ? ` · Best: ${leg.bestBookie} ${leg.bestPrice.toFixed(2)}`
          : "";
      lines.push(
        `  ${leg.playerName} ${marketLabel(leg.market, leg.line)} · Take ${leg.takeAt.toFixed(2)}+${extra}`
      );
    }
    lines.push("");
  }

  if (input.gateViolations?.length) {
    lines.push("Gate violations");
    for (const v of input.gateViolations) lines.push(`  • ${v}`);
  } else {
    lines.push("Gate violations: none");
  }

  return lines.join("\n").trim();
}