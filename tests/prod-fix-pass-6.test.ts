/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import type { InjuryEntry, MultiBet, PickLeg, SlateGame } from "../lib/types";
import { MultiCardHeader } from "../src/components/MultiCardHeader";
import { MultiCard } from "../src/components/MultiCard";
import { fixtureSlateDir, loadPublishedSlate } from "./public-data-fixture";
import { picksByIdFromOfficialSnapshots } from "../lib/official-leg-snapshot";
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
import { createElement, act, Profiler } from "react";
import { createRoot } from "react-dom/client";
import {
  VALUE_SINGLE_MIN_EDGE,
  freezeValueSingles,
  isValueSingle,
  valueLegRowsFromSingles,
} from "../lib/value-leg-track";
import { valueSinglesForSlate } from "../lib/value-singles-source";
import { clearRetiredStorage } from "../src/lib/retired-storage";
import { TodayScreen } from "../src/screens/TodayScreen";
import os from "os";
import { planScoreboardSlates, mergePlanWithPersisted } from "../lib/slate-retention";
import { forwardSlateMetadataFromGames } from "../lib/index-forward-scan";
import { resolveSlateOddsMaps } from "../lib/odds-slate-cache";
import { oddsCreditsLogLine, type OddsCacheFile } from "../lib/odds-cache-file";
import { detectOddsPullTrigger } from "../scripts/odds-schedule";
import { slateAwaitingPrices } from "../lib/slate-odds-ui";
import { filterAndSortPicks } from "../src/lib/picks-list";
import { PickLegRow } from "../src/components/PickLegRow";
import { resolveViewerSlateSegment } from "../lib/viewer-slate";
import type { DataIndexFile } from "../lib/data-index";
import type { DataBundle } from "../src/hooks/useData";
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

describe("item 7: Cross SGM tint spans the card inner width like Main Play", () => {
  const dir = fixtureSlateDir("2026-11-26");
  const { slate, picks } = loadPublishedSlate("2026-11-26");
  const official = JSON.parse(fs.readFileSync(path.join(dir, "official-card.json"), "utf8")) as OfficialCardFile;
  const picksById = picksByIdFromOfficialSnapshots(official.legSnapshots, picks);

  async function renderCard(type: MultiBet["type"]) {
    const multi = official.multis.find((m) => m.type === type)!;
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => {
      root.render(
        createElement(MultiCard, {
          multi,
          picksById,
          injuries: official.injuries,
          slate,
          officialDisplayOnly: true,
          lockedBookie: multi.bestBookie,
          liveCatalog: picks,
          slateDate: "2026-11-26",
          onLegTap: () => {},
          onCopy: () => {},
        })
      );
    });
    return { host, done: () => (root.unmount(), host.remove()) };
  }

  /** Horizontal px offset of an element from the card's inner (padding) edge, from Tailwind spacing classes. */
  function insetPx(classes: string[]): number {
    let px = 0;
    for (const c of classes) {
      const m = c.match(/^(-?)(mx|px|p)-(\d+(?:\.5)?)$/);
      if (!m) continue;
      const v = Number(m[3]) * 4;
      px += m[2] === "mx" ? (m[1] ? -v : v) : v;
    }
    return px;
  }

  it("Cross leg rows use the same bleed as Main Play, cancelling the card padding exactly", async () => {
    const widths: Record<string, number> = {};
    for (const type of ["mainPlay", "crossGameSgm"] as const) {
      const { host, done } = await renderCard(type);
      const card = host.querySelector("section")!;
      const rows = card.querySelector("[data-testid='multi-card-leg-rows']")!;
      const cardPad = insetPx(card.className.split(/\s+/));
      const rowsInset = cardPad + insetPx(rows.className.split(/\s+/));
      expect(rows.querySelectorAll("button.grid").length).toBeGreaterThan(0);
      for (const row of rows.querySelectorAll("button.grid")) {
        let el = row.parentElement;
        let extra = 0;
        while (el && el !== rows) {
          extra += insetPx(el.className.split(/\s+/));
          el = el.parentElement;
        }
        widths[type] = rowsInset + extra;
      }
      done();
    }
    expect(widths.mainPlay).toBe(0);
    expect(widths.crossGameSgm).toBe(0);
  });

  it("a mounted card settles after one commit (no render loop)", async () => {
    let commits = 0;
    const multi = official.multis.find((m) => m.type === "crossGameSgm")!;
    const host = document.createElement("div");
    const root = createRoot(host);
    await act(async () => {
      root.render(
        createElement(
          Profiler,
          { id: "card", onRender: () => void commits++ },
          createElement(MultiCard, { multi, picksById, injuries: [], slate, slateDate: "2026-11-26", onLegTap: () => {}, onCopy: () => {} })
        )
      );
    });
    const afterMount = commits;
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });
    expect(commits).toBe(afterMount);
    root.unmount();
  });
});

