import { execFileSync } from "child_process";
import fs from "fs";
import path from "path";
import type { MetaJson, PickLeg, SlateGame } from "./types.js";
import { gameStarted } from "./slate-tip-freeze.js";
import { resolveDataGitRef } from "./restore-data-branch.js";
import { refreshReasonsAtTip } from "./reasons-at-tip.js";
import { freezePicksAfterTip } from "./slate-tip-freeze.js";

function gitOk(rootDir: string, args: string[]): string | null {
  try {
    return execFileSync("git", args, {
      cwd: rootDir,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      maxBuffer: 64 * 1024 * 1024,
    }).trim();
  } catch {
    return null;
  }
}

/** Latest data-branch commit for slate picks strictly before first tip (ISO). */
export function preTipPicksCommit(
  rootDir: string,
  slateDate: string,
  beforeIso: string
): string | null {
  const dataRef = resolveDataGitRef(rootDir);
  if (!dataRef) return null;
  const rel = `public/data/${slateDate}/picks.json`;
  return gitOk(rootDir, [
    "log",
    "-1",
    `--before=${beforeIso}`,
    "--format=%H",
    dataRef,
    "--",
    rel,
  ]);
}

export function loadPreTipPicksFromDataBranch(
  rootDir: string,
  slateDate: string,
  beforeIso: string
): PickLeg[] | null {
  const sha = preTipPicksCommit(rootDir, slateDate, beforeIso);
  if (!sha) return null;
  const rel = `public/data/${slateDate}/picks.json`;
  const raw = gitOk(rootDir, ["show", `${sha}:${rel}`]);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PickLeg[];
  } catch {
    return null;
  }
}

function firstTipIso(slate: SlateGame[]): string | undefined {
  const ms = Math.min(
    ...slate.map((g) => Date.parse(g.startTime)).filter(Number.isFinite)
  );
  return Number.isFinite(ms) ? new Date(ms).toISOString() : undefined;
}

function startedLegsMissingReasons(
  picks: PickLeg[],
  slate: SlateGame[],
  meta: MetaJson | undefined,
  now: Date
): boolean {
  const started = new Set(slate.filter((g) => gameStarted(g, now)).map((g) => g.id));
  if (!started.size) return false;
  const frozen = new Map((meta?.reasonsAtTip ?? []).map((r) => [r.id, r]));
  for (const leg of picks) {
    if (!started.has(leg.gameId)) continue;
    const snap = frozen.get(leg.id);
    const reasonCount = snap?.reasons?.length ?? leg.reasons?.length ?? 0;
    if (reasonCount < 2 && (leg.market === "pts" || leg.market === "reb" || leg.market === "ast")) {
      return true;
    }
    if (!snap && (leg.reasons?.length ?? 0) < 2) return true;
  }
  return false;
}

/** Backfill pick rows + reasonsAtTip from pre-tip data-branch picks when post-tip JSON lost freeze. */
export function restorePicksAndReasonsAtTip(input: {
  rootDir: string;
  slateDate: string;
  slate: SlateGame[];
  picks: PickLeg[];
  priorPicks?: PickLeg[];
  meta?: MetaJson;
  now: Date;
}): { picks: PickLeg[]; reasonsAtTip: ReturnType<typeof refreshReasonsAtTip> } {
  const tipIso = firstTipIso(input.slate);
  let picks = input.picks;
  let previous = input.priorPicks ?? [];

  if (
    tipIso &&
    startedLegsMissingReasons(picks, input.slate, input.meta, input.now)
  ) {
    const preTip = loadPreTipPicksFromDataBranch(input.rootDir, input.slateDate, tipIso);
    if (preTip?.length) {
      if (!previous.length) {
        const onDisk = path.join(
          input.rootDir,
          "public/data",
          input.slateDate,
          "picks.json"
        );
        if (fs.existsSync(onDisk)) {
          try {
            previous = JSON.parse(fs.readFileSync(onDisk, "utf8")) as PickLeg[];
          } catch {
            /* */
          }
        }
      }
      const prevForFreeze = previous.length ? previous : preTip;
      picks = freezePicksAfterTip(prevForFreeze, picks, input.slate, input.now);
      const stillMissing = startedLegsMissingReasons(picks, input.slate, input.meta, input.now);
      if (stillMissing) {
        picks = freezePicksAfterTip(preTip, picks, input.slate, input.now);
      }
    }
  }

  const reasonsAtTip = refreshReasonsAtTip(
    input.meta?.reasonsAtTip,
    picks,
    input.slate,
    input.now
  );

  return { picks, reasonsAtTip };
}