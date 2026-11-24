import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import { renderTodayText } from "../lib/today-text";
import { renderMultiCardText } from "../lib/multi-card-text";
import { FORBIDDEN_MULTI_CARD_STRINGS } from "../src/components/MultiCard";
import type { MetaJson, MultiBet, MultiNotBuilt, PickLeg, SlateGame } from "../lib/types";

const root = path.resolve(import.meta.dirname, "..");
const data = path.join(root, "public/data");

function loadFixture() {
  const meta = JSON.parse(fs.readFileSync(path.join(data, "meta.json"), "utf8")) as MetaJson;
  const slate = JSON.parse(fs.readFileSync(path.join(data, "slate.json"), "utf8")) as SlateGame[];
  const picks = JSON.parse(fs.readFileSync(path.join(data, "picks.json"), "utf8")) as PickLeg[];
  const multisRaw = JSON.parse(fs.readFileSync(path.join(data, "multis.json"), "utf8")) as {
    bets: MultiBet[];
    notBuilt: MultiNotBuilt[];
  };
  return { meta, slate, picks, multisRaw };
}

describe("Today proof text", () => {
  it("renders clean layout from public data", () => {
    const { meta, slate, picks, multisRaw } = loadFixture();
    const text = renderTodayText({
      meta,
      slate,
      multis: multisRaw.bets,
      notBuilt: multisRaw.notBuilt,
      picksById: new Map(picks.map((p) => [p.id, p])),
      gateViolations: meta.gateViolations,
    });
    expect(text).toMatch(/Take at \$[\d.]+\+ \(Fair \$[\d.]+\)/);
    expect(text).toContain("What changed");
    expect(text).not.toMatch(/~1 in/);
    expect(text).not.toMatch(/\b[123]\+ 3PM\b/i);
    expect(text).not.toMatch(/2\+ 3PM/i);
    expect(text).not.toMatch(/3\+ 3PM/i);
    const smallCount = (text.match(/Small slate/g) ?? []).length;
    expect(smallCount).toBeLessThanOrEqual(1);

    for (const multi of multisRaw.bets) {
      const legs = multi.legs.map((id) => picks.find((p) => p.id === id)!).filter(Boolean);
      const card = renderMultiCardText(multi, legs);
      for (const bad of FORBIDDEN_MULTI_CARD_STRINGS) {
        expect(card.includes(bad)).toBe(false);
      }
    }
  });
});