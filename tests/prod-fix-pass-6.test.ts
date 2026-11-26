/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import type { InjuryEntry, MultiBet, PickLeg, SlateGame } from "../lib/types";
import { MultiCardHeader } from "../src/components/MultiCardHeader";
import { multiCardTitle } from "../lib/multi-combined";
import { renderToStaticMarkup } from "react-dom/server";
import { injuriesForInjuryPanel, seedInjuriesAtTipFromPreTip } from "../lib/injuries-at-tip";
import { injuryRowKey, mergeInjuriesReportTime } from "../lib/injury-tip-freeze";
import type { OfficialCardFile } from "../lib/official-card-time";
import { backfillCardFreezes } from "../lib/card-freeze-backfill";
import { freezeGamesSgms, settleGamesSgms } from "../lib/games-sgm-freeze";
import { finalPlayerBox, voidAdjustedPrice } from "../lib/settle-core";
import { gradePickCatalog } from "../lib/graded-leg";
import { loadPreAppMainPlays, preAppMainPlayRows } from "../lib/pre-app-main-plays";
import { ResultsScreen } from "../src/screens/ResultsScreen";
import { ADMIN_STORAGE_KEY, readAdminMode } from "../src/hooks/useAdminMode";
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

describe("item 3: Injuries tab shows today's teams after tip", () => {
  const inj = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), "tests/fixtures/injuries/2026-11-26-a199542.json"), "utf8")
  ) as { slate: SlateGame[]; injuries: InjuryEntry[]; injuriesAtTip: InjuryEntry[] };
  const afterTips = new Date("2026-11-26T10:00:00Z");

  it("26 Nov (a199542): 62 feed rows, empty injuriesAtTip → panel shows all 62 across 9 games", () => {
    expect(inj.injuriesAtTip).toEqual([]);
    const panel = injuriesForInjuryPanel(inj.injuries, inj.injuriesAtTip, inj.slate, afterTips);
    expect(panel).toHaveLength(62);
    expect(new Set(panel.map((r) => r.gameId)).size).toBe(9);
  });

  it("started games prefer frozen at-tip rows when they exist", () => {
    const game = inj.slate[0]!;
    const frozen = { ...inj.injuries.find((r) => r.gameId === game.id)!, status: "Out" as const, playerName: "Frozen Row" };
    const panel = injuriesForInjuryPanel(inj.injuries, [frozen], inj.slate, afterTips);
    expect(panel.filter((r) => r.gameId === game.id).map((r) => r.playerName)).toEqual(["Frozen Row"]);
  });

  it("seeds at-tip rows per started game from that game's pre-tip copy", () => {
    const tips: string[] = [];
    const { rows, seededGameIds } = seedInjuriesAtTipFromPreTip([], inj.slate, afterTips, (tipIso) => {
      tips.push(tipIso);
      return inj.injuries;
    });
    expect(seededGameIds).toHaveLength(9);
    expect(new Set(tips)).toEqual(new Set(inj.slate.map((g) => g.startTime)));
    expect(rows).toHaveLength(62);
    const again = seedInjuriesAtTipFromPreTip(rows, inj.slate, afterTips, () => {
      throw new Error("not reloaded");
    });
    expect(again.seededGameIds).toEqual([]);
  });

  it("rows without playerId are not collapsed into one", () => {
    const a = { playerName: "A", teamId: "1", teamName: "T", gameId: "g", status: "Out", source: "ESPN", updatedAt: "2026-11-25T00:00Z" } as InjuryEntry;
    const b = { ...a, playerName: "B" };
    expect(mergeInjuriesReportTime([a, b])).toHaveLength(2);
    expect(injuryRowKey(a)).toBe("1:A");
  });
});

