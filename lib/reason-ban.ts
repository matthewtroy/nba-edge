/** Banned phrases in user-facing leg reason copy (templates only). */
export const BANNED_REASON_PHRASES = [
  "proxy",
  "(above",
  "line)",
  "l10 pts avg",
  "l10 reb avg",
  "l10 ast avg",
  "l10 3pm avg",
  "vs prior",
  "injury beneficiary",
  "boards shared",
  "vs 10+",
  "l5 vs prior",
  "voids if out",
] as const;

export function reasonTextHasBannedPhrase(text: string): string | null {
  const t = text.toLowerCase();
  const ordered = [...BANNED_REASON_PHRASES].sort((a, b) => b.length - a.length);
  for (const phrase of ordered) {
    if (t.includes(phrase.toLowerCase())) return phrase;
  }
  return null;
}

export function collectBannedReasonHits(
  picks: { reasons?: unknown[]; reasonLine?: string }[]
): { legId: string; phrase: string; text: string }[] {
  const hits: { legId: string; phrase: string; text: string }[] = [];
  for (const leg of picks) {
    const id = "id" in leg && typeof (leg as { id?: string }).id === "string"
      ? (leg as { id: string }).id
      : "?";
    const texts: string[] = [];
    if (Array.isArray(leg.reasons)) {
      for (const r of leg.reasons) {
        if (r && typeof r === "object" && "text" in r) {
          texts.push(String((r as { text: string }).text));
        }
      }
    }
    for (const text of texts) {
      const phrase = reasonTextHasBannedPhrase(text);
      if (phrase) hits.push({ legId: id, phrase, text });
    }
  }
  return hits;
}