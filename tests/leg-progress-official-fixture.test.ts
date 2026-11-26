import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import type { OfficialCardFile, OfficialLegSnapshot } from "../lib/official-card-time";
import type { PickLeg, SlateGame } from "../lib/types";
import type { BoxLine } from "../scripts/espn-parse";
import { pickLegFromSnapshot } from "../lib/official-leg-snapshot";
import { gradeOfficialLeg } from "../lib/settle-core";
import { liveViewsForLegs } from "../lib/live-tracking";
import type { LiveGameBoard, LiveSourceSnapshot } from "../lib/live-source";

const fixtureDir = path.join(process.cwd(), "tests/fixtures/2026-11-26");
const official = JSON.parse(
  fs.readFileSync(path.join(fixtureDir, "official-card.json"), "utf8")
) as OfficialCardFile;
const slateTemplate = JSON.parse(
  fs.readFileSync(path.join(fixtureDir, "slate.json"), "utf8")
) as SlateGame[];

/** Pipeline snapshot at 74f1afc: six finals, three live. */
const SIX_FINAL_IDS = [
  "401909317",
  "401909318",
  "401909319",
  "401909320",
  "401909321",
  "401909322",
] as const;
const LIVE_IDS = ["401909323", "401909324", "401909325"] as const;

function slateSixFinal(): SlateGame[] {
  return slateTemplate.map((g) => {
    if ((SIX_FINAL_IDS as readonly string[]).includes(g.id)) {
      return { ...g, status: "final" };
    }
    if ((LIVE_IDS as readonly string[]).includes(g.id)) {
      return { ...g, status: "live" };
    }
    return g;
  });
}

function boxForSnap(
  snap: OfficialLegSnapshot,
  outcome: "won" | "lost" | "void"
): BoxLine {
  if (outcome === "void") {
    return {
      playerId: snap.playerId,
      minutes: 0,
      pts: 0,
      reb: 0,
      ast: 0,
      threes: 0,
    };
  }
  const line = snap.line;
  const hit = outcome === "won" ? line : Math.max(0, line - 2);
  const base: BoxLine = {
    playerId: snap.playerId,
    minutes: 32,
    pts: 0,
    reb: 0,
    ast: 0,
    threes: 0,
    q1: { pts: 0, reb: 0, ast: 0 },
  };
  switch (snap.market) {
    case "pts":
      base.pts = hit;
      break;
    case "reb":
      base.reb = hit;
      break;
    case "ast":
      base.ast = hit;
      break;
    case "3pm":
      base.threes = hit;
      break;
    case "q1pts":
      base.q1!.pts = hit;
      break;
    case "q1reb":
      base.q1!.reb = hit;
      break;
    case "q1ast":
      base.q1!.ast = hit;
      break;
    default:
      base.pts = hit;
  }
  return base;
}

function snapshotSixFinal(): LiveSourceSnapshot {
  const games: LiveGameBoard[] = [
    ...SIX_FINAL_IDS.map((gameId) => ({
      gameId,
      status: "final",
      phase: "final" as const,
      period: 4,
      statusDetail: "Final",
    })),
    ...LIVE_IDS.map((gameId) => ({
      gameId,
      status: "live",
      phase: "live" as const,
      period: 3,
      statusDetail: "Q3 4:00",
    })),
  ];
  const boxesByGame = new Map<string, Map<string, BoxLine>>();
  const snaps = Object.values(official.legSnapshots);
  for (const snap of snaps) {
    if (!(SIX_FINAL_IDS as readonly string[]).includes(snap.gameId)) continue;
    const outcome: "won" | "lost" =
      Number(snap.playerId.slice(-1)) % 2 === 0 ? "won" : "lost";
    const box = boxForSnap(snap, outcome);
    if (!boxesByGame.has(snap.gameId)) boxesByGame.set(snap.gameId, new Map());
    boxesByGame.get(snap.gameId)!.set(snap.playerId, box);
  }
  return { fetchedAt: new Date().toISOString(), games, boxesByGame };
}

describe("official 2026-11-26 leg progress (6/9 final)", () => {
  it("finished-game legs grade won/lost/void — not live or pending", () => {
    const slate = slateSixFinal();
    const legs = Object.values(official.legSnapshots).map((s) =>
      pickLegFromSnapshot(s)
    ) as PickLeg[];
    const snap = snapshotSixFinal();
    const views = liveViewsForLegs(legs, slate, snap);

    const finalLegs = legs.filter((l) =>
      (SIX_FINAL_IDS as readonly string[]).includes(l.gameId)
    );
    expect(finalLegs.length).toBeGreaterThan(0);

    for (const leg of finalLegs) {
      const snap = official.legSnapshots[leg.id];
      const v = views.get(leg.id);
      expect(v, leg.id).toBeDefined();
      expect(v!.state, `${leg.id} must settle`).toMatch(/^(won|lost|void)$/);
      const box = snap
        ? snapshotSixFinal().boxesByGame.get(snap.gameId)?.get(snap.playerId)
        : undefined;
      const settled = snap ? gradeOfficialLeg(snap, box).result : "pending";
      const mapped =
        v!.state === "won" ? "won" : v!.state === "lost" ? "lost" : "void";
      expect(mapped).toBe(settled);
    }

    const liveLegs = legs.filter((l) =>
      (LIVE_IDS as readonly string[]).includes(l.gameId)
    );
    for (const leg of liveLegs) {
      const v = views.get(leg.id);
      if (!v) continue;
      expect(["live", "won", "pending"]).toContain(v.state);
    }
  });
});