/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import type { PickLeg, SlateGame } from "../lib/types";
import type { OfficialCardFile } from "../lib/official-card-time";
import { backfillCardFreezes } from "../lib/card-freeze-backfill";
import { freezeGamesSgms, settleGamesSgms } from "../lib/games-sgm-freeze";
import { finalPlayerBox, voidAdjustedPrice } from "../lib/settle-core";
import { gradePickCatalog } from "../lib/graded-leg";
import { loadPreAppMainPlays, preAppMainPlayRows } from "../lib/pre-app-main-plays";
import { ResultsScreen } from "../src/screens/ResultsScreen";
import type { DataBundle } from "../src/hooks/useData";
import { createElement, act } from "react";
import { createRoot } from "react-dom/client";
import {
  VALUE_SINGLE_MIN_EDGE,
  freezeValueSingles,
  isValueSingle,
  valueLegRowsFromSingles,
} from "../lib/value-leg-track";
import { valueSinglesForSlate } from "../lib/value-singles-source";
import { buildResultsSlice } from "../lib/results-aggregate";
import type { GradedProjectionLeg } from "../lib/graded-leg";

interface ValueSinglesFixture {
  commit: string;
  slateDate: string;
  legCount: number;
  picks: PickLeg[];
}

const valueFx = JSON.parse(
  fs.readFileSync(
    path.join(process.cwd(), "tests/fixtures/value-singles/2026-11-26-81fb442.json"),
    "utf8"
  )
) as ValueSinglesFixture;

function leg(over: Partial<PickLeg>): PickLeg {
  return {
    id: "p1-pts-20",
    playerId: "p1",
    playerName: "P One",
    gameId: "g1",
    market: "pts",
    line: 20,
    fairPrice: 2,
    probability: 0.5,
    bookiePrices: {},
    ...over,
  } as PickLeg;
}

function graded(id: string, result: GradedProjectionLeg["result"]): GradedProjectionLeg {
  return {
    id,
    slateDate: "2026-11-26",
    playerId: "p",
    playerName: "P",
    gameId: "g1",
    market: "pts",
    line: 20,
    result,
    actualValue: null,
    probability: 0.5,
    fairPrice: 2,
    tags: [],
  };
}

describe("item 1: Singles = Value rule at the publish freeze", () => {
  it("needs best AU price ≥ fair × 1.08, excluding bet365 and Q1", () => {
    expect(VALUE_SINGLE_MIN_EDGE).toBe(1.08);
    expect(isValueSingle(leg({ bookiePrices: { Sportsbet: 2.16 } }))).toBe(true);
    expect(isValueSingle(leg({ bookiePrices: { Sportsbet: 2.15 } }))).toBe(false);
    expect(isValueSingle(leg({ bookiePrices: { bet365: 3 } }))).toBe(false);
    expect(isValueSingle(leg({ bookiePrices: { bet365: 3, TAB: 2.1 } }))).toBe(false);
    expect(isValueSingle(leg({ market: "q1pts", bookiePrices: { TAB: 5 } }))).toBe(false);
  });

  it("keeps one single per player/market/line at the best AU price", () => {
    const singles = freezeValueSingles([
      leg({ bookiePrices: { TAB: 2.2, Neds: 2.5, bet365: 4 } }),
      leg({ bookiePrices: { TAB: 3 } }),
    ]);
    expect(singles).toHaveLength(1);
    expect(singles[0]).toMatchObject({ price: 2.5, bookie: "Neds", fairPrice: 2 });
  });

  it("card publish freeze wins; else the pinned pre-tip commit; else picks on disk", () => {
    const current = [leg({ bookiePrices: { TAB: 2.5 } })];
    const preTip = [leg({ id: "p2-pts-20", playerId: "p2", bookiePrices: { TAB: 2.5 } })];
    const cardSingles = freezeValueSingles([leg({ id: "p3-pts-20", playerId: "p3", bookiePrices: { TAB: 9 } })]);
    const load = (c: string) => (c === "abc1234" ? preTip : null);
    const meta = { reasonsFrozenFrom: { commit: "abc1234", committedAt: "", firstTipAt: "" } };

    const fromCard = valueSinglesForSlate({ card: { valueSingles: cardSingles }, meta, currentPicks: current, loadPicksAtCommit: load });
    expect(fromCard.source.kind).toBe("card");
    expect(fromCard.singles.map((s) => s.id)).toEqual(["p3-pts-20"]);

    const fromPreTip = valueSinglesForSlate({ card: {}, meta, currentPicks: current, loadPicksAtCommit: load });
    expect(fromPreTip.source).toEqual({ kind: "preTip", commit: "abc1234" });
    expect(fromPreTip.singles.map((s) => s.id)).toEqual(["p2-pts-20"]);

    const fromDisk = valueSinglesForSlate({ card: null, meta: null, currentPicks: current, loadPicksAtCommit: load });
    expect(fromDisk.source.kind).toBe("currentPicks");
    expect(fromDisk.singles.map((s) => s.id)).toEqual(["p1-pts-20"]);
  });

  it("settles 1u each at the frozen price; void/pending are not counted", () => {
    const singles = freezeValueSingles([
      leg({ id: "a", playerId: "a", bookiePrices: { TAB: 2.5 } }),
      leg({ id: "b", playerId: "b", bookiePrices: { TAB: 3 } }),
      leg({ id: "c", playerId: "c", bookiePrices: { TAB: 3 } }),
    ]);
    const rows = valueLegRowsFromSingles("2026-11-26", singles, [
      graded("a", "won"),
      graded("b", "lost"),
      graded("c", "pending"),
    ]);
    const slice = buildResultsSlice({ officialLegs: [], officialBets: [], valueLegRows: rows, gradedLegs: [] });
    expect(slice.valueLegs.record).toMatchObject({ legs: 2, won: 1, lost: 1, staked: 2, profit: 0.5 });
  });

  it("26 Nov frozen pre-tip copy (81fb442) yields 323 singles", () => {
    const singles = freezeValueSingles(valueFx.picks);
    expect(valueFx.commit.startsWith("81fb442")).toBe(true);
    expect(singles).toHaveLength(323);
    expect(singles.every((s) => s.bookie !== "bet365" && !s.market.startsWith("q1"))).toBe(true);
    expect(singles.every((s) => s.price >= s.fairPrice * 1.08)).toBe(true);
    expect(new Set(singles.map((s) => `${s.playerId}:${s.market}:${s.line}`)).size).toBe(323);
  });
});

