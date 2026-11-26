/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from "vitest";
import { execFileSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import {
  freezeTippedSlate,
  freezeTippedSlateFolders,
  gitPreTipLoader,
  preTipPicksCommit,
  type PreTipLoader,
} from "../lib/reasons-at-tip-restore";
import { legRowReasonLines } from "../lib/leg-row-reasons";
import { reasonsAtTipByLegId } from "../lib/reasons-at-tip";
import type { MetaJson, PickLeg, SlateGame } from "../lib/types";
import { officialStakeUnits } from "../lib/pricing-config";
import { settleOfficialBets } from "../lib/official-bet-settle";
import type { OfficialCardFile } from "../lib/official-card-time";
import type { SettledLegRow } from "../lib/settle-core";
import { extraOfficialBetRows, loadExtraOfficialBets } from "../lib/extra-official-bets";
import { buildResultsSlice } from "../lib/results-aggregate";
import { loadPreAppMainPlays, preAppMainPlayRows } from "../lib/pre-app-main-plays";
import { freezeGamesSgms, frozenGameSgmBlocks, settleGamesSgms } from "../lib/games-sgm-freeze";
import { writeOfficialCard } from "../lib/official-card";
import { picksByIdFromOfficialSnapshots } from "../lib/official-leg-snapshot";
import { ResultsScreen } from "../src/screens/ResultsScreen";
import type { DataBundle } from "../src/hooks/useData";
import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { act } from "react";

interface ReasonsFixture {
  commit: string;
  committedAt: string;
  slate: SlateGame[];
  preTip: PickLeg[];
  postTip: PickLeg[];
}

const fx = JSON.parse(
  fs.readFileSync(
    path.join(process.cwd(), "tests/fixtures/reasons-at-tip/2026-11-26.json"),
    "utf8"
  )
) as ReasonsFixture;

const afterAllTips = new Date("2026-11-26T09:00:00.000Z");

function fixtureLoader(calls: string[] = []): PreTipLoader {
  return (_date, firstTipAt, pinned) => {
    calls.push(pinned ? `pinned:${pinned.commit}` : `lookup:${firstTipAt}`);
    return {
      frozenFrom: {
        commit: pinned?.commit ?? fx.commit,
        committedAt: pinned?.committedAt ?? fx.committedAt,
        firstTipAt,
      },
      picks: fx.preTip,
    };
  };
}

function reasonTextsFor(id: string, picks: PickLeg[], meta: Pick<MetaJson, "reasonsAtTip">) {
  const leg = picks.find((p) => p.id === id)!;
  return legRowReasonLines(leg, reasonsAtTipByLegId(meta.reasonsAtTip)).map((r) => r.text);
}

describe("prod fix pass 5 — tipped slate reasons freeze", () => {
  it("post-tip Cam Spencer pts 15 had only the minutes reason", () => {
    const cam = fx.postTip.find((p) => p.id === "4433083-pts-15")!;
    expect(cam.reasons.map((r) => r.text)).toEqual(["Minutes up: 28 last 5 (season 25)"]);
  });

  it("restores Cam Spencer pts 15 with injury plus display-safe reasons", () => {
    const out = freezeTippedSlate({
      slateDate: "2026-11-26",
      slate: fx.slate,
      picks: fx.postTip,
      now: afterAllTips,
      loadPreTip: fixtureLoader(),
    });
    expect(out.status).toBe("frozen");
    expect(out.reasonsFrozenFrom?.commit).toBe(fx.commit);
    expect(out.reasonsFrozenFrom?.firstTipAt).toBe("2026-11-25T22:00:00.000Z");
    const lines = reasonTextsFor("4433083-pts-15", out.picks, out);
    expect(lines.length).toBeGreaterThanOrEqual(2);
    expect(lines[0]).toMatch(/^Boozer out/);
    expect(lines.some((t) => /at this line|Avg /i.test(t))).toBe(true);
  });

  it("copies tags, prob, fair, L5, L10 from the pre-tip leg", () => {
    const out = freezeTippedSlate({
      slateDate: "2026-11-26",
      slate: fx.slate,
      picks: fx.postTip,
      now: afterAllTips,
      loadPreTip: fixtureLoader(),
    });
    for (const id of ["4433083-pts-15", "4278053-pts-15"]) {
      const pre = fx.preTip.find((p) => p.id === id)!;
      const got = out.picks.find((p) => p.id === id)!;
      expect(got.reasons).toEqual(pre.reasons);
      expect(got.tags).toEqual(pre.tags);
      expect(got.probability).toBe(pre.probability);
      expect(got.fairPrice).toBe(pre.fairPrice);
      expect(got.takeAt).toBe(pre.takeAt);
      expect(got.recentVsLine).toEqual(pre.recentVsLine);
      expect(got.recentTenVsLine).toEqual(pre.recentTenVsLine);
    }
    const davion = reasonTextsFor("4278053-pts-15", out.picks, out);
    expect(davion.length).toBeGreaterThanOrEqual(2);
  });

  it("re-applies the pinned commit and never re-chooses after tip", () => {
    const calls: string[] = [];
    const pinned = {
      commit: "pinned-sha",
      committedAt: "2026-11-25T19:00:00+00:00",
      firstTipAt: "2026-11-25T22:00:00.000Z",
    };
    const out = freezeTippedSlate({
      slateDate: "2026-11-26",
      slate: fx.slate,
      picks: fx.postTip,
      meta: { reasonsFrozenFrom: pinned },
      now: afterAllTips,
      loadPreTip: fixtureLoader(calls),
    });
    expect(calls).toEqual(["pinned:pinned-sha"]);
    expect(out.status).toBe("pinned");
    expect(out.reasonsFrozenFrom).toEqual(pinned);
  });

  it("leaves untipped slates alone", () => {
    const calls: string[] = [];
    const out = freezeTippedSlate({
      slateDate: "2026-11-26",
      slate: fx.slate.map((g) => ({ ...g, status: "scheduled" })),
      picks: fx.postTip,
      now: new Date("2026-11-25T20:00:00.000Z"),
      loadPreTip: fixtureLoader(calls),
    });
    expect(out.status).toBe("not_tipped");
    expect(calls).toEqual([]);
    expect(out.picks).toBe(fx.postTip);
  });
});

describe("prod fix pass 5 — data branch commit selection", () => {
  function git(cwd: string, args: string[], date?: string) {
    execFileSync("git", args, {
      cwd,
      stdio: "ignore",
      env: {
        ...process.env,
        GIT_AUTHOR_NAME: "t",
        GIT_AUTHOR_EMAIL: "t@t",
        GIT_COMMITTER_NAME: "t",
        GIT_COMMITTER_EMAIL: "t@t",
        ...(date ? { GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date } : {}),
      },
    });
  }

  function writePicks(root: string, picks: PickLeg[]) {
    const dir = path.join(root, "public/data/2026-11-26");
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "picks.json"), JSON.stringify(picks));
  }

  it("uses the last commit strictly before first tip and persists frozenFrom", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "tip-freeze-"));
    git(root, ["init", "-q", "-b", "data"]);
    writePicks(root, fx.preTip);
    git(root, ["add", "."]);
    git(root, ["commit", "-qm", "pre"], "2026-11-25T19:46:44+00:00");
    writePicks(root, fx.postTip);
    git(root, ["commit", "-qam", "at tip"], "2026-11-25T22:00:00+00:00");
    git(root, ["commit", "-q", "--allow-empty", "-m", "noop"], "2026-11-25T23:00:00+00:00");

    const pre = preTipPicksCommit(root, "2026-11-26", "2026-11-25T22:00:00.000Z");
    expect(Date.parse(pre?.committedAt ?? "")).toBe(Date.parse("2026-11-25T19:46:44Z"));

    const outDir = path.join(root, "public/data");
    const dir = path.join(outDir, "2026-11-26");
    fs.writeFileSync(path.join(dir, "slate.json"), JSON.stringify(fx.slate));
    fs.writeFileSync(path.join(dir, "meta.json"), JSON.stringify({ lastUpdated: "x" }));
    const summaries = freezeTippedSlateFolders({
      rootDir: root,
      outDir,
      now: afterAllTips,
      loadPreTip: gitPreTipLoader(root),
    });
    expect(summaries[0]?.status).toBe("frozen");
    const meta = JSON.parse(fs.readFileSync(path.join(dir, "meta.json"), "utf8")) as MetaJson;
    expect(meta.reasonsFrozenFrom?.commit).toBe(pre?.commit);
    const picks = JSON.parse(fs.readFileSync(path.join(dir, "picks.json"), "utf8")) as PickLeg[];
    expect(reasonTextsFor("4433083-pts-15", picks, meta)[0]).toMatch(/^Boozer out/);

    const again = freezeTippedSlateFolders({ rootDir: root, outDir, now: afterAllTips });
    expect(again[0]?.status).toBe("pinned");
    fs.rmSync(root, { recursive: true, force: true });
  });
});

