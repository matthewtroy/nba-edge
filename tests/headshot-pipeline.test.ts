/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import {
  applyHeadshotUrlsToSlatePicks,
  downloadHeadshotsForPlayers,
  resolveStoredHeadshotUrl,
} from "../lib/headshot-pipeline";
import { headshotFilePath, selfHostedHeadshotRelPath } from "../lib/headshot-store";
import { headshotPublicUrl, isSameOriginHeadshotUrl } from "../lib/headshot-display";
import { prefetchLegHeadshots } from "../lib/share-multi-capture";
import type { PickLeg } from "../lib/types";

describe("headshot pipeline", () => {
  it("resolveStoredHeadshotUrl prefers self-hosted when file exists", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "hs-"));
    const id = "12345";
    fs.mkdirSync(path.join(root, "headshots"), { recursive: true });
    fs.writeFileSync(headshotFilePath(root, id), Buffer.from("png"));
    expect(resolveStoredHeadshotUrl(root, id, "https://espn.example/x.png")).toBe(
      selfHostedHeadshotRelPath(id)
    );
  });

  it("applyHeadshotUrlsToSlatePicks writes relative path", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "hs-"));
    const ymd = "2026-11-28";
    const dir = path.join(root, ymd);
    fs.mkdirSync(dir, { recursive: true });
    const id = "999";
    fs.mkdirSync(path.join(root, "headshots"), { recursive: true });
    fs.writeFileSync(headshotFilePath(root, id), Buffer.from("x"));
    const leg: PickLeg = {
      id: "l1",
      gameId: "g",
      team: "T",
      opponent: "O",
      playerId: id,
      playerName: "Name",
      headshotUrl: "https://a.espncdn.com/i/headshots/nba/players/full/999.png",
      market: "pts",
      line: 10,
      probability: 0.5,
      fairPrice: 2,
      takeAt: 2,
      tags: [],
      reasons: [],
      starterEligible: true,
    };
    fs.writeFileSync(path.join(dir, "picks.json"), JSON.stringify([leg]));
    applyHeadshotUrlsToSlatePicks(root, [ymd]);
    const out = JSON.parse(fs.readFileSync(path.join(dir, "picks.json"), "utf8")) as PickLeg[];
    expect(out[0]!.headshotUrl).toBe(selfHostedHeadshotRelPath(id));
  });

  it("downloadHeadshotsForPlayers logs failure without throwing", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "hs-"));
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("network"))
    );
    const result = await downloadHeadshotsForPlayers(root, ["1"], {
      now: new Date(),
    });
    expect(result.failed).toBe(1);
    expect(result.downloaded).toBe(0);
    vi.unstubAllGlobals();
  });
});

describe("headshot display + share prefetch", () => {
  it("headshotPublicUrl builds data/headshots path for frozen ESPN urls", () => {
    const url = headshotPublicUrl(
      "4278053",
      "https://a.espncdn.com/i/headshots/nba/players/full/4278053.png",
      "/nba-edge/"
    );
    expect(url).toContain("/nba-edge/data/headshots/4278053.png");
  });

  it("prefetchLegHeadshots returns data URL for same-origin fetch", async () => {
    const blob = new Blob(["x"], { type: "image/png" });
    const fetchFn = vi.fn().mockResolvedValue({
      ok: true,
      blob: async () => blob,
    });
    const legs: PickLeg[] = [
      {
        id: "l",
        gameId: "g",
        team: "T",
        opponent: "O",
        playerId: "p1",
        playerName: "P",
        headshotUrl: "http://localhost/nba-edge/data/headshots/p1.png",
        market: "pts",
        line: 1,
        probability: 0.5,
        fairPrice: 2,
        takeAt: 2,
        tags: [],
        reasons: [],
        starterEligible: true,
      },
    ];
  Object.defineProperty(globalThis, "location", {
      value: { origin: "http://localhost" },
      configurable: true,
    });
    const overrides = await prefetchLegHeadshots(legs, fetchFn as typeof fetch);
    expect(fetchFn).toHaveBeenCalled();
    expect(overrides.p1).toMatch(/^data:image/);
  });

  it("isSameOriginHeadshotUrl rejects cross-origin ESPN", () => {
    expect(
      isSameOriginHeadshotUrl(
        "https://a.espncdn.com/i/headshots/nba/players/full/1.png",
        "http://localhost"
      )
    ).toBe(false);
  });
});