describe("item 8: Personal multis removed", () => {
  it("no UI or code path remains", () => {
    const files = ["src", "lib"].flatMap((d) =>
      (fs.readdirSync(d, { recursive: true }) as string[]).map((f) => path.join(d, f))
    );
    expect(files.filter((f) => /personal-?multi/i.test(f))).toEqual([]);
    const hits = files
      .filter((f) => /\.(ts|tsx)$/.test(f) && f !== "src/lib/retired-storage.ts" && fs.existsSync(f))
      .filter((f) => /Personal multis|usePersonalMultis|PersonalMultiBuilder|personal-multi|"personal"/.test(fs.readFileSync(f, "utf8")));
    expect(hits).toEqual([]);
  });

  it("clears the saved personal multis key on load and keeps everything else", () => {
    localStorage.clear();
    localStorage.setItem("nba-edge-personal-multis-v1", JSON.stringify([{ id: "p-1", legIds: ["a", "b"] }]));
    localStorage.setItem("multi-bookie:personal:mainPlay:Personal:a,b", "Neds");
    localStorage.setItem("multi-bookie:today:mainPlay::a,b", "Sportsbet");
    localStorage.setItem("nba-edge-admin", "1");
    expect(clearRetiredStorage(localStorage).sort()).toEqual([
      "multi-bookie:personal:mainPlay:Personal:a,b",
      "nba-edge-personal-multis-v1",
    ]);
    expect(localStorage.getItem("nba-edge-personal-multis-v1")).toBeNull();
    expect(localStorage.getItem("multi-bookie:today:mainPlay::a,b")).toBe("Sportsbet");
    expect(localStorage.getItem("nba-edge-admin")).toBe("1");
    expect(fs.readFileSync("src/main.tsx", "utf8")).toMatch(/clearRetiredStorage\(window\.localStorage\)/);
    localStorage.clear();
  });
});

describe("item 9: Home has nothing between the date tabs and the first card", () => {
  it("the first card follows the date tabs directly (26 Nov official card)", async () => {
    const dir = fixtureSlateDir("2026-11-26");
    const { slate, picks, meta, multisRaw } = loadPublishedSlate("2026-11-26");
    const official = JSON.parse(fs.readFileSync(path.join(dir, "official-card.json"), "utf8")) as OfficialCardFile;
    const index = JSON.parse(fs.readFileSync(path.join(dir, "..", "data-index.json"), "utf8"));
    const data = {
      index: { ...index, todayDate: "2026-11-26", nextSlateDate: "2026-11-28", dates: ["2026-11-26"] },
      selectedDate: "2026-11-26",
      slate,
      injuries: [],
      picks,
      multis: Array.isArray(multisRaw) ? multisRaw : multisRaw.bets ?? [],
      multisNotBuilt: [],
      officialCard: official,
      meta,
      history: { entries: [] },
      results: null,
      loading: false,
    } as unknown as DataBundle;
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => {
      root.render(
        createElement(TodayScreen, {
          data,
          slateDate: "2026-11-26",
          todayDate: "2026-11-26",
          tomorrowDate: "2026-11-28",
          viewerTodayYmd: "2026-11-26",
          viewerTimeZone: "Australia/Sydney",
          onSlateDateChange: () => {},
          onLegTap: () => {},
          onCopy: () => {},
          showQ1: true,
          showLongshots: true,
          liveTracking: { snapshot: null, legViews: new Map(), betViews: new Map() },
        })
      );
    });
    const screen = host.firstElementChild!;
    const [tabs, next] = Array.from(screen.children);
    expect(tabs.querySelectorAll("button").length).toBe(2);
    expect(next.tagName).toBe("SECTION");
    expect(next.querySelector("[data-testid='multi-card-header']")?.textContent).toMatch(/^Main Play@\$11\.59/);
    expect(screen.querySelectorAll("section").length).toBeGreaterThan(1);
    root.unmount();
    host.remove();
  });
});

