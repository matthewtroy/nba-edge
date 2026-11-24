import pdf from "pdf-parse";

const NBA_PDF_UA =
  "Mozilla/5.0 (compatible; NBAEdge/1.0; +https://github.com/matthewtroy/nba-edge)";
const NBA_PDF_BASE =
  "https://ak-static.cms.nba.com/referee/injury/Injury-Report";

/** League switched to 15-minute stems at 2025-12-22 09:00 US Eastern */
const NEW_FORMAT_ET = "2025-12-22T09:00:00";

export interface PdfTryLog {
  url: string;
  status: number;
  method: "HEAD" | "GET";
}

export interface PdfFetchResult {
  text: string;
  url: string;
  tryLog: PdfTryLog[];
  playersParsed: number;
}

function easternParts(d: Date): {
  y: number;
  mo: number;
  day: number;
  hour: number;
  minute: number;
  ymd: string;
} {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "numeric",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const y = Number(parts.find((p) => p.type === "year")?.value ?? 2026);
  const mo = Number(parts.find((p) => p.type === "month")?.value ?? 1);
  const day = Number(parts.find((p) => p.type === "day")?.value ?? 1);
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  const ymd = `${y}-${String(mo).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  return { y, mo, day, hour, minute, ymd };
}

function slotUsesNewFormat(ymd: string, hour: number, minute: number): boolean {
  const slotKey = `${ymd}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00`;
  return slotKey >= NEW_FORMAT_ET;
}

/** Public for tests — mirrors nbainjuries _gen_url rules */
export function buildInjuryReportUrl(
  ymd: string,
  hour24: number,
  minute: number
): string {
  const h12 = hour24 % 12 || 12;
  const ampm = hour24 < 12 ? "AM" : "PM";
  const hh = String(h12).padStart(2, "0");
  if (slotUsesNewFormat(ymd, hour24, minute)) {
    const mm = String(minute).padStart(2, "0");
    return `${NBA_PDF_BASE}_${ymd}_${hh}_${mm}${ampm}.pdf`;
  }
  return `${NBA_PDF_BASE}_${ymd}_${hh}${ampm}.pdf`;
}

function listCandidateSlots(now: Date, maxDays = 2): { ymd: string; hour: number; minute: number }[] {
  const cur = easternParts(now);
  const curMins = cur.hour * 60 + cur.minute;
  const step = cur.ymd >= "2025-12-22" ? 15 : 30;
  const rounded = Math.floor(curMins / step) * step;

  const slots: { ymd: string; hour: number; minute: number }[] = [];
  for (let dayOff = 0; dayOff < maxDays; dayOff++) {
    const base = new Date(now.getTime() - dayOff * 86_400_000);
    const { ymd } = easternParts(base);
    const stopMins = dayOff === 0 ? rounded : 24 * 60 - step;
    for (let m = stopMins; m >= 0; m -= step) {
      const hour = Math.floor(m / 60);
      const minute = m % 60;
      if (!slotUsesNewFormat(ymd, hour, minute) && minute === 30) {
        continue;
      }
      slots.push({ ymd, hour, minute });
    }
  }
  const seen = new Set<string>();
  return slots.filter((s) => {
    const key = `${s.ymd}|${s.hour}|${s.minute}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function downloadInjuryPdf(
  url: string,
  tryLog: PdfTryLog[]
): Promise<Buffer | null> {
  const opts = {
    headers: { "User-Agent": NBA_PDF_UA, Accept: "application/pdf,*/*" },
    redirect: "follow" as const,
  };
  try {
    const head = await fetch(url, { method: "HEAD", ...opts });
    tryLog.push({ url, status: head.status, method: "HEAD" });
  } catch {
    tryLog.push({ url, status: 0, method: "HEAD" });
  }
  try {
    const get = await fetch(url, { ...opts });
    tryLog.push({ url, status: get.status, method: "GET" });
    if (!get.ok) return null;
    const buf = Buffer.from(await get.arrayBuffer());
    if (buf.length < 200) return null;
    return buf;
  } catch {
    tryLog.push({ url, status: 0, method: "GET" });
    return null;
  }
}

/** Fetch newest available official injury PDF (US Eastern slots). */
export type PdfFetchOutcome =
  | { ok: true; result: PdfFetchResult }
  | { ok: false; tryLog: PdfTryLog[] };

export async function fetchLatestInjuryPdf(
  gameDate: Date
): Promise<PdfFetchOutcome> {
  const tryLog: PdfTryLog[] = [];
  const slots = listCandidateSlots(gameDate);

  for (const slot of slots) {
    const url = buildInjuryReportUrl(slot.ymd, slot.hour, slot.minute);
    const buf = await downloadInjuryPdf(url, tryLog);
    if (!buf) continue;

    try {
      const data = await pdf(buf);
      const text = data.text?.trim() ?? "";
      if (text.length < 80) {
        console.warn(`nbaOfficial: PDF empty at ${url}`);
        continue;
      }
      const players = parsePdfInjuries(text);
      if (players.length < 3) {
        console.warn(
          `nbaOfficial: parse thin (${players.length} players) at ${url}`
        );
        continue;
      }
      console.log(
        `nbaOfficial: ok ${url} (${players.length} players, ${tryLog.length} probes)`
      );
      return { ok: true, result: { text, url, tryLog, playersParsed: players.length } };
    } catch (e) {
      console.warn(
        `nbaOfficial: parse failed ${url}:`,
        e instanceof Error ? e.message : e
      );
    }
  }

  const last = tryLog[tryLog.length - 1];
  console.warn(
    `nbaOfficial: no report after ${tryLog.length} probes` +
      (last ? ` last ${last.status} ${last.url}` : "")
  );
  for (const row of tryLog) {
    console.warn(`  ${row.status} ${row.method} ${row.url}`);
  }
  return { ok: false, tryLog };
}

/** Parse "Last,FirstStatus" tuples from flattened PDF text */
export function parsePdfInjuries(text: string): { name: string; status: string }[] {
  const out: { name: string; status: string }[] = [];
  const seen = new Set<string>();
  const re =
    /([A-Za-z][A-Za-z'’\-\.]+),([A-Za-z][A-Za-z'’\-\.]*?)(Out|Doubtful|Questionable|Probable|Available)/g;
  for (const m of text.matchAll(re)) {
    const name = `${m[2].trim()} ${m[1].trim()}`.replace(/\s+/g, " ");
    if (name.length < 4) continue;
    const status = capitalizeStatus(m[3]);
    const key = `${name}|${status}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ name, status });
  }
  return out;
}

function capitalizeStatus(s: string) {
  const lower = s.toLowerCase();
  if (lower === "out") return "Out";
  if (lower === "doubtful") return "Doubtful";
  if (lower === "questionable") return "Questionable";
  if (lower === "probable") return "Probable";
  return "Available";
}