import { execFileSync } from "child_process";
import fs from "fs";
import path from "path";
import type {
  MetaJson,
  PickLeg,
  ReasonAtTipSnapshot,
  ReasonsFrozenFrom,
  SlateGame,
} from "./types.js";
import { gameStarted } from "./slate-tip-freeze.js";
import { resolveDataGitRef } from "./restore-data-branch.js";
import { refreshReasonsAtTip } from "./reasons-at-tip.js";
import { SLATE_FOLDER_PATTERN } from "./slate-retention.js";

/** Pick fields copied verbatim from the last pre-tip data commit (reasons/tags/prob/fair/L5/L10). */
export const PRE_TIP_FROZEN_FIELDS = [
  "reasons",
  "reasonLine",
  "tags",
  "probability",
  "modelProbability",
  "marketProbability",
  "fairPrice",
  "takeAt",
  "recentVsLine",
  "recentTenVsLine",
  "lastTenStatValues",
  "lastFiveAvg",
  "seasonAvg",
] as const satisfies readonly (keyof PickLeg)[];

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

function picksRelPath(slateDate: string): string {
  return `public/data/${slateDate}/picks.json`;
}

export function firstTipIso(slate: SlateGame[]): string | undefined {
  const ms = Math.min(
    ...slate.map((g) => Date.parse(g.startTime)).filter(Number.isFinite)
  );
  return Number.isFinite(ms) ? new Date(ms).toISOString() : undefined;
}

export interface PreTipCommit {
  commit: string;
  committedAt: string;
}

/** Latest data-branch commit touching the slate's picks.json with commit time strictly before `beforeIso`. */
export function preTipPicksCommit(
  rootDir: string,
  slateDate: string,
  beforeIso: string
): PreTipCommit | null {
  const dataRef = resolveDataGitRef(rootDir);
  if (!dataRef) return null;
  const cutoff = Date.parse(beforeIso);
  if (!Number.isFinite(cutoff)) return null;
  const out = gitOk(rootDir, [
    "log",
    "-20",
    `--before=${beforeIso}`,
    "--format=%H %cI",
    dataRef,
    "--",
    picksRelPath(slateDate),
  ]);
  if (!out) return null;
  for (const line of out.split("\n")) {
    const [commit, committedAt] = line.trim().split(" ");
    if (!commit || !committedAt) continue;
    if (Date.parse(committedAt) < cutoff) return { commit, committedAt };
  }
  return null;
}

export function loadPicksAtCommit(
  rootDir: string,
  slateDate: string,
  commit: string
): PickLeg[] | null {
  const raw = gitOk(rootDir, ["show", `${commit}:${picksRelPath(slateDate)}`]);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as PickLeg[]) : null;
  } catch {
    return null;
  }
}

/** Overlay pre-tip fields on started-game legs; re-add pre-tip legs the rebuild dropped. */
export function applyPreTipPicks(
  current: PickLeg[],
  preTip: PickLeg[],
  startedGameIds: Set<string>
): PickLeg[] {
  const preById = new Map(preTip.map((p) => [p.id, p]));
  const seen = new Set<string>();
  const out: PickLeg[] = current.map((leg) => {
    seen.add(leg.id);
    const pre = preById.get(leg.id);
    if (!pre || !startedGameIds.has(leg.gameId)) return leg;
    const next: PickLeg = { ...leg };
    const target = next as unknown as Record<string, unknown>;
    const source = pre as unknown as Record<string, unknown>;
    for (const field of PRE_TIP_FROZEN_FIELDS) {
      if (source[field] === undefined) delete target[field];
      else target[field] = source[field];
    }
    return next;
  });
  for (const pre of preTip) {
    if (seen.has(pre.id) || !startedGameIds.has(pre.gameId)) continue;
    out.push(pre);
  }
  return out;
}

export function snapshotReasonsAtTip(
  preTip: PickLeg[],
  startedGameIds: Set<string>
): ReasonAtTipSnapshot[] {
  return preTip
    .filter((p) => startedGameIds.has(p.gameId))
    .map((p) => ({
      id: p.id,
      gameId: p.gameId,
      reasons: p.reasons ?? [],
      ...(p.reasonLine ? { reasonLine: p.reasonLine } : {}),
    }));
}

export type PreTipLoader = (
  slateDate: string,
  firstTipAt: string,
  pinned?: ReasonsFrozenFrom
) => { frozenFrom: ReasonsFrozenFrom; picks: PickLeg[] } | null;

export function gitPreTipLoader(rootDir: string): PreTipLoader {
  return (slateDate, firstTipAt, pinned) => {
    const ref: PreTipCommit | null = pinned
      ? { commit: pinned.commit, committedAt: pinned.committedAt }
      : preTipPicksCommit(rootDir, slateDate, firstTipAt);
    if (!ref) return null;
    const picks = loadPicksAtCommit(rootDir, slateDate, ref.commit);
    if (!picks?.length) return null;
    return {
      frozenFrom: { commit: ref.commit, committedAt: ref.committedAt, firstTipAt },
      picks,
    };
  };
}

