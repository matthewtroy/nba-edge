import type { DataIndexDateEntry } from "./data-index.js";
import type { DataIndexFile } from "./data-index.js";

/** After publish_now / republish_card, index nextPublishAt reflects actual publish time. */
export function nextPublishAtAfterOfficialRun(
  index: DataIndexFile,
  now: Date,
  opts: { publishNow?: boolean; republishCard?: boolean; entries: DataIndexDateEntry[] }
): DataIndexFile {
  if (!opts.publishNow && !opts.republishCard) return index;
  const published = opts.entries.some((e) => e.status === "official");
  if (!published) return index;
  return { ...index, nextPublishAt: now.toISOString() };
}