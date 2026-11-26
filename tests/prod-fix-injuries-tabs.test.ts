/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { InjuryStatusBadge } from "../src/components/InjuryStatusBadge";

import type { InjuryEntry } from "../lib/types";
import {
  formatTeammateInjuryEffectLine,
  topTeammateInjuryEffects,
} from "../lib/injury-beneficiaries";
import { InjuriesScreen } from "../src/screens/InjuriesScreen";

describe("prod fix injuries tabs — item 1 Out badge", () => {
  it("Out status renders red Out badge", () => {
    const html = renderToStaticMarkup(
      createElement(InjuryStatusBadge, { status: "Out" })
    );
    expect(html).toContain("Out");
    expect(html).toMatch(/red/);
  });

  it("InjuriesScreen row includes Out badge markup", () => {
    const inj: InjuryEntry = {
      playerId: "1",
      playerName: "Test Player",
      teamId: "9",
      teamName: "Golden State Warriors",
      gameId: "g",
      status: "Out",
      source: "test",
      updatedAt: "2026-11-28T00:00:00.000Z",
    };
    const html = renderToStaticMarkup(
      createElement(InjuriesScreen, {
        data: {
          index: null,
          selectedDate: "2026-11-28",
          slate: [
            {
              id: "g",
              startTime: "2026-11-28T00:00:00.000Z",
              startTimeSydney: "11:00 am",
              homeTeam: "Golden State Warriors",
              awayTeam: "Orlando Magic",
              homeTeamId: "9",
              awayTeamId: "19",
              homeB2B: false,
              awayB2B: false,
              status: "scheduled",
            },
          ],
          injuries: [inj],
          picks: [],
          multis: [],
          multisNotBuilt: [],
          officialCard: null,
          meta: { lastUpdated: "", sources: {}, slateSize: 1 },
          history: { legs: [], multis: [], calibration: [] },
          results: null,
          loading: false,
        },
        todayDate: "2026-11-28",
        tomorrowDate: null,
      })
    );
    expect(html).toContain("Out");
    expect(html).toMatch(/red/);
  });
});

describe("prod fix injuries tabs — item 2 teammate effects", () => {
  it("formats stat line with signed numbers", () => {
    const inj: InjuryEntry = {
      playerId: "out",
      playerName: "Star",
      teamId: "1",
      teamName: "Team",
      gameId: "g",
      status: "Out",
      source: "test",
      updatedAt: "",
      teammateEffects: [
        { playerId: "a", playerName: "De'Anthony Melton", stat: "pts", delta: 3.1 },
        { playerId: "b", playerName: "Gui Santos", stat: "reb", delta: 1.4 },
        { playerId: "c", playerName: "Draymond Green", stat: "ast", delta: -1.2 },
      ],
    };
    const line = formatTeammateInjuryEffectLine(inj);
    expect(line).toContain("Melton +3.1 pts");
    expect(line).toContain("Santos +1.4 reb");
    expect(line).toContain("Green −1.2 ast");
    expect(topTeammateInjuryEffects(inj).length).toBe(3);
  });
});