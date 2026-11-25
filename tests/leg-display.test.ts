import { describe, expect, it } from "vitest";
import { visibleLegReasons, visibleLegTags } from "../lib/leg-display";

describe("leg-display", () => {
  it("hides boards shared", () => {
    expect(visibleLegTags(["Value", "boards shared"])).toEqual(["Value"]);
    expect(visibleLegReasons(["Duncan out", "boards shared"])).toEqual(["Duncan out"]);
  });
});