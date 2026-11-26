import type { SlateGame } from "./types.js";
import {
  gamePreviewsFromSlate,
  type DataIndexFile,
} from "./data-index.js";
import { planScoreboardSlates, pipelineSydneyDates } from "./slate-retention.js";
import { sydneyTipDate } from "./slate-today.js";
import { publishAtForNextSlate } from "./index-schedule.js";

export type ForwardSlateMetadata = Pick<
  DataIndexFile,
  "nextSlateDate" | "firstTipAt" | "games" | "nextPublishAt"
>;

/** Derive next-slate preview fields from a merged ESPN slate (after up-to-7d ET day scan). */
export function forwardSlateMetadataFromGames(
  merged: SlateGame[],
  now: Date
): ForwardSlateMetadata | null {
  if (!merged.length) return null;

  const { todayYmd, tomorrowYmd } = pipelineSydneyDates(now);
  const plan = planScoreboardSlates(merged, now);

  let targetYmd: string | null = null;
  let targetGames: SlateGame[] = [];

  if (plan.tomorrow.length) {
    targetYmd = tomorrowYmd;
    targetGames = plan.tomorrow;
  } else {
    const bySydney = new Map<string, SlateGame[]>();
    for (const g of merged) {
      const y = sydneyTipDate(g.startTime);
      if (y <= todayYmd) continue;
      const list = bySydney.get(y) ?? [];
      list.push(g);
      bySydney.set(y, list);
    }
    const next = [...bySydney.keys()].sort()[0];
    if (next) {
      targetYmd = next;
      targetGames = bySydney.get(next) ?? [];
    }
  }

  if (!targetYmd || !targetGames.length) return null;

  const tips = targetGames
    .map((g) => new Date(g.startTime).getTime())
    .filter(Number.isFinite);
  const firstTipAt =
    tips.length > 0 ? new Date(Math.min(...tips)).toISOString() : null;

  return {
    nextSlateDate: targetYmd,
    firstTipAt,
    games: gamePreviewsFromSlate(targetGames),
    nextPublishAt: publishAtForNextSlate(targetYmd, now),
  };
}

export function applyForwardMetadata(
  index: DataIndexFile,
  meta: ForwardSlateMetadata | null
): DataIndexFile {
  if (!meta) return index;
  return { ...index, ...meta };
}