const SYDNEY = "Australia/Sydney";

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