describe("item 4: Results display — no ROI, Singles, no row dots, admin by-market", () => {
  function slice() {
    const singles = freezeValueSingles([
      leg({ id: "a", playerId: "a", market: "pts", bookiePrices: { TAB: 2.5 } }),
      leg({ id: "b", playerId: "b", market: "reb", bookiePrices: { TAB: 3 } }),
    ]);
    return buildResultsSlice({
      officialLegs: [],
      officialBets: preAppMainPlayRows(loadPreAppMainPlays(process.cwd())),
      valueLegRows: valueLegRowsFromSingles("2026-11-26", singles, [graded("a", "won"), graded("b", "lost")]),
      gradedLegs: [],
    });
  }
  async function render() {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => {
      root.render(createElement(ResultsScreen, { data: { results: slice() } as unknown as DataBundle }));
    });
    return { host, done: () => (root.unmount(), host.remove()) };
  }

  it("?admin=1 stores the flag on the device, ?admin=0 clears it", () => {
    localStorage.clear();
    expect(readAdminMode("", localStorage)).toBe(false);
    expect(readAdminMode("?admin=1", localStorage)).toBe(true);
    expect(readAdminMode("", localStorage)).toBe(true);
    expect(readAdminMode("?admin=0", localStorage)).toBe(false);
    expect(localStorage.getItem(ADMIN_STORAGE_KEY)).toBeNull();
  });

  it("no ROI, Singles not Value legs, no ▸ dots, no by-market rows for viewers", async () => {
    localStorage.clear();
    const { host, done } = await render();
    for (const b of host.querySelectorAll("button")) await act(async () => (b as HTMLButtonElement).click());
    const text = host.textContent ?? "";
    expect(text).not.toMatch(/ROI/);
    expect(text).not.toMatch(/Value legs/);
    expect(host.querySelector("[data-results='singles'] h2")?.textContent).toBe("Singles");
    expect(host.querySelector("[data-results='other-bets']")?.textContent).not.toMatch(/[▸▾]/);
    expect(host.querySelector("[data-results='admin']")).toBeNull();
    done();
  });

  it("admin flag shows by-market rows in an Admin section at the bottom", async () => {
    localStorage.setItem(ADMIN_STORAGE_KEY, "1");
    const { host, done } = await render();
    const sections = [...host.querySelectorAll("section")];
    expect(sections.at(-1)?.getAttribute("data-results")).toBe("admin");
    expect(sections.at(-1)?.textContent).toMatch(/Singles by market/);
    expect(sections.at(-1)?.textContent).toMatch(/pts1–0/);
    localStorage.clear();
    done();
  });
});

describe("item 5: card headers — bet type, total, bookie, stake chip only", () => {
  const header = (props: Parameters<typeof MultiCardHeader>[0]) => {
    const host = document.createElement("div");
    host.innerHTML = renderToStaticMarkup(createElement(MultiCardHeader, props));
    return host;
  };

  it("renders title @ total · bookie and a units chip, nothing else", () => {
    const host = header({ title: "Main Play", total: 11.59, bookie: "Ladbrokes", stakeUnits: 1 });
    expect(host.textContent).toBe("Main Play@$11.59·Ladbrokes1u");
    expect(host.querySelector("[data-testid='multi-card-stake']")?.textContent).toBe("1u");
    expect(header({ title: "Booster", total: 215.94, bookie: "Ladbrokes", stakeUnits: 0.05 }).textContent).toMatch(/0\.05u$/);
  });

  it("no Published @, Take/fair×1.08 or Q1 bookie-feed lines in the header source", () => {
    const src = fs.readFileSync(path.join(process.cwd(), "src/components/MultiCardHeader.tsx"), "utf8");
    expect(src).not.toMatch(/Published|Republished|fair×1\.08|No bookie feed|Best:/);
    const card = fs.readFileSync(path.join(process.cwd(), "src/components/MultiCard.tsx"), "utf8");
    expect(card).not.toMatch(/fairNote|publishedAt=\{/);
  });

  it("Q1 header shows its take total and stake with no explanatory line", () => {
    const q1: MultiBet = {
      type: "q1Multi",
      label: "Q1 Multi",
      legs: ["a", "b"],
      combinedProbability: 0.25,
      combinedFairPrice: 4,
      combinedTakeAt: 4.32,
      summary: "",
    };
    const legs = [leg({ id: "a", probability: 0.5, fairPrice: 2 }), leg({ id: "b", playerId: "b", probability: 0.5, fairPrice: 2 })];
    const t = multiCardTitle(q1, legs);
    expect(t.takeAtTotal).toBe(4.32);
  });
});

describe("item 6: softer won/lost tint on Home, Games and Picks", () => {
  const css = fs.readFileSync(path.join(process.cwd(), "src/index.css"), "utf8");
  const block = (cls: string) => css.match(new RegExp(`\\.${cls}\\s*\\{[\\s\\S]*?\\}`))?.[0] ?? "";

  it("won fades 0.07 → 0.03 → 0", () => {
    const b = block("leg-row-live-won");
    expect(b).toMatch(/rgba\(52, 211, 153, 0\.07\) 0%/);
    expect(b).toMatch(/rgba\(52, 211, 153, 0\.03\) 40%/);
    expect(b).toMatch(/rgba\(52, 211, 153, 0\) 85%/);
  });

  it("lost fades 0.06 → 0.025 → 0", () => {
    const b = block("leg-row-live-lost");
    expect(b).toMatch(/rgba\(248, 113, 113, 0\.06\) 0%/);
    expect(b).toMatch(/rgba\(248, 113, 113, 0\.025\) 40%/);
    expect(b).toMatch(/rgba\(248, 113, 113, 0\) 85%/);
  });

  it("Home/Games (MultiLegRow) and Picks (PickLegRow) share the tint classes", () => {
    for (const f of ["src/components/MultiLegRow.tsx", "src/components/PickLegRow.tsx"]) {
      expect(fs.readFileSync(path.join(process.cwd(), f), "utf8")).toMatch(/legRowLiveTrackingClass\(liveView\)/);
    }
  });
});
