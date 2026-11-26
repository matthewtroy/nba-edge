const SYDNEY = "Australia/Sydney";

/** 21:00 Australia/Sydney on the calendar eve before a slate folder date (YYYY-MM-DD). */
export function nextSydneyPublishIsoBeforeSlate(slateYmd: string): string {
  const anchor = new Date(`${slateYmd}T12:00:00.000Z`);
  const eveMs = anchor.getTime() - 86_400_000;
  const eveYmd = new Date(eveMs).toLocaleDateString("en-CA", { timeZone: SYDNEY });
  const eveStart = new Date(`${eveYmd}T00:00:00.000Z`).getTime();
  const stepMs = 60_000;
  for (let t = eveStart; t < eveStart + 86_400_000; t += stepMs) {
    const d = new Date(t);
    const parts = new Intl.DateTimeFormat("en-AU", {
      timeZone: SYDNEY,
      hour: "numeric",
      minute: "numeric",
      hour12: false,
    }).formatToParts(d);
    const hour = Number(parts.find((p) => p.type === "hour")?.value ?? -1);
    const minute = Number(parts.find((p) => p.type === "minute")?.value ?? -1);
    if (hour === 21 && minute === 0) {
      return d.toISOString();
    }
  }
  return new Date(eveStart + 10 * 3_600_000).toISOString();
}

/**
 * Publish countdown for a future slate folder: 21:00 Sydney on the eve before `slateYmd`,
 * or the next future 21:00 Sydney when that eve is already past.
 */
export function publishAtForNextSlate(slateYmd: string, now = new Date()): string {
  const eve = nextSydneyPublishIsoBeforeSlate(slateYmd);
  if (new Date(eve).getTime() > now.getTime()) return eve;
  const upcoming = nextSydneyPublishIso(now);
  if (new Date(upcoming).getTime() > now.getTime()) return upcoming;
  return eve;
}

/** Next 21:00 Australia/Sydney as UTC ISO (pipeline official-card window). */
export function nextSydneyPublishIso(now = new Date()): string {
  const stepMs = 60_000;
  const horizon = now.getTime() + 48 * 3_600_000;
  for (let t = now.getTime() + stepMs; t < horizon; t += stepMs) {
    const d = new Date(t);
    const parts = new Intl.DateTimeFormat("en-AU", {
      timeZone: SYDNEY,
      hour: "numeric",
      minute: "numeric",
      hour12: false,
    }).formatToParts(d);
    const hour = Number(parts.find((p) => p.type === "hour")?.value ?? -1);
    const minute = Number(parts.find((p) => p.type === "minute")?.value ?? -1);
    if (hour === 21 && minute === 0) {
      return d.toISOString();
    }
  }
  const fallback = new Date(now.getTime() + 3 * 3_600_000);
  return fallback.toISOString();
}