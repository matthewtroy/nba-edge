import { describe, expect, it, vi } from "vitest";
import { logOfficialCard } from "../lib/official-card-log";

describe("official card log", () => {
  it("formats published and blocked lines", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    logOfficialCard("published", "2026-11-26, Sportsbet");
    logOfficialCard("republished", "2026-11-26");
    logOfficialCard("blocked", "outside evening window");
    logOfficialCard("kept", "published 2026-11-26T12:00:00Z");
    expect(spy.mock.calls[0][0]).toBe(
      "official card: published (2026-11-26, Sportsbet)"
    );
    expect(spy.mock.calls[1][0]).toBe("official card: republished (2026-11-26)");
    expect(spy.mock.calls[2][0]).toBe(
      "official card: blocked: outside evening window"
    );
    expect(spy.mock.calls[3][0]).toBe(
      "official card: kept (published 2026-11-26T12:00:00Z)"
    );
    spy.mockRestore();
  });
});