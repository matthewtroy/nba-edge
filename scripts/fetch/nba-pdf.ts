import pdf from "pdf-parse";

function easternYmd(d: Date): { y: string; mo: string; day: string } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const y = parts.find((p) => p.type === "year")?.value ?? "2026";
  const mo = parts.find((p) => p.type === "month")?.value ?? "01";
  const day = parts.find((p) => p.type === "day")?.value ?? "01";
  return { y, mo, day };
}

function urlCandidates(gameDate: Date): string[] {
  const { y, mo, day } = easternYmd(gameDate);
  const date = `${y}-${mo}-${day}`;
  const urls: string[] = [];
  for (let hour = 23; hour >= 0; hour--) {
    const h12 = hour % 12 || 12;
    const ampm = hour < 12 ? "AM" : "PM";
    const hh = String(h12).padStart(2, "0");
    urls.push(
      `https://ak-static.cms.nba.com/referee/injury/Injury-Report_${date}_${hh}${ampm}.pdf`
    );
    urls.push(
      `https://ak-static.cms.nba.com/referee/injury/Injury-Report_${date}_${hh}30${ampm}.pdf`
    );
  }
  return urls;
}

/** Try latest half-hour slots backwards for US Eastern game date */
export async function fetchLatestInjuryPdf(
  gameDate: Date
): Promise<{ text: string; url: string; triedUrls: string[] } | null> {
  const triedUrls = urlCandidates(gameDate);
  for (const url of triedUrls) {
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      const buf = Buffer.from(await res.arrayBuffer());
      const data = await pdf(buf);
      if (data.text?.trim().length > 50) {
        return { text: data.text, url, triedUrls };
      }
    } catch {
      continue;
    }
  }
  console.warn(
    `nbaOfficial: no injury PDF (${triedUrls.length} URLs tried, first: ${triedUrls[0]})`
  );
  return null;
}

export function parsePdfInjuries(text: string): { name: string; status: string }[] {
  const out: { name: string; status: string }[] = [];
  const statusRe = /(Out|Doubtful|Questionable|Probable)/gi;
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  for (const line of lines) {
    const m = line.match(statusRe);
    if (!m) continue;
    const status = m[0];
    const name = line.replace(statusRe, "").replace(/[,|]/g, "").trim();
    if (name.length > 3) out.push({ name, status: capitalizeStatus(status) });
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