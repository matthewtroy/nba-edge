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
  "per 48",
  "shot volume up",
  "minutes up",
  "league avg",
  "per game to",
  "pace ·",
] as const;

export function reasonTextHasBannedPhrase(text: string): string | null {
  const t = text.toLowerCase();
  if (/^pace .+ #\d+/i.test(text)) return "pace rank";
  const ordered = [...BANNED_REASON_PHRASES].sort((a, b) => b.length - a.length);
  for (const phrase of ordered) {
    if (t.includes(phrase.toLowerCase())) return phrase;
  }
  return null;
}

/** True when the same decimal appears on more than one line (ignores N/N form fractions). */
export function legReasonTextsShareDuplicateNumber(texts: string[]): boolean {
  const counts = new Map<string, number>();
  for (const text of texts) {
    const scrubbed = text.replace(/\d+\s*\/\s*\d+/g, " ");
    for (const m of scrubbed.matchAll(/\b(\d+\.\d+|\d+)\b/g)) {
      const key = Number(m[1]).toFixed(1);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  return [...counts.values()].some((c) => c > 1);
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