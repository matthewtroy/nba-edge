import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import { gateLegReasons, reasonPassesPlausibility } from "../lib/reason-gate";
import { reasonTextHasBannedPhrase } from "../lib/reason-ban";
import { picksByIdFromOfficialSnapshots } from "../lib/official-leg-snapshot";
import type { PickLeg } from "../lib/types";
import type { OfficialLegSnapshot } from "../lib/official-card-time";

import { fixtureSlateDir } from "./public-data-fixture";

const DATA = fixtureSlateDir("2026-11-26");

function loadOfficial() {
  const official = JSON.parse(
    fs.readFileSync(path.join(DATA, "official-card.json"), "utf8")
  ) as {
    legSnapshots: Record<string, OfficialLegSnapshot>;
  };
  const picks = JSON.parse(
    fs.readFileSync(path.join(DATA, "picks.json"), "utf8")
  ) as PickLeg[];
  return { official, picks };
}

describe("reason gate official snapshots", () => {
  const { official, picks } = loadOfficial();

  const cases = [
    { id: "3136195-pts-20", player: "KAT", market: "pts", line: 20 },
    { id: "4903027-reb-7", player: "Coward", market: "reb", line: 7 },
    { id: "4683021-ast-5", player: "Mitchell", market: "ast", line: 5 },
    { id: "4601025-pts-10", player: "Larsson", market: "pts", line: 10 },
    { id: "4433249-pts-10", player: "Diabaté", market: "pts", line: 10 },
  ];

  it("drops banned and implausible snapshot copy", () => {
    for (const c of cases) {
      const snap = official.legSnapshots[c.id];
      expect(snap).toBeTruthy();
      const out = gateLegReasons(snap.reasons, c.market, 3, c.line);
      for (const r of out) {
        expect(reasonTextHasBannedPhrase(r.text)).toBeNull();
        expect(reasonPassesPlausibility(r.text)).toBe(true);
      }
    }
  });

  it("prefers live builder reasons when present on map", () => {
    const map = picksByIdFromOfficialSnapshots(official.legSnapshots, picks);
    const kat = map.get("3136195-pts-20");
    expect(kat?.reasons.length).toBeGreaterThan(0);
    const katSnap = official.legSnapshots["3136195-pts-20"];
    expect(katSnap?.publishedPrice ?? kat?.bestPrice).toBe(1.62);
    const texts = (kat?.reasons ?? []).map((r) => r.text).join(" ");
    expect(texts.toLowerCase()).not.toContain("boards shared");
  });
});