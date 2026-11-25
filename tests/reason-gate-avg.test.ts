import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import { gateLegReasons, dropRedundantAvgReasons } from "../lib/reason-gate";
import { buildLegReasons } from "../lib/leg-reason-builder";
import type { PickLeg, PlayerGameLog } from "../lib/types";

import { fixtureSlateDir } from "./public-data-fixture";

const DATA = fixtureSlateDir("2026-11-26");

describe("reason gate avg vs rank", () => {
  it("drops avg when equal to rank (1 dec)", () => {
    const reasons = dropRedundantAvgReasons(
      [
        { type: "rank", text: "Averages 10.2 ast, 3rd of 20 guards" },
        { type: "avg", text: "Avg 10.2 ast last 10" },
      ],
      5
    );
    expect(reasons.some((r) => r.type === "avg")).toBe(false);
  });

  it("drops avg when at or below line", () => {
    const reasons = dropRedundantAvgReasons(
      [{ type: "avg", text: "Avg 9.8 ast last 10" }],
      10
    );
    expect(reasons.length).toBe(0);
  });

  it("SGA official builder has no duplicate avg", () => {
    const picks = JSON.parse(
      fs.readFileSync(path.join(DATA, "picks.json"), "utf8")
    ) as PickLeg[];
    const sga = picks.find((p) => p.id === "4278073-ast-5");
    expect(sga).toBeTruthy();
    const out = gateLegReasons(sga!.reasons, "ast", 3, 5);
    const avg = out.filter((r) => r.type === "avg" || /^avg /i.test(r.text));
    const rank = out.filter((r) => r.type === "rank");
    if (rank.length && avg.length) {
      expect(avg.length).toBe(0);
    }
  });

  it("Coward official snapshot drops banned copy cleanly", () => {
    const official = JSON.parse(
      fs.readFileSync(path.join(DATA, "official-card.json"), "utf8")
    ) as { legSnapshots: Record<string, { reasons: unknown; market: string; line: number }> };
    const snap = official.legSnapshots["4903027-reb-7"];
    expect(snap).toBeTruthy();
    const out = gateLegReasons(snap.reasons, snap.market, 3, snap.line);
    for (const r of out) {
      expect(r.text.toLowerCase()).not.toContain("boards shared");
    }
  });
});