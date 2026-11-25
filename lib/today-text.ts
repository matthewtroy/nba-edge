import type { MetaJson, MultiBet, MultiNotBuilt, PickLeg, SlateGame } from "./types.js";
import type { OfficialCardFile } from "./official-card.js";
import { OFFICIAL_CARD_BOOKIE } from "./official-card.js";
import { auditMultisForToday } from "./audit-multis.js";
import { assertNoForbiddenStrings } from "./multi-card-text.js";
import { multiCardTitle } from "./multi-combined.js";
import { formatLegCardLine } from "./leg-card-odds.js";
import { verifyTakeAtIsFairEdge } from "./multi-card-text.js";

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
  officialCard?: OfficialCardFile | null;
}): string {
  const official = input.officialCard;
  const useOfficial = official != null;
  const multis = useOfficial ? official!.multis : input.multis;
  const notBuilt = useOfficial ? official!.notBuilt : input.notBuilt;
  const whatChanged = useOfficial ? official!.whatChanged : input.meta.whatChanged;
  const cardBookie =
    (useOfficial ? official!.bookie : undefined) ??
    input.meta.officialCard?.bookie ??
    OFFICIAL_CARD_BOOKIE;
  const lines: string[] = [];
  const stale = Object.values(input.meta.sources).some(
    (s) => s === "stale" || s === "paused" || String(s).includes("paused")
  );

  lines.push("Today");
  if (input.meta.slateStatusLabel) {
    lines.push(input.meta.slateStatusLabel);
  }
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

  if (useOfficial && official) {
    const pub = official.publishedAt ?? official.lockedAt;
    lines.push(`Official card · Published ${formatSydneyTime(pub)} · ${cardBookie}`);
    lines.push("");
  }

  const changed = whatChanged ?? [];
  if (changed.length) {
    lines.push("What changed");
    for (const line of changed.slice(0, 3)) lines.push(`  ${line}`);
  } else {
    lines.push("What changed");
    lines.push("  (none)");
  }
  lines.push("");

  if (notBuilt.length) {
    lines.push(`Not built today (${notBuilt.length})`);
    for (const n of notBuilt) {
      lines.push(
        `  ${n.label}${n.variant ? ` (${n.variant})` : ""}: ${n.reason}`
      );
    }
    lines.push("");
  }

  for (const multi of multis) {
    const legs = multi.legs
      .map((id) => input.picksById.get(id))
      .filter(Boolean) as PickLeg[];
    if (!legs.length || multi.bestBookieTotal == null || !multi.bestBookie) continue;
    if (legs.length) verifyTakeAtIsFairEdge(multi, legs);
    const { headline, subline, cardBookie: multiBookie } = multiCardTitle(multi, legs);
    lines.push(`  ${headline}`);
    lines.push(`  ${subline}`);
    for (const leg of legs) {
      lines.push(formatLegCardLine(leg, multiBookie));
    }
    lines.push("");
  }

  const audit = auditMultisForToday({
    multis,
    picksById: input.picksById,
    meta: input.meta,
  });
  if (audit.length) {
    lines.push("Audit");
    for (const v of audit) lines.push(`  • ${v}`);
  } else {
    lines.push("Audit: ok (one AU bookie, no Check news)");
  }

  const text = lines.join("\n").trim();
  assertNoForbiddenStrings(text);
  return text;
}