describe("prod fix pass 5 — settle keeps pipeline slate output", () => {
  it("pipeline settle step does not re-restore the data branch over fresh output", () => {
    const pipeline = fs.readFileSync(path.join(process.cwd(), "scripts/pipeline.ts"), "utf8");
    const settle = fs.readFileSync(path.join(process.cwd(), "scripts/settle.ts"), "utf8");
    const step = pipeline.match(/function runSettleStep\(\)[\s\S]*?\n\}/)?.[0] ?? "";
    expect(step).toMatch(/runFreezeTippedReasons\(rootDir\)/);
    expect(step).toMatch(/SETTLE_DATA_RESTORED: "1"/);
    expect(settle).toMatch(
      /if \(process\.env\.SETTLE_DATA_RESTORED !== "1"\) restorePersistedDataFromBranch\(rootDir\)/
    );
  });
});

describe("prod fix pass 5 — official stake bands", () => {
  it("26 Nov published prices map to the specified stakes", () => {
    expect(officialStakeUnits("booster", 215.94)).toBe(0.05);
    expect(officialStakeUnits("crossGameSgm", 6075.4)).toBe(0.1);
    expect(officialStakeUnits("longshot", 63.25)).toBe(0.1);
    expect(officialStakeUnits("mainPlay", 11.59)).toBe(1);
    expect(officialStakeUnits("boostSgm", 7.36)).toBe(1);
  });

  it("core, cross and long band edges", () => {
    for (const kind of ["mainPlay", "doubleUp", "boostSgm", "q1Multi", "gamesSgm"] as const) {
      expect(officialStakeUnits(kind, 20)).toBe(1);
      expect(officialStakeUnits(kind, 20.01)).toBe(0.5);
      expect(officialStakeUnits(kind, 50)).toBe(0.5);
      expect(officialStakeUnits(kind, 75)).toBe(0.25);
      expect(officialStakeUnits(kind, 100.5)).toBe(0.1);
    }
    expect(officialStakeUnits("crossGameSgm", 12)).toBe(0.5);
    expect(officialStakeUnits("crossGameSgm", 35)).toBe(0.25);
    expect(officialStakeUnits("crossGameSgm", 80)).toBe(0.15);
    expect(officialStakeUnits("crossGameSgm", 150)).toBe(0.1);
    expect(officialStakeUnits("booster", 45)).toBe(0.1);
    expect(officialStakeUnits("longshot", 100)).toBe(0.1);
    expect(officialStakeUnits("longshot", 140)).toBe(0.05);
    expect(officialStakeUnits("mainPlay", undefined)).toBe(0);
  });

  it("settle uses bands when the card has no frozen stake, frozen stake otherwise", () => {
    const card = {
      slateDate: "2026-11-26",
      publishedAt: "2026-11-25T11:08:41.132Z",
      lockedAt: "2026-11-25T11:08:41.132Z",
      legSnapshots: {},
      notBuilt: [],
      whatChanged: [],
      injuries: [],
      multis: [
        { type: "booster", label: "Booster", legs: ["a"], bestBookieTotal: 215.94 },
        { type: "mainPlay", label: "Main Play", legs: ["a"], bestBookieTotal: 11.59, stakeUnits: 0.75 },
      ],
    } as unknown as OfficialCardFile;
    const rows = settleOfficialBets(card, [{ id: "a", result: "lost" } as SettledLegRow]);
    expect(rows.map((r) => r.stakeUnits)).toEqual([0.05, 0.75]);
  });

  it("publish freezes the band stake onto the card multis", () => {
    const src = fs.readFileSync(path.join(process.cwd(), "lib/official-card.ts"), "utf8");
    expect(src).toMatch(/stakeUnits: m\.stakeUnits \?\? officialStakeUnits\(m\.type,/);
  });
});

describe("prod fix pass 5 — extra Best SGM", () => {
  const card = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), "tests/fixtures/2026-11-26/official-card.json"), "utf8")
  ) as OfficialCardFile;
  const extraLegs = ["5104157-pts-30", "5104157-reb-13", "4683021-pts-25"];
  const cardLegs = [...new Set(card.multis.flatMap((m) => m.legs))].map(
    (id) => ({ id, slateDate: "2026-11-26", result: "lost" }) as SettledLegRow
  );
  const legResults = new Map<string, "won" | "lost">([
    ...cardLegs.map((l) => [l.id, "lost"] as const),
    ...extraLegs.map((id) => [id, "won"] as const),
  ]);
  const extras = extraOfficialBetRows("2026-11-26", legResults, loadExtraOfficialBets(process.cwd()));
  const bets = [...settleOfficialBets(card, cardLegs), ...extras];
  const slice = buildResultsSlice({
    officialLegs: cardLegs,
    officialBets: bets,
    valueLegRows: [],
    gradedLegs: [],
    now: new Date("2026-11-26T10:00:00Z"),
  });

  it("config bet is a normal bet365 Best SGM: $6.50 +25% boost, 1u, +6.875u", () => {
    expect(extras).toHaveLength(1);
    const sgm = extras[0]!;
    expect(sgm.betType).toBe("boostSgm");
    expect(sgm.label).toBe("Best SGM");
    expect(sgm.bookie).toBe("bet365");
    expect(sgm.legIds).toEqual(extraLegs);
    expect(sgm.publishedCombinedPrice).toBe(7.875);
    expect(sgm.result).toBe("won");
    expect(sgm.stakeUnits).toBe(1);
    expect(sgm.profitUnits).toBeCloseTo(6.875, 6);
    expect(sgm.variant).toBeUndefined();
  });

  it("published Picklebet Best SGM stays and both count under Best SGM", () => {
    const sgms = slice.official.bets.filter((b) => b.betType === "boostSgm");
    expect(sgms.map((b) => b.bookie)).toEqual(["Picklebet", "bet365"]);
    expect(sgms.every((b) => b.label === "Best SGM")).toBe(true);
    const row = slice.official.byBetType["Best SGM"]!;
    expect(row.bets).toBe(2);
    expect(row.won).toBe(1);
    expect(row.lost).toBe(1);
    expect(row.profit).toBeCloseTo(5.875, 6);
  });

  it("Results UI shows both Best SGMs and never the word manual", async () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => {
      root.render(createElement(ResultsScreen, { data: { results: slice } as unknown as DataBundle }));
    });
    const sgmRow = [...host.querySelectorAll("[data-results='other-bets'] button")].find((b) =>
      /Best SGM/.test(b.textContent ?? "")
    ) as HTMLButtonElement;
    expect(sgmRow.textContent).toMatch(/1–1/);
    await act(async () => sgmRow.click());
    const text = host.textContent ?? "";
    expect(text).not.toMatch(/manual/i);
    expect(text).toMatch(/bet365 · \$7\.88/);
    expect(text).toMatch(/Picklebet · \$7\.36/);
    root.unmount();
    host.remove();
  });

  it("no manual wording in config labels, bet rows, or app source", () => {
    expect(JSON.stringify(extras)).not.toMatch(/manual/i);
    const cfg = fs.readFileSync(path.join(process.cwd(), "config/manual-official-bets.json"), "utf8");
    expect(cfg).not.toMatch(/manual/i);
    const srcDir = path.join(process.cwd(), "src");
    const walk = (dir: string): string[] =>
      fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
        e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]
      );
    for (const f of walk(srcDir).filter((f) => /\.(tsx?|css)$/.test(f))) {
      expect(fs.readFileSync(f, "utf8"), f).not.toMatch(/\(manual\)|variant === "manual"/i);
    }
  });
});

