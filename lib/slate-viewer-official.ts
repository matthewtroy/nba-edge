import type { DataIndexFile } from "./data-index.js";
import type { OfficialCardFile } from "./official-card-time.js";
import type { SlatePublicationStatus } from "./slate-publication.js";

const PUBLISHED_STATUSES: ReadonlySet<SlatePublicationStatus> = new Set([
  "official",
  "locked_at_tip",
]);

export function indexSlatePublished(
  index: DataIndexFile | null | undefined,
  slateDate: string
): boolean {
  const entry = index?.dates.find((d) => d.date === slateDate);
  return entry != null && PUBLISHED_STATUSES.has(entry.status);
}

/** Viewer shows frozen official card when index marks the slate official (not the countdown clock). */
export function viewerUsesOfficialCard(opts: {
  index: DataIndexFile | null | undefined;
  officialCard: OfficialCardFile | null | undefined;
  slateDate: string;
  slateTipDate?: string | null;
}): boolean {
  const { index, officialCard, slateDate, slateTipDate } = opts;
  const cardDate = officialCard?.slateDate;
  if (!officialCard || !cardDate) return false;
  const matches =
    cardDate === slateDate || (slateTipDate != null && cardDate === slateTipDate);
  if (!matches) return false;
  if (indexSlatePublished(index, cardDate)) return true;
  return Boolean(officialCard.publishedAt);
}