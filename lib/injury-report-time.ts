import type { InjuryEntry } from "./types.js";

/** ET instant encoded in NBA injury-report PDF URL (newest reportTime wins). */
export function injuryReportTimeFromPdfUrl(url: string): string | null {
  const m = url.match(/Injury-Report_(\d{4}-\d{2}-\d{2})_(\d{1,2})_(\d{2})?(AM|PM)\.pdf/i);
  if (!m) {
    const legacy = url.match(/Injury-Report_(\d{4}-\d{2}-\d{2})_(\d{1,2})(AM|PM)\.pdf/i);
    if (!legacy) return null;
    const [, ymd, hh, ampm] = legacy;
    return etReportIso(ymd, Number(hh), 0, ampm);
  }
  const [, ymd, hh, mm, ampm] = m;
  return etReportIso(ymd, Number(hh), Number(mm ?? 0), ampm);
}

function etReportIso(ymd: string, hour12: number, minute: number, ampm: string): string {
  let h = hour12 % 12;
  if (ampm.toUpperCase() === "PM") h += 12;
  const [y, mo, d] = ymd.split("-").map(Number);
  const probe = new Date(Date.UTC(y, mo - 1, d, 12, 0, 0));
  const offsetMin = easternOffsetMinutes(probe);
  const utcMs =
    Date.UTC(y, mo - 1, d, h, minute, 0) + offsetMin * 60_000;
  return new Date(utcMs).toISOString();
}

function easternOffsetMinutes(d: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    timeZoneName: "shortOffset",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const off = parts.find((p) => p.type === "timeZoneName")?.value ?? "GMT-5";
  const m = off.match(/GMT([+-])(\d+)(?::(\d+))?/);
  if (!m) return 5 * 60;
  const sign = m[1] === "-" ? 1 : -1;
  const hrs = Number(m[2]);
  const mins = Number(m[3] ?? 0);
  return sign * (hrs * 60 + mins);
}

export function injuryEntryRecencyMs(entry: InjuryEntry): number {
  const t = entry.reportTime ?? entry.updatedAt;
  const ms = Date.parse(t);
  return Number.isFinite(ms) ? ms : 0;
}

export function newerInjuryEntry(a: InjuryEntry, b: InjuryEntry): InjuryEntry {
  return injuryEntryRecencyMs(a) >= injuryEntryRecencyMs(b) ? a : b;
}