describe("item 2: Games tab SGMs backfilled from pre-tip, settled, in Other bets", () => {
  const sas = JSON.parse(
    fs.readFileSync(
      path.join(process.cwd(), "tests/fixtures/games-sgm-freeze/sas-por-2026-11-26-81fb442.json"),
      "utf8"
    )
  ) as { commit: string; game: SlateGame; picks: PickLeg[] };
  const frozenFrom = { commit: sas.commit, committedAt: "2026-11-25T19:46:44Z", firstTipAt: "2026-11-25T22:00:00.000Z" };
  const card = { lockedAt: "x", slateDate: "2026-11-26", bookie: "Ladbrokes", multis: [], notBuilt: [], whatChanged: [], injuries: [] } as OfficialCardFile;

  it("backfills gamesSgms + valueSingles once, with the publish builder and stakes", () => {
    const { card: next, added } = backfillCardFreezes(card, { frozenFrom, slate: [sas.game], picks: sas.picks });
    expect(added).toEqual(["gamesSgms", "valueSingles"]);
    expect(next.gamesSgms).toEqual(freezeGamesSgms([sas.game], sas.picks));
    expect(next.valueSingles).toEqual(freezeValueSingles(sas.picks));
    expect(next.freezeBackfill).toMatchObject({ commit: sas.commit, fields: ["gamesSgms", "valueSingles"] });
    expect(backfillCardFreezes(next, { frozenFrom, slate: [sas.game], picks: [] }).added).toEqual([]);
  });

  it("SAS @ POR 50+ is Neds $69.15 at 0.25u and wins with real 26 Nov results", () => {
    const frozen = freezeGamesSgms([sas.game], sas.picks);
    const top = frozen.bets.find((b) => b.filter === "50+")!;
    expect(top).toMatchObject({ bookie: "Neds", total: 69.15, stakeUnits: 0.25 });
    const allWon = new Map(frozen.bets.flatMap((b) => b.legs).map((id) => [id, "won" as const]));
    const [row] = settleGamesSgms("2026-11-26", { ...frozen, bets: [top] }, allWon);
    expect(row?.result).toBe("won");
    expect(row?.profitUnits).toBeCloseTo(0.25 * 68.15, 6);
  });

  it("a player missing from a final box grades void; the multi is repriced without that leg", () => {
    const boxes = new Map([["g1", new Map([["p1", { playerId: "p1", minutes: 30, pts: 25, reb: 5, ast: 3, threes: 2 }]])]]);
    expect(finalPlayerBox(boxes, "g1", "p2")?.minutes).toBe(0);
    expect(finalPlayerBox(boxes, "g2", "p2")).toBeUndefined();
    const graded = gradePickCatalog(
      [leg({ id: "p1-pts-20", bookiePrices: { TAB: 2 } }), leg({ id: "p2-pts-20", playerId: "p2", bookiePrices: { TAB: 2 } })],
      "2026-11-26",
      boxes
    );
    expect(graded.map((g) => g.result)).toEqual(["won", "void"]);
    const results = new Map(graded.map((g) => [g.id, g.result]));
    expect(voidAdjustedPrice(3.07, ["p1-pts-20", "p2-pts-20"], results, () => 2.02)).toBe(1.52);
    expect(voidAdjustedPrice(3.07, ["p1-pts-20", "p2-pts-20"], results, () => undefined)).toBeUndefined();
  });

  it("Other bets has a Games tab SGMs row → filters → bets", async () => {
    const frozen = freezeGamesSgms([sas.game], sas.picks);
    const allWon = new Map(frozen.bets.flatMap((b) => b.legs).map((id) => [id, "won" as const]));
    const slice = buildResultsSlice({
      officialLegs: [],
      officialBets: preAppMainPlayRows(loadPreAppMainPlays(process.cwd())),
      valueLegRows: [],
      gradedLegs: [],
      gamesSgmBets: settleGamesSgms("2026-11-26", frozen, allWon),
    });
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => {
      root.render(createElement(ResultsScreen, { data: { results: slice } as unknown as DataBundle }));
    });
    expect(host.querySelector("[data-results='games-sgms']")).toBeNull();
    const other = host.querySelector("[data-results='other-bets']")!;
    const row = other.querySelector("[data-results-row='gamesSgm'] > button") as HTMLButtonElement;
    expect(row.textContent).toMatch(/Games tab SGMs/);
    await act(async () => row.click());
    const filters = [...other.querySelectorAll("[data-results-row^='gamesSgm-'] > button")];
    expect(filters.map((b) => (b.firstElementChild?.textContent ?? "").replace(/[▸▾]/g, "").trim())).toEqual([
      "$1.5–4", "$3–6", "$4–10", "$10–20", "$20–50", "$50+",
    ]);
    await act(async () => (filters[5] as HTMLButtonElement).click());
    expect(other.textContent).toMatch(/SAS @ POR · Neds · \$69\.15 · 0\.25u/);
    root.unmount();
    host.remove();
  });
});
