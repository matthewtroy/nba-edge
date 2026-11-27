import { describe, expect, it } from "vitest";
import {
  combineTeammateInjuryReasonForMarket,
  injuryReasonForMarket,
} from "../lib/injury-reason";

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

  it("combines recent teammate-absence ast boosts on one line", () => {
    const reasons = [
      "Scotty Pippen Jr. out: +1.1 ast",
      "Zach Edey out: +1.0 ast",
    ];
    expect(injuryReasonForMarket(reasons, "ast")).toBe("Pippen, Edey out → +2.1 ast");
  });

  it("keeps opponent-big reb line separate from teammate ast", () => {
    const reasons = [
      "Pacers without Turner (C) → +1.2 reb",
      "Boozer out: +0.4 ast",
    ];
    expect(combineTeammateInjuryReasonForMarket(reasons, "ast")).toBe(
      "Boozer out → +0.4 ast"
    );
    expect(combineTeammateInjuryReasonForMarket(reasons, "reb")).toBe(
      "Pacers without Turner (C) → +1.2 reb"
    );
  });

  it("lists up to three names by contribution", () => {
    const reasons = [
      "A out: +0.5 ast",
      "B out: +1.0 ast",
      "C out: +0.8 ast",
      "D out: +0.3 ast",
    ];
    expect(injuryReasonForMarket(reasons, "ast")).toBe("B, C, A out → +2.6 ast");
  });
});