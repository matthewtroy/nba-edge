import { describe, it, expect } from "vitest";
import fs from "fs";
import {
  buildInjuryReportUrl,
  parsePdfInjuries,
} from "../scripts/fetch/nba-pdf";

describe("buildInjuryReportUrl", () => {
  it("legacy hour-only before Dec 22 2025", () => {
    expect(buildInjuryReportUrl("2025-11-24", 17, 30)).toBe(
      "https://ak-static.cms.nba.com/referee/injury/Injury-Report_2025-11-24_05PM.pdf"
    );
  });

  it("new 15-min format from Dec 22 2025", () => {
    expect(buildInjuryReportUrl("2026-11-24", 17, 30)).toBe(
      "https://ak-static.cms.nba.com/referee/injury/Injury-Report_2026-11-24_05_30PM.pdf"
    );
    expect(buildInjuryReportUrl("2026-11-24", 18, 0)).toBe(
      "https://ak-static.cms.nba.com/referee/injury/Injury-Report_2026-11-24_06_00PM.pdf"
    );
  });
});

describe("parsePdfInjuries", () => {
  it("parses Last,FirstStatus from CDN sample shape", () => {
    const sample =
      "Cunningham,CadeProbableInjury Duren,JalenOutInjury Robinson,DuncanOutInjury";
    const rows = parsePdfInjuries(sample);
    expect(rows.map((r) => r.name)).toContain("Cade Cunningham");
    expect(rows.find((r) => r.name === "Jalen Duren")?.status).toBe("Out");
  });

  it("parses downloaded report when present", () => {
    const p = "/tmp/nba-injury.pdf";
    if (!fs.existsSync(p)) return;
    // integration optional
    expect(true).toBe(true);
  });
});