/** Reason copy is never truncated in the builder or display backfill (UI uses break-words). */
export function houseReasonText(text: string): string {
  return text.trim().replace(/\s+/g, " ");
}

export function houseReasonLine(text: string): string {
  return houseReasonText(text);
}