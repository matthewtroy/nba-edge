import { describe, expect, it } from "vitest";
import { injuryReasonForMarket } from "../lib/injury-reason";

describe("injuryReasonForMarket", () => {
  it("does not put pts boost on ast leg", () => {
    const reasons = ["Chet Holmgren out: +7.2 pts", "Holmgren out → reb share +2.1 reb"];
    expect(injuryReasonForMarket(reasons, "ast")).toBeUndefined();
    expect(injuryReasonForMarket(reasons, "reb")).toMatch(/reb/);
  });

  it("strips internal tags from user copy", () => {
    const reasons = ["boards shared", "Allen out → +3.1 reb"];
    expect(injuryReasonForMarket(reasons, "reb")).toMatch(/Allen/);
  });
});