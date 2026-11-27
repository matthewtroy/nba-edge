import { describe, expect, it, vi } from "vitest";
import { historyEntryCount } from "../lib/espn-cache-guard";
import {
  PERSIST_JSON_SHRINK_CHECKS,
  persistJsonEntryCount,
} from "../lib/persist-guard-json-count";
import type { HistoryJson } from "../lib/types";

describe("persist guard json shrink paths", () => {
  it("lists history, injury-status-history, and injury-combine-log", () => {
    const rels = PERSIST_JSON_SHRINK_CHECKS.map((c) => c.rel);
    expect(rels).toContain("public/data/history.json");
    expect(rels).toContain("public/data/injury-status-history.json");
    expect(rels).toContain("public/data/injury-combine-log.json");
  });

  it("injury-status-history uses changes length, not history legs/multis", () => {
    const injuryShape = { version: 1, changes: [{ playerId: "p1" }, { playerId: "p2" }] };
    expect(persistJsonEntryCount("public/data/injury-status-history.json", injuryShape)).toBe(2);
    expect(persistJsonEntryCount("public/data/history.json", injuryShape)).toBe(0);
  });

  it("counts each persist file shape independently", () => {
    const history: HistoryJson = {
      legs: [{ id: "1", date: "d", probability: 0.5 }],
      multis: [{ id: "m", date: "d", legs: [] }],
      calibration: [],
    };
    expect(persistJsonEntryCount("public/data/history.json", history)).toBe(2);
    expect(
      persistJsonEntryCount("public/data/injury-status-history.json", {
        version: 1,
        changes: [{ playerId: "a" }, { playerId: "b" }],
      })
    ).toBe(2);
    expect(
      persistJsonEntryCount("public/data/injury-combine-log.json", {
        version: 1,
        entries: [{ slateDate: "2026-11-28" }],
      })
    ).toBe(1);
    expect(persistJsonEntryCount("public/data/game-log-cache.json", { x: 1, y: 2 })).toBe(2);
  });

  it("injury-status-history shape does not throw via historyEntryCount", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const injuryOnly = { version: 1, changes: [] as unknown[] };
    expect(historyEntryCount(injuryOnly as unknown as HistoryJson)).toBe(0);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});