import pdf from "pdf-parse";

/** Try latest half-hour slots backwards for US Eastern game date */
export async function fetchLatestInjuryPdf(gameDate: Date): Promise<{ text: string; url: string } | null> {
  const y = gameDate.getFullYear();
  const mo = String(gameDate.getMonth() + 1).padStart(2, "0");
  const d = String(gameDate.getDate()).padStart(2, "0");
  const slots: string[] = [];
  for (let hour = 23; hour >= 0; hour--) {
    for (const half of ["30", "00"]) {
      const h12 = hour % 12 || 12;
      const ampm = hour < 12 ? "AM" : "PM";
      const hh = String(h12).padStart(2, "0");
      slots.push(`${y}-${mo}-${d}_${hh}${half}${ampm}`);
    }
  }

  for (const slot of slots) {
    const url = `https://ak-static.cms.nba.com/referee/injury/Injury-Report_${slot}.pdf`;
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      const buf = Buffer.from(await res.arrayBuffer());
      const data = await pdf(buf);
      return { text: data.text, url };
    } catch {
      continue;
    }
  }
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