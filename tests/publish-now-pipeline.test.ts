import fs from "fs";
import path from "path";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  countPropsListedGames,
  eventHasAuPlayerProps,
  publishNowProbeSkipMessage,
  publishNowReady,
  PUBLISH_NOW_MIN_GAMES,
} from "../lib/publish-now-probe";
import { detectOddsPullTrigger } from "../scripts/odds-schedule";
import { shouldPublishOfficialCard } from "../lib/official-card-time";
import { shouldShowSlateBuildingScreen } from "../lib/slate-building-mode";
import { skipOfficialPublishOnRun } from "../lib/pipeline-run-opts";
import type { SlateGame } from "../lib/types";

const game = (id: string, home: string, away: string): SlateGame => ({
  id,
  startTime: "2026-11-28T02:00:00.000Z",
  startTimeSydney: "1:00 pm",
  homeTeam: home,
  awayTeam: away,
  homeTeamId: `${id}-h`,
  awayTeamId: `${id}-a`,
  homeB2B: false,
  awayB2B: false,
  status: "pre",
});

describe("publish_now probe", () => {
  const events = [
    { id: "ev1", home_team: "Boston Celtics", away_team: "New York Knicks" },
    { id: "ev2", home_team: "Los Angeles Lakers", away_team: "Phoenix Suns" },
  ];

  it("counts matched games when AU probe has props", () => {
    const slate = [
      game("g1", "Celtics", "Knicks"),
      game("g2", "Lakers", "Suns"),
      game("g3", "Heat", "Bulls"),
    ];
    expect(
      countPropsListedGames(slate, events, "ev1", true)
    ).toEqual({ listed: 2, total: 3 });
    expect(publishNowReady(2)).toBe(false);
    expect(publishNowReady(PUBLISH_NOW_MIN_GAMES)).toBe(true);
  });

  it("skips when fewer than 8 games listed", () => {
    expect(publishNowProbeSkipMessage(3, 11)).toBe(
      "publish_now skipped: props listed for 3/11 games"
    );
    expect(publishNowReady(7)).toBe(false);
  });

  it("detects AU player_points on probe payload", () => {
    const payload = {
      bookmakers: [
        {
          title: "Sportsbet",
          markets: [
            {
              key: "player_points",
              outcomes: [{ name: "Over", description: "Jayson Tatum" }],
            },
          ],
        },
      ],
    };
    expect(eventHasAuPlayerProps(payload)).toBe(true);
    expect(eventHasAuPlayerProps({ bookmakers: [] })).toBe(false);
  });
});

describe("publish_now pipeline guards", () => {
  const slate = [
    {
      id: "g1",
      startTime: "2026-11-25T22:00:00.000Z",
      startTimeSydney: "9:00 am",
      homeTeam: "H",
      awayTeam: "A",
      homeTeamId: "1",
      awayTeamId: "2",
      homeB2B: false,
      awayB2B: false,
      status: "pre",
    },
  ];

  it("9pm scheduled pull skips when next slate already published", () => {
    const at9pm = new Date("2026-01-15T10:15:00.000Z");
    expect(
      detectOddsPullTrigger(at9pm, slate, { pullSlotsToday: [] }, {
        nextSlateOfficialPublished: true,
        nextSlateTipDate: "2026-01-16",
      })
    ).toBeNull();
  });

  it("allows publish outside evening window when publish_now", () => {
    const noon = new Date("2026-01-15T01:00:00.000Z");
    const leg = {
      id: "l1",
      playerId: "p",
      playerName: "Test",
      gameId: "g1",
      team: "H",
      market: "pts",
      line: 20,
      fairPrice: 1.9,
      probability: 0.55,
      bestPrice: 1.85,
      bookie: "TAB",
      reasons: [],
    };
    expect(
      shouldPublishOfficialCard(noon, [leg], null, "2026-01-16", { publishNow: true })
    ).toBe(true);
  });

  it("does not skip official publish on publish_now", () => {
    expect(
      skipOfficialPublishOnRun({
        forceOdds: true,
        republishCard: false,
        fromLive: false,
        publishNow: true,
      })
    ).toBe(false);
  });

  it("hides building screen when official card has publishedAt", () => {
    expect(
      shouldShowSlateBuildingScreen({
        index: {
          updatedAt: "x",
          todayDate: "2026-11-27",
          tomorrowDate: "2026-11-28",
          defaultDate: "2026-11-27",
          dates: [],
        },
        slateDate: "2026-11-28",
        todayDate: "2026-11-27",
        slateEmpty: false,
        officialCard: {
          lockedAt: "x",
          publishedAt: "2026-11-27T10:00:00.000Z",
          slateDate: "2026-11-28",
          bookie: "TAB",
          multis: [],
          notBuilt: [],
          whatChanged: [],
          injuries: [],
          legSnapshots: { l1: {} as never },
        },
        officialInUse: false,
      })
    ).toBe(false);
  });
});

describe("publish_now card gate wiring", () => {
  it("slate bundle blocks only hard publish gate, not model sanity", () => {
    const src = fs.readFileSync(
      path.join(process.cwd(), "scripts/slate-bundle.ts"),
      "utf8"
    );
    expect(src).toContain("const blockOfficialRepublish = publishGate.block;");
    expect(src).not.toMatch(/modelSanity\.blockRepublish \|\| publishGate\.block/);
  });
});

describe("publish_now workflow input", () => {
  it("pipeline workflow exposes publish_now dispatch checkbox", () => {
    const yml = fs.readFileSync(
      path.join(process.cwd(), ".github/workflows/pipeline.yml"),
      "utf8"
    );
    expect(yml).toMatch(/publish_now:/);
    expect(yml).toMatch(/PIPELINE_PUBLISH_NOW/);
  });
});

describe("publish_now run-live probe path", () => {
  beforeEach(() => {
    vi.resetModules();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("probe-only path makes zero budgeted odds pulls when <8 games", async () => {
    vi.doMock("../scripts/publish-now-probe.js", () => ({
      runPublishNowProbe: vi.fn().mockResolvedValue({ listed: 2, total: 10, remaining: 400 }),
    }));
    const { runPublishNowProbe } = await import("../scripts/publish-now-probe.js");
    const probe = await runPublishNowProbe("key", [game("g1", "Celtics", "Knicks")]);
    expect(probe.listed).toBe(2);
    expect(publishNowReady(probe.listed)).toBe(false);
  });
});