import { describe, expect, it } from "vitest";
import {
  displayTicksChronological,
  hotStreakLabel,
  isHotStreak,
} from "../lib/hot-streak";

describe("hot streak", () => {
  it("reverses ticks for display (oldest left)", () => {
    const ticks = ["hit", "miss", "hit", "hit", "hit"] as const;
    expect(displayTicksChronological([...ticks])).toEqual([...ticks].reverse());
  });

  it("flags 4/5 as hot", () => {
    expect(isHotStreak(["hit", "hit", "hit", "hit", "miss"])).toBe(true);
    expect(hotStreakLabel(["hit", "hit", "hit", "hit", "miss"])).toBe("4/5 hot");
    expect(isHotStreak(["hit", "hit", "miss", "miss", "hit"])).toBe(false);
  });
});