describe("prod fix pass 5 — pre-app Main Plays", () => {
  const file = loadPreAppMainPlays(process.cwd());
  const rows = preAppMainPlayRows(file);

  it("seeds exactly the 16 listed Main Plays at 1u on bet365", () => {
    expect(rows).toHaveLength(16);
    expect(rows.map((r) => r.slateDate)).toEqual([
      "2026-10-30", "2026-10-31", "2026-11-06", "2026-11-07", "2026-11-09", "2026-11-12",
      "2026-11-13", "2026-11-14", "2026-11-15", "2026-11-16", "2026-11-17", "2026-11-18",
      "2026-11-19", "2026-11-20", "2026-11-21", "2026-11-22",
    ]);
    expect(rows.map((r) => r.publishedCombinedPrice)).toEqual([
      8.98, 10, 12.19, 18.17, 22, 3.57, 6.77, 8.14, 10, 10, 10, 10, 11.8, 10, 10, 10,
    ]);
    expect(rows.map((r) => r.result).join(",")).toBe(
      "won,won,lost,lost,lost,won,lost,won,won,lost,lost,lost,won,lost,won,lost"
    );
    expect(rows.every((r) => r.betType === "mainPlay" && r.label === "Main Play")).toBe(true);
    expect(rows.every((r) => r.stakeUnits === 1 && r.bookie === "bet365")).toBe(true);
    expect(file.mainPlays?.filter((p) => p.oddsEstimated).map((p) => p.date)).toEqual([
      "2026-10-31", "2026-11-15", "2026-11-16", "2026-11-17", "2026-11-18", "2026-11-20", "2026-11-22",
    ]);
  });

  it("oddsEstimated never reaches bet rows", () => {
    expect(JSON.stringify(rows)).not.toMatch(/estimated/i);
  });

  it("Main Play record with 26 Nov: 7-10, 17u staked, +45.49u", () => {
    const nov26 = { slateDate: "2026-11-26", betType: "mainPlay", label: "Main Play", legIds: ["x"], result: "lost", profitUnits: -1, stakeUnits: 1, publishedCombinedPrice: 11.59 } as const;
    const slice = buildResultsSlice({ officialLegs: [], officialBets: [...rows, nov26], valueLegRows: [], gradedLegs: [] });
    const mp = slice.official.byBetType["Main Play"]!;
    expect([mp.won, mp.lost, mp.bets]).toEqual([7, 10, 17]);
    expect(mp.staked).toBe(17);
    expect(mp.profit).toBeCloseTo(45.49, 6);
    expect(mp.roi).toBeCloseTo(45.49 / 17, 6);
  });

  it("skips a pre-app date once an official card exists for it", () => {
    expect(preAppMainPlayRows(file, new Set(["2026-11-22"]))).toHaveLength(15);
  });
});

