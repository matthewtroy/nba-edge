import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import type { PickLeg, SlateGame } from "../lib/types";
import { buildGameSgmCard, isGameSgmCard } from "../lib/game-sgm-builder";

const fixture = JSON.parse(
  fs.readFileSync(path.join(import.meta.dirname, "fixtures/games-tab-sac-bkn.json"), "utf8")
) as { games: SlateGame[]; picks: PickLeg[] };

describe("games tab SGM SAC / BKN fixture", () => {
  it("builds BKN @ MIL and SAC @ GSW SGMs from tests/fixtures", () => {
    const oddsMin = 1.5;
    const oddsMax = 8;
    for (const game of fixture.games) {
      const picks = fixture.picks.filter((p) => p.gameId === game.id);
      const built = buildGameSgmCard(game, picks, oddsMin, oddsMax, 0.08, fixture.picks);
      expect(isGameSgmCard(built)).toBe(true);
      if (!isGameSgmCard(built)) continue;
      expect(built.legs.length).toBeGreaterThanOrEqual(2);
      expect(built.bestTotal).toBeGreaterThan(oddsMin);
      if (game.id === "401909322") {
        expect(built.bestBookie).toBe("PointsBet");
        expect(built.legs.map((l) => l.playerName)).toEqual(
          expect.arrayContaining(["Julius Randle", "Danny Wolf"])
        );
      }
      if (game.id === "401909324") {
        expect(built.bestBookie).toBe("Sportsbet");
        expect(built.legs.map((l) => l.playerName)).toEqual(
          expect.arrayContaining(["Darius Acuff Jr.", "De'Andre Hunter"])
        );
      }
    }
  });
});