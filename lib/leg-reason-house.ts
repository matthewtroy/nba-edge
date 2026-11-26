/** Target copy length on leg rows (tests allow REASON_TEXT_MAX). */
export const REASON_TEXT_AIM = 40;
export const REASON_TEXT_MAX = 48;

/** Trim reason copy to house length without cutting mid-word when possible. */
export function houseReasonText(text: string, max = REASON_TEXT_AIM): string {
  const t = text.trim().replace(/\s+/g, " ");
  if (t.length <= max) return t;
  const slice = t.slice(0, max);
  const lastSpace = slice.lastIndexOf(" ");
  if (lastSpace > max * 0.6) return slice.slice(0, lastSpace).trim();
  return slice.trim();
}

export function houseReasonLine(text: string, max = REASON_TEXT_AIM): string {
  return houseReasonText(text, max);
}