describe("prod fix pass 5 — Results redesign", () => {
  const card = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), "tests/fixtures/2026-11-26/official-card.json"), "utf8")
  ) as OfficialCardFile;
  const cardLegs = [...new Set(card.multis.flatMap((m) => m.legs))].map(
    (id) =>
      ({ id, slateDate: "2026-11-26", playerName: `P ${id}`, market: "pts", line: 20, result: "lost" }) as SettledLegRow
  );
  const bets = [
    ...preAppMainPlayRows(loadPreAppMainPlays(process.cwd())),
    ...settleOfficialBets(card, cardLegs),
    ...extraOfficialBetRows(
      "2026-11-26",
      new Map(["5104157-pts-30", "5104157-reb-13", "4683021-pts-25"].map((id) => [id, "won" as const])),
      loadExtraOfficialBets(process.cwd())
    ),
  ];
  const slice = buildResultsSlice({ officialLegs: cardLegs, officialBets: bets, valueLegRows: [], gradedLegs: [] });

  async function render() {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => {
      root.render(createElement(ResultsScreen, { data: { results: slice } as unknown as DataBundle }));
    });
    return { host, done: () => (root.unmount(), host.remove()) };
  }

  it("Main Play is first with W-L, Hit, Avg odds, Staked, Profit incl pre-app", async () => {
    const { host, done } = await render();
    const sections = [...host.querySelectorAll("section")];
    expect(sections[0]?.getAttribute("data-results")).toBe("main-play");
    const mp = sections[0]!.textContent ?? "";
    expect(mp).toMatch(/Main Play/);
    expect(mp).toMatch(/7–10/);
    expect(mp).toMatch(/Hit41\.2%/);
    expect(mp).toMatch(/Avg odds\$10\.78/);
    expect(mp).toMatch(/Staked17\.00u/);
    expect(mp).toMatch(/Profit\+45\.49u/);
    expect(mp).not.toMatch(/ROI/);
    done();
  });

  it("other bets compact table rows in order and expandable", async () => {
    const { host, done } = await render();
    const rows = [...host.querySelectorAll("[data-results='other-bets'] li > button")].map(
      (b) => (b.textContent ?? "").replace(/[▸▾]/g, "").trim()
    );
    expect(rows.map((r) => r.split(/\d/)[0]!.trim())).toEqual([
      "Double Up", "Best SGM", "Cross", "Booster", "Longshot", "Q",
    ]);
    const booster = [...host.querySelectorAll("[data-results='other-bets'] li > button")][3] as HTMLButtonElement;
    expect(booster.textContent).toMatch(/0\.05u/);
    await act(async () => booster.click());
    expect(host.querySelector("[data-results='other-bets']")?.textContent).toMatch(/Ladbrokes · \$215\.94/);
    done();
  });

  it("removes Model check, Last 14 days, beat-market and AU-price lines; no tags", async () => {
    const { host, done } = await render();
    for (const b of host.querySelectorAll("button")) await act(async () => (b as HTMLButtonElement).click());
    const text = host.textContent ?? "";
    expect(text).not.toMatch(/Model check|Last 14 days|Beat the market|AU price|9pm freeze|excludes Q1/i);
    expect(text).not.toMatch(/manual|pre-app|estimated/i);
    expect(text).toMatch(/Singles/);
    done();
  });

  it("Main Play expands to pre-app bets with leg descriptions", async () => {
    const { host, done } = await render();
    const toggle = [...host.querySelectorAll("[data-results='main-play'] button")].find((b) =>
      /17 bets/.test(b.textContent ?? "")
    ) as HTMLButtonElement;
    await act(async () => toggle.click());
    const oct30 = [...host.querySelectorAll("[data-results='main-play'] li > button")].find((b) =>
      /30 Oct/.test(b.textContent ?? "")
    ) as HTMLButtonElement;
    expect(oct30.textContent).toMatch(/bet365 · \$8\.98/);
    await act(async () => oct30.click());
    expect(host.textContent).toMatch(/Sabonis 13\+ reb/);
    done();
  });
});

