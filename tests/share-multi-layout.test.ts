import { describe, expect, it } from "vitest";
import { shareMultiCanvasSize } from "../lib/share-multi-layout";

describe("share multi image layout", () => {
  it("sizes 5-leg and 17-leg cards at 390px width", () => {
    const five = shareMultiCanvasSize(5);
    const seventeen = shareMultiCanvasSize(17);
    expect(five.width).toBe(390);
    expect(seventeen.width).toBe(390);
    expect(seventeen.height).toBeGreaterThan(five.height);
    expect(five.height).toBe(72 + 5 * 52 + 48);
    expect(seventeen.height).toBe(72 + 17 * 52 + 48);
  });
});