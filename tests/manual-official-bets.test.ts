import { describe, expect, it } from "vitest";
import type { PickLeg } from "../lib/types";
import {
  dedupeExtraOfficialBets,
  extraOfficialBetRows,
  extraGamesSgmRows,
  gradeExtraBetLegs,
  officialBetSignature,
} from "../lib/extra-official-bets";
import type { OfficialBetRow } from "../lib/official-bet-settle";
import { pickLegForBetId } from "../lib/manual-leg-resolve";
import type { BoxLine } from "../scripts/espn-parse";

const picks: PickLeg[] = [
  {
    id: "4433083-ast-5",
    gameId: "401909331",
    team: "Memphis Grizzlies",
    opponent: "Minnesota Timberwolves",
    playerId: "4433083",
    playerName: "Cam Spencer",
    headshotUrl: "",
    market: "ast",
    line: 5,
    probability: 0.75,
    fairPrice: 1.33,
    takeAt: 1.43,
    tags: [],
    reasons: [],
    bestPrice: 1.96,
    bestBookie: "SportsBet",
    bookiePrices: { SportsBet: 1.96 },
  },
  {
    id: "4433083-ast-8",
    gameId: "401909331",
    team: "Memphis Grizzlies",
    opponent: "Minnesota Timberwolves",
    playerId: "4433083",
    playerName: "Cam Spencer",
    headshotUrl: "",
    market: "ast",
    line: 8,
    probability: 0.4,
    fairPrice: 2.5,
    takeAt: 2.7,
    tags: [],
    reasons: [],
  },
];

const boxes = new Map<string, Map<string, BoxLine>>([
  [
    "401909331",
    new Map([
      [
        "4433083",
        {
          playerId: "4433083",
          minutes: 28,
          pts: 12,
          reb: 4,
          ast: 9,
          threes: 1,
          q1: { pts: 4, reb: 1, ast: 3 },
        },
      ],
    ]),
  ],
]);

describe("manual official bets", () => {
  it("grades off-ladder Spencer 8+ ast from ESPN box", () => {
    const synthetic = pickLegForBetId("4433083-ast-8", picks);
    expect(synthetic?.line).toBe(8);
    const errors: string[] = [];
    const results = gradeExtraBetLegs(["4433083-ast-8"], picks, boxes, errors);
    expect(errors).toHaveLength(0);
    expect(results.get("4433083-ast-8")).toBe("won");
  });

  it("dedupes extras identical to published card bets", () => {
    const published: OfficialBetRow[] = [
      {
        slateDate: "2026-11-28",
        betType: "mainPlay",
        label: "Main Play",
        bookie: "Sportsbet",
        legIds: ["a", "b", "c"],
        result: "pending",
        profitUnits: null,
        stakeUnits: 0,
        publishedCombinedPrice: 6.5,
      },
    ];
    const dup: OfficialBetRow[] = [
      {
        slateDate: "2026-11-28",
        betType: "mainPlay",
        label: "Main Play",
        bookie: "Sportsbet",
        legIds: ["c", "b", "a"],
        result: "pending",
        profitUnits: null,
        stakeUnits: 1,
        publishedCombinedPrice: 6.5,
      },
    ];
    expect(dedupeExtraOfficialBets(published, dup)).toHaveLength(0);
    expect(officialBetSignature(published[0]!)).toBe(officialBetSignature(dup[0]!));
  });

  it("Main Play boosted 6.00 → 6.50 at 1u", () => {
    const file = {
      slates: {
        "2026-11-28": {
          extraBets: [
            {
              betType: "mainPlay" as const,
              bookie: "Sportsbet",
              legIds: ["4433083-ast-5"],
              price: 6,
              boostPct: 10,
              stakeUnits: 1,
            },
          ],
        },
      },
    };
    const rows = extraOfficialBetRows(
      "2026-11-28",
      new Map([["4433083-ast-5", "won"]]),
      file,
      []
    );
    expect(rows[0]?.publishedCombinedPrice).toBe(6.5);
    expect(rows[0]?.stakeUnits).toBe(1);
    expect(rows[0]?.label).toBe("Main Play");
  });

  it("extra Games SGMs appear at 0.5u stake", () => {
    const file = {
      slates: {
        "2026-11-28": {
          extraGamesSgms: [
            {
              game: "GSW@POR",
              gameId: "401909336",
              bookie: "Sportsbet",
              price: 36.5,
              legIds: ["4433083-ast-5"],
              stakeUnits: 0.5,
            },
          ],
        },
      },
    };
    const rows = extraGamesSgmRows("2026-11-28", new Map([["4433083-ast-5", "won"]]), file);
    expect(rows[0]?.stakeUnits).toBe(0.5);
    expect(rows[0]?.filter).toBe("36.5");
  });
});