describe("prod fix pass 5 — Games tab SGMs freeze at publish", () => {
  const fxGames = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), "tests/fixtures/games-sgm-freeze/mia-phi-2026-11-26.json"), "utf8")
  ) as { game: SlateGame; picks: PickLeg[] };
  const frozen = freezeGamesSgms([fxGames.game], fxGames.picks);
  const low = frozen.bets.find((b) => b.filter === "1.5–4")!;
  const high = frozen.bets.find((b) => b.filter === "20–50")!;
  const realResults = new Map<string, "won" | "lost">([
    ["4431678-ast-5", "won"],
    ["3917376-pts-20", "lost"],
    ["4066261-pts-20", "lost"],
    ["4278053-pts-15", "won"],
    ["4351851-pts-10", "lost"],
    ["4601025-3pm-2", "lost"],
    ["4278053-3pm-3", "won"],
  ]);

  it("freezes every price filter for the game with band stakes", () => {
    expect(frozen.bets.map((b) => b.filter)).toEqual(["1.5–4", "3–6", "4–10", "10–20", "20–50", "50+"]);
    expect(low).toMatchObject({ game: "MIA @ PHI", bookie: "Unibet", total: 2.22, stakeUnits: 1 });
    expect(low.legs).toEqual(["4431678-ast-5", "3917376-pts-20"]);
    expect(high).toMatchObject({ bookie: "Ladbrokes", total: 23.81, stakeUnits: 0.5 });
    for (const id of [...low.legs, ...high.legs]) expect(frozen.legSnapshots[id]).toBeDefined();
  });

  it("Games tab shows the frozen legs even after live picks change", () => {
    const picksById = picksByIdFromOfficialSnapshots(frozen.legSnapshots, []);
    for (const preset of [
      { label: "1.5–4", min: 1.5, max: 4 },
      { label: "20–50", min: 20, max: 50 },
    ]) {
      const [block] = frozenGameSgmBlocks([fxGames.game], frozen, preset, picksById);
      const expected = frozen.bets.find((b) => b.filter === preset.label)!;
      expect(block?.card?.legs.map((l) => l.id)).toEqual(expected.legs);
      expect(block?.card?.bestBookie).toBe(expected.bookie);
      expect(block?.card?.bestTotal).toBe(expected.total);
    }
  });

  it("settles two filters with real 26 Nov leg results (both lost)", () => {
    const rows = settleGamesSgms("2026-11-26", { ...frozen, bets: [low, high] }, realResults);
    expect(rows.map((r) => [r.filter, r.result, r.stakeUnits, r.profitUnits])).toEqual([
      ["1.5–4", "lost", 1, -1],
      ["20–50", "lost", 0.5, -0.5],
    ]);
  });

  it("settles a won filter at stake × (price − 1)", () => {
    const allWon = new Map([...low.legs, ...high.legs].map((id) => [id, "won" as const]));
    const rows = settleGamesSgms("2026-11-26", { ...frozen, bets: [low, high] }, allWon);
    expect(rows[0]?.result).toBe("won");
    expect(rows[0]?.profitUnits).toBeCloseTo(1.22, 6);
    expect(rows[1]?.profitUnits).toBeCloseTo(0.5 * 22.81, 6);
  });

  it("publish writes gamesSgms into official-card.json", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "games-sgm-card-"));
    const card = writeOfficialCard(dir, {
      now: new Date("2026-11-25T10:00:00Z"),
      slate: [fxGames.game],
      multis: [],
      notBuilt: [],
      injuries: [],
      meta: { lastUpdated: "x", sources: {}, slateSize: 1, slateTipDate: "2026-11-26" } as MetaJson,
      picks: fxGames.picks,
    });
    const onDisk = JSON.parse(fs.readFileSync(path.join(dir, "official-card.json"), "utf8")) as OfficialCardFile;
    expect(onDisk.gamesSgms?.bets.length).toBe(6);
    expect(onDisk.gamesSgms).toEqual(card.gamesSgms);
    fs.rmSync(dir, { recursive: true, force: true });
  });
});