export interface TippedSlateFreezeResult {
  picks: PickLeg[];
  reasonsAtTip: ReasonAtTipSnapshot[] | undefined;
  reasonsFrozenFrom?: ReasonsFrozenFrom;
  status: "not_tipped" | "frozen" | "pinned" | "no_pre_tip_commit";
}

/**
 * After first tip, started-game legs come only from the last data commit before tip.
 * Once `reasonsFrozenFrom` is set it is re-applied every run and never re-chosen.
 */
export function freezeTippedSlate(input: {
  slateDate: string;
  slate: SlateGame[];
  picks: PickLeg[];
  meta?: Pick<MetaJson, "reasonsAtTip" | "reasonsFrozenFrom">;
  now: Date;
  loadPreTip: PreTipLoader;
}): TippedSlateFreezeResult {
  const started = new Set(
    input.slate.filter((g) => gameStarted(g, input.now)).map((g) => g.id)
  );
  const tipIso = firstTipIso(input.slate);
  if (!started.size || !tipIso) {
    return {
      picks: input.picks,
      reasonsAtTip: input.meta?.reasonsAtTip,
      reasonsFrozenFrom: input.meta?.reasonsFrozenFrom,
      status: "not_tipped",
    };
  }
  const pinned = input.meta?.reasonsFrozenFrom;
  const loaded = input.loadPreTip(input.slateDate, tipIso, pinned);
  if (!loaded) {
    return {
      picks: input.picks,
      reasonsAtTip: refreshReasonsAtTip(
        input.meta?.reasonsAtTip,
        input.picks,
        input.slate,
        input.now
      ),
      reasonsFrozenFrom: pinned,
      status: "no_pre_tip_commit",
    };
  }
  return {
    picks: applyPreTipPicks(input.picks, loaded.picks, started),
    reasonsAtTip: snapshotReasonsAtTip(loaded.picks, started),
    reasonsFrozenFrom: pinned ?? loaded.frozenFrom,
    status: pinned ? "pinned" : "frozen",
  };
}

export interface TippedFolderSummary {
  slateDate: string;
  status: TippedSlateFreezeResult["status"];
  frozenFrom?: ReasonsFrozenFrom;
  legs: number;
  zeroReasonBefore: number;
  zeroReasonAfter: number;
}

function zeroReasonCount(picks: PickLeg[]): number {
  return picks.filter((p) => !(p.reasons?.length)).length;
}

function readJson<T>(p: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(p, "utf8")) as T;
  } catch {
    return null;
  }
}

/** Freeze every retained `public/data/<date>/` folder whose slate has tipped. */
export function freezeTippedSlateFolders(input: {
  rootDir: string;
  outDir: string;
  now: Date;
  loadPreTip?: PreTipLoader;
}): TippedFolderSummary[] {
  const loader = input.loadPreTip ?? gitPreTipLoader(input.rootDir);
  if (!fs.existsSync(input.outDir)) return [];
  const summaries: TippedFolderSummary[] = [];
  const dates = fs
    .readdirSync(input.outDir)
    .filter((d) => SLATE_FOLDER_PATTERN.test(d))
    .sort();
  for (const slateDate of dates) {
    const dir = path.join(input.outDir, slateDate);
    const slate = readJson<SlateGame[]>(path.join(dir, "slate.json"));
    const picks = readJson<PickLeg[]>(path.join(dir, "picks.json"));
    const meta = readJson<MetaJson>(path.join(dir, "meta.json"));
    if (!slate?.length || !picks || !meta) continue;
    const result = freezeTippedSlate({
      slateDate,
      slate,
      picks,
      meta,
      now: input.now,
      loadPreTip: loader,
    });
    if (result.status === "not_tipped") continue;
    if (result.status !== "no_pre_tip_commit") {
      fs.writeFileSync(path.join(dir, "picks.json"), JSON.stringify(result.picks, null, 2));
    }
    const metaOut: MetaJson = { ...meta, reasonsAtTip: result.reasonsAtTip };
    if (result.reasonsFrozenFrom) metaOut.reasonsFrozenFrom = result.reasonsFrozenFrom;
    fs.writeFileSync(path.join(dir, "meta.json"), JSON.stringify(metaOut, null, 2));
    summaries.push({
      slateDate,
      status: result.status,
      frozenFrom: result.reasonsFrozenFrom,
      legs: result.picks.length,
      zeroReasonBefore: zeroReasonCount(picks),
      zeroReasonAfter: zeroReasonCount(result.picks),
    });
  }
  return summaries;
}