describe("item 10: Saturday slate before odds", () => {
  const fx = JSON.parse(
    fs.readFileSync(path.join(import.meta.dirname, "fixtures/next-slate/2026-11-28-pre-odds.json"), "utf8")
  ) as { slate: SlateGame[]; picks: PickLeg[]; legCount: number };
  /** Thu 26/11 22:00 Sydney: Fri 27/11 has no NBA (US Thanksgiving), Sat 28/11 has 11 games. */
  const thuNight = new Date("2026-11-26T11:00:00.000Z");
  const finalThu = { ...fx.slate[0]!, id: "thu-final", startTime: "2026-11-25T22:00:00.000Z", status: "post" };

  it("pipeline plans Sat 28/11 as the next slate when Fri 27/11 is empty", () => {
    const plan = planScoreboardSlates([finalThu, ...fx.slate], thuNight);
    expect(plan.today.map((g) => g.id)).toEqual(["thu-final"]);
    expect(plan.tomorrow).toHaveLength(11);
    const fwd = forwardSlateMetadataFromGames([finalThu, ...fx.slate], thuNight)!;
    expect(fwd.nextSlateDate).toBe("2026-11-28");
    expect(fwd.nextPublishAt).toBe("2026-11-27T10:00:00.000Z");
  });

  it("restores the persisted Sat folder when the scoreboard is unavailable", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "next-slate-"));
    fs.mkdirSync(path.join(tmp, "2026-11-28"));
    fs.writeFileSync(path.join(tmp, "2026-11-28", "slate.json"), JSON.stringify(fx.slate));
    const plan = mergePlanWithPersisted({ today: [], tomorrow: [] }, tmp, thuNight);
    expect(plan.tomorrow).toHaveLength(11);
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it("Sat legs get no stale prices from another slate's pull", () => {
    const brunson = fx.picks.find((p) => p.playerName === "Jalen Brunson")!;
    const cache: OddsCacheFile = {
      lastPulled: "2026-11-25T10:29:00.533Z",
      oddsMap: { "jalen brunson|pts|25": { price: 1.9, bookie: "Neds" } },
      bySlateDate: {
        "2026-11-26": {
          lastPulled: "2026-11-25T10:29:00.533Z",
          oddsMap: { "jalen brunson|pts|25": { price: 1.9, bookie: "Neds" } },
        },
      },
    };
    const sat = resolveSlateOddsMaps(cache, "2026-11-28", fx.slate, [brunson.playerName], new Map([["jalen brunson", fx.slate[0]!.homeTeamId]]));
    expect(sat.best.size).toBe(0);
    expect(sat.lastPulled).toBeUndefined();
  });

  it("the 9pm pull runs on Fri for Sat, not on Thu (no extra credits)", () => {
    const thu9pm = new Date("2026-11-26T10:15:00.000Z");
    const fri9pm = new Date("2026-11-27T10:15:00.000Z");
    expect(detectOddsPullTrigger(thu9pm, fx.slate, {}, { nextSlateTipDate: "2026-11-28" })).toBeNull();
    expect(detectOddsPullTrigger(fri9pm, fx.slate, {}, { nextSlateTipDate: "2026-11-28" })).toBe("scheduled_9pm");
  });

  it("logs creditsRemaining read from the Odds API header", () => {
    expect(oddsCreditsLogLine({ creditsRemaining: 124, creditsRemainingAt: "2026-11-27T10:00:41.000Z" })).toBe(
      "odds credits: 124 remaining (Odds API x-requests-remaining, read 2026-11-27T10:00:41.000Z)"
    );
    expect(oddsCreditsLogLine({})).toMatch(/unknown/);
  });

  it(`Sat model legs without odds: ${fx.legCount} legs across 11 games, all shown with fair/prob/Past5`, () => {
    expect(fx.picks).toHaveLength(fx.legCount);
    expect(new Set(fx.picks.map((p) => p.gameId)).size).toBe(11);
    expect(fx.picks.every((p) => p.fairPrice > 1 && p.probability > 0 && (p.recentVsLine ?? []).length > 0)).toBe(true);
    expect(slateAwaitingPrices({ slateDate: "2026-11-28", todayDate: "2026-11-26", picks: fx.picks })).toBe(true);
    const shown = filterAndSortPicks({
      picks: fx.picks,
      slate: fx.slate,
      multis: [],
      myBookie: "Sportsbet",
      filters: { multi: "all", market: "all", show: "value", sort: "edge", sortAsc: false },
      pricesPending: true,
    });
    expect(shown).toHaveLength(fx.legCount);
    expect(shown[0]!.probability).toBeGreaterThanOrEqual(shown[shown.length - 1]!.probability);
    const html = renderToStaticMarkup(
      createElement(PickLegRow, { leg: shown[0]!, injuries: [], slate: fx.slate, myBookie: "Sportsbet", onTap: () => {}, pricesPending: true })
    );
    expect(html).toContain("Prices at 9pm");
    expect(html).toContain(`${Math.round(shown[0]!.probability * 100)}%`);
    expect(html).toContain(`Fair ${shown[0]!.fairPrice.toFixed(2)}`);
  });

  it("a UTC viewer's second tab is never a past slate", () => {
    const index = {
      updatedAt: thuNight.toISOString(),
      todayDate: "2026-11-26",
      tomorrowDate: null,
      defaultDate: "2026-11-26",
      dates: [
        { date: "2026-11-25", status: "locked_at_tip", statusLabel: "", gameCount: 2, legCount: 1, multiCount: 1, lastUpdated: "", firstTipIso: "2026-11-25T01:00:00.000Z" },
        { date: "2026-11-26", status: "locked_at_tip", statusLabel: "", gameCount: 9, legCount: 1, multiCount: 1, lastUpdated: "", firstTipIso: "2026-11-25T22:00:00.000Z" },
        { date: "2026-11-28", status: "draft", statusLabel: "", gameCount: 11, legCount: 1, multiCount: 0, lastUpdated: "", firstTipIso: "2026-11-28T00:00:00.000Z" },
      ],
    } as DataIndexFile;
    expect(resolveViewerSlateSegment(index, thuNight, "UTC").tomorrowFolder).toBe("2026-11-28");
    expect(resolveViewerSlateSegment(index, thuNight, "Australia/Sydney").tomorrowFolder).toBe("2026-11-28");
  });
});
