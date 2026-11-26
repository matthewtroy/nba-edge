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

  it("restores Cam Spencer pts 15 to Boozer out, Shot volume, Minutes", () => {
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
    expect(lines).toHaveLength(3);
    expect(lines[0]).toMatch(/^Boozer out/);
    expect(lines[1]).toMatch(/^Shot volume/);
    expect(lines[2]).toMatch(/^Minutes up/);
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
    expect(davion).toHaveLength(3);
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
    expect(pre?.committedAt).toBe("2026-11-25T19:46:44+00:00");

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
