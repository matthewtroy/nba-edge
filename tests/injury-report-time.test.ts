import { describe, expect, it } from "vitest";
import {
  injuryReportTimeFromPdfUrl,
  newerInjuryEntry,
} from "../lib/injury-report-time";
import type { InjuryEntry } from "../lib/types";

describe("injuryReportTimeFromPdfUrl", () => {
  it("parses 15-minute NBA report filename", () => {
    const url =
      "https://ak-static.cms.nba.com/referee/injury/Injury-Report_2026-11-25_02_45PM.pdf";
    const t = injuryReportTimeFromPdfUrl(url);
    expect(t).toBeTruthy();
    expect(new Date(t!).toISOString()).toMatch(/2026-11-25T/);
  });

  it("older reportTime never wins over newer", () => {
    const older: InjuryEntry = {
      playerId: "3136195",
      playerName: "Karl-Anthony Towns",
      teamId: "18",
      teamName: "Knicks",
      gameId: "401909319",
      status: "Questionable",
      source: "NBA Official",
      updatedAt: "2026-11-26T10:00:00Z",
      reportTime: "2026-11-25T13:39:22.578Z",
    };
    const newer: InjuryEntry = {
      ...older,
      status: "Probable",
      reportTime: "2026-11-25T19:45:15.024Z",
      updatedAt: "2026-11-25T19:45:15.024Z",
    };
    expect(newerInjuryEntry(older, newer).status).toBe("Probable");
    expect(newerInjuryEntry(newer, older).status).toBe("Probable");
  });

  it("KAT flip-flop: 02:45pm report beats 1:39pm regardless of re-fetch clock", () => {
    const earlierReport: InjuryEntry = {
      playerId: "3136195",
      playerName: "Karl-Anthony Towns",
      teamId: "18",
      teamName: "Knicks",
      gameId: "401909319",
      status: "Questionable",
      source: "NBA Official",
      updatedAt: "2026-11-26T02:00:00Z",
      reportTime: "2026-11-25T13:39:22.578Z",
    };
    const laterReport: InjuryEntry = {
      ...earlierReport,
      status: "Probable",
      reportTime: "2026-11-25T19:45:15.024Z",
      updatedAt: "2026-11-25T19:45:15.024Z",
    };
    expect(newerInjuryEntry(earlierReport, laterReport).status).toBe("Probable");
    const reingestedOldPdf = {
      ...earlierReport,
      updatedAt: "2026-11-26T12:00:00Z",
    };
    expect(newerInjuryEntry(reingestedOldPdf, laterReport).status).toBe("Probable");
  });
});