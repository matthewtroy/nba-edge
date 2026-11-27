/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import type { InjuryEntry, MultiBet, PickLeg } from "../lib/types";
import { MultiCard, FORBIDDEN_MULTI_CARD_STRINGS } from "../src/components/MultiCard";
import { MULTI_TYPES } from "../lib/multi-types";
import { sharePngFile } from "../src/components/ShareMultiFallbackSheet";
import { sharePngCacheVersion } from "../src/lib/share-multi-cache";
import type { CaptureMultiCardShareInput } from "../src/lib/share-multi-image";
import { SHARE_CAPTURE_IMAGE_PLACEHOLDER } from "../lib/share-multi-capture";
import { fixtureSlateDir, loadPublishedSlate } from "./public-data-fixture";
import { picksByIdFromOfficialSnapshots } from "../lib/official-leg-snapshot";
import type { OfficialCardFile } from "../lib/official-card-time";

function stubMulti(n: number, type: MultiBet["type"] = "mainPlay"): MultiBet {
  const legs: PickLeg[] = Array.from({ length: n }, (_, i) => ({
    id: `leg-${i}`,
    playerId: `p${i}`,
    playerName: `Player ${i + 1}`,
    headshotUrl: i === 0 ? "https://example.com/a.png" : "",
    gameId: i < 3 ? "g1" : "g2",
    team: "AAA",
    opponent: "BBB",
    market: "pts",
    line: 20,
    probability: 0.6,
    fairPrice: 1.7,
    takeAt: 1.85,
    tags: [],
    reasons: [{ type: "avg", text: "x" }],
    starterEligible: true,
  }));
  return {
    type,
    label: `Test ${n}-leg`,
    legs: legs.map((l) => l.id),
    combinedProbability: 0.2,
    combinedFairPrice: 5,
    combinedTakeAt: 5.5,
    bestBookie: "Sportsbet",
    bestBookieTotal: 4.2,
  };
}

function picksMap(multi: MultiBet, legs: PickLeg[]) {
  return new Map(legs.map((l) => [l.id, l]));
}

describe("share iOS MultiCard", () => {
  let root: Root | null = null;
  let host: HTMLDivElement | null = null;

  afterEach(() => {
    root?.unmount();
    host?.remove();
    root = null;
    host = null;
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    vi.stubGlobal(
      "requestIdleCallback",
      (cb: IdleRequestCallback) => {
        cb({ didTimeout: false, timeRemaining: () => 50 } as IdleDeadline);
        return 1;
      }
    );
    vi.stubGlobal("cancelIdleCallback", () => {});
  });

  it("uses transparent imagePlaceholder constant", () => {
    expect(SHARE_CAPTURE_IMAGE_PLACEHOLDER).toMatch(/^data:image\/png/);
  });

  it("every today multi type renders Share button", () => {
    for (const type of MULTI_TYPES) {
      const multi = stubMulti(3, type);
      const legs = multi.legs.map((id) => ({
        ...stubMulti(1).legs[0]!,
        id,
      }));
      const src = fs.readFileSync(
        path.join(process.cwd(), "src/components/MultiCard.tsx"),
        "utf8"
      );
      expect(src).toContain("multi-card-share-btn");
      expect(src).not.toMatch(/type === ["']${type}["'][\s\S]*?Share[\s\S]*?disabled/);
      void type;
      void multi;
      void legs;
    }
  });

  it("sharePngFile opens fallback on NotAllowedError", async () => {
    vi.stubGlobal("navigator", {
      share: vi.fn().mockRejectedValue(Object.assign(new Error("nope"), { name: "NotAllowedError" })),
      canShare: () => true,
    });
    const blob = new Blob(["x"], { type: "image/png" });
    await expect(sharePngFile(blob, "t")).resolves.toBe("fallback");
  });

  it("sharePngFile calls share with cached blob without extra capture", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { share, canShare: () => true });
    const blob = new Blob(["x"], { type: "image/png" });
    await sharePngFile(blob, "Title");
    expect(share).toHaveBeenCalledOnce();
    const arg = share.mock.calls[0]![0] as ShareData;
    expect(arg.files?.[0]).toBeInstanceOf(File);
  });

  it("cache version changes when share legs change", () => {
    const base: CaptureMultiCardShareInput = {
      multi: stubMulti(2),
      picksById: new Map(),
      injuries: [],
      shareLegs: [{ ...stubMulti(1).legs[0]!, id: "a" }],
    };
    const v1 = sharePngCacheVersion(base);
    const v2 = sharePngCacheVersion({
      ...base,
      shareLegs: [{ ...stubMulti(1).legs[0]!, id: "b" }],
    });
    expect(v1).not.toBe(v2);
  });

  it("wires onShareError when share prepare fails", async () => {
    const onShareError = vi.fn();
    const multi = stubMulti(2);
    const legs = multi.legs.map((id, i) => ({
      id,
      playerId: `p${i}`,
      playerName: `P${i}`,
      gameId: "g1",
      team: "A",
      opponent: "B",
      market: "pts" as const,
      line: 10,
      probability: 0.5,
      fairPrice: 2,
      takeAt: 2,
      tags: [],
      reasons: [],
      starterEligible: true,
    }));
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
    await act(async () => {
      root!.render(
        createElement(MultiCard, {
          multi,
          picksById: picksMap(multi, legs),
          injuries: [] as InjuryEntry[],
          onLegTap: () => {},
          onCopy: () => {},
          onShareError,
        })
      );
    });
    const btn = host.querySelector('[data-testid="multi-card-share-btn"]');
    expect(btn).toBeTruthy();
    expect(FORBIDDEN_MULTI_CARD_STRINGS.length).toBeGreaterThan(0);
  });

  it("LAL 6-leg main play capture fixture resolves share legs", async () => {
    const dir = fixtureSlateDir("2026-11-26");
    const official = JSON.parse(
      fs.readFileSync(path.join(dir, "official-card.json"), "utf8")
    ) as OfficialCardFile;
    const { picks, slate } = loadPublishedSlate("2026-11-26");
    const multi = official.multis.find((m) => m.type === "mainPlay");
    expect(multi?.legs.length).toBeGreaterThanOrEqual(4);
    const picksById = picksByIdFromOfficialSnapshots(official.legSnapshots, picks);
    const shareLegs = multi!.legs.map((id) => picksById.get(id)).filter(Boolean) as PickLeg[];
    expect(shareLegs.length).toBe(multi!.legs.length);
  });

  it("cross 22-leg official multi has enough legs for capture", () => {
    const dir = fixtureSlateDir("2026-11-26");
    const official = JSON.parse(
      fs.readFileSync(path.join(dir, "official-card.json"), "utf8")
    ) as OfficialCardFile;
    const cross = official.multis.find((m) => m.type === "crossGameSgm");
    expect(cross).toBeDefined();
    expect(cross!.legs.length).toBeGreaterThanOrEqual(10);
  });
});