/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from "vitest";
import fs from "fs";
import path from "path";
import { createElement } from "react";
import { createRoot } from "react-dom/client";
import type { InjuryEntry, MultiBet, PickLeg, SlateGame } from "../lib/types";
import {
  SHARE_CAPTURE_DPR,
  SHARE_CAPTURE_WIDTH_PX,
  shareCaptureFooterText,
  prefetchLegHeadshots,
} from "../lib/share-multi-capture";
import { MultiCard } from "../src/components/MultiCard";
import { playerInitials } from "../lib/player-headshot";
import { fixtureSlateDir, loadPublishedSlate } from "./public-data-fixture";
import type { OfficialCardFile } from "../lib/official-card-time";
import { picksByIdFromOfficialSnapshots } from "../lib/official-leg-snapshot";

const DATA = fixtureSlateDir("2026-11-26");

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
    reasons: [],
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

describe("share multi capture", () => {
  it("uses 430px viewport and DPR 3 constants", () => {
    expect(SHARE_CAPTURE_WIDTH_PX).toBe(430);
    expect(SHARE_CAPTURE_DPR).toBe(3);
    expect(shareCaptureFooterText("2026-11-26")).toContain("NBA Edge");
    expect(shareCaptureFooterText("2026-11-26")).toContain("Gamble Responsibly");
  });

  it("real MultiCard shareCapture hides Copy/Share and bookie chevron", async () => {
    const multi = stubMulti(3);
    const picksById = new Map(
      multi.legs.map((id, i) => [
        id,
        {
          id,
          playerId: `p${i}`,
          playerName: `Player ${i + 1}`,
          gameId: "g1",
          team: "AAA",
          opponent: "BBB",
          market: "pts" as const,
          line: 20,
          probability: 0.6,
          fairPrice: 1.7,
          takeAt: 1.85,
          tags: [],
          reasons: [],
          starterEligible: true,
        },
      ])
    );
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    await new Promise<void>((resolve) => {
      root.render(
        createElement(MultiCard, {
          multi,
          picksById,
          injuries: [] as InjuryEntry[],
          shareCapture: true,
          preferredBookie: "TAB",
          onLegTap: () => {},
          onCopy: () => {},
        })
      );
      requestAnimationFrame(() => resolve());
    });
    const section = host.querySelector("section");
    expect(section?.textContent).toMatch(/TAB|Sportsbet/);
    expect(host.querySelector('[data-share-ui="actions"]')).toBeNull();
    expect(host.textContent).not.toContain("Copy");
    expect(host.textContent).not.toContain("▾");
    root.unmount();
    host.remove();
  });

  it("17-leg shareCapture card renders every leg without action row", async () => {
    const multi = stubMulti(17);
    const picksById = new Map(
      multi.legs.map((id, i) => [
        id,
        {
          id,
          playerId: `p${i}`,
          playerName: `Player ${i + 1}`,
          gameId: i < 9 ? "g1" : "g2",
          team: "AAA",
          opponent: "BBB",
          market: "pts" as const,
          line: 20,
          probability: 0.6,
          fairPrice: 1.7,
          takeAt: 1.85,
          tags: [],
          reasons: [],
          starterEligible: true,
        },
      ])
    );
    const host = document.createElement("div");
    host.style.width = `${SHARE_CAPTURE_WIDTH_PX}px`;
    document.body.appendChild(host);
    const root = createRoot(host);
    await new Promise<void>((resolve) => {
      root.render(
        createElement(MultiCard, {
          multi,
          picksById,
          injuries: [],
          shareCapture: true,
          compact: true,
          onLegTap: () => {},
          onCopy: () => {},
        })
      );
      requestAnimationFrame(() => resolve());
    });
    const rows = host.querySelectorAll('[data-testid="leg-row"]');
    expect(rows.length).toBe(17);
    expect(host.querySelector('[data-share-ui="actions"]')).toBeNull();
    root.unmount();
    host.remove();
  });

  it("cross-game SGM shareCapture keeps grouped games", async () => {
    const slate = JSON.parse(
      fs.readFileSync(path.join(DATA, "slate.json"), "utf8")
    ) as SlateGame[];
    const multi = stubMulti(5, "crossGameSgm");
    const picksById = new Map(
      multi.legs.map((id, i) => {
        const gameId = slate[i % slate.length]!.id;
        return [
          id,
          {
            id,
            playerId: `p${i}`,
            playerName: `Name ${i}`,
            gameId,
            team: "T",
            opponent: "O",
            market: "pts" as const,
            line: 10,
            probability: 0.5,
            fairPrice: 2,
            takeAt: 2.1,
            tags: [],
            reasons: [],
            starterEligible: true,
          },
        ] as const;
      })
    );
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    await new Promise<void>((resolve) => {
      root.render(
        createElement(MultiCard, {
          multi,
          picksById,
          injuries: [],
          slate,
          shareCapture: true,
          onLegTap: () => {},
          onCopy: () => {},
        })
      );
      requestAnimationFrame(() => resolve());
    });
    expect(host.textContent).toMatch(/MIA @ PHI|@\s/);
    root.unmount();
    host.remove();
  });

  it("Main Play shareCapture header is bet type, Ladbrokes $11.59 and stake only", async () => {
    const dir = fixtureSlateDir("2026-11-26");
    const { slate, picks } = loadPublishedSlate("2026-11-26");
    const official = JSON.parse(
      fs.readFileSync(path.join(dir, "official-card.json"), "utf8")
    ) as OfficialCardFile;
    const multi = official.multis.find((m) => m.type === "mainPlay");
    expect(multi?.bestBookieTotal).toBe(11.59);
    const picksById = picksByIdFromOfficialSnapshots(official.legSnapshots, picks);
    const shareLegs = multi!.legs
      .map((id) => picksById.get(id))
      .filter(Boolean) as PickLeg[];
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    await new Promise<void>((resolve) => {
      root.render(
        createElement(MultiCard, {
          multi: multi!,
          picksById,
          injuries: official.injuries,
          slate,
          shareCapture: true,
          officialDisplayOnly: true,
          lockedBookie: "Ladbrokes",
          liveCatalog: picks,
          publishedAt: official.publishedAt,
          onLegTap: () => {},
          onCopy: () => {},
        })
      );
      requestAnimationFrame(() => resolve());
    });
    expect(host.textContent).toMatch(/\$11\.59/);
    expect(host.textContent).toMatch(/Ladbrokes/);
    expect(host.querySelector("[data-testid='multi-card-header']")?.textContent).toBe(
      "Main Play@$11.59·Ladbrokes1u"
    );
    expect(host.textContent).not.toMatch(/Published/);
    const avatars = host.querySelectorAll("img");
    for (const img of avatars) {
      expect(img.className).not.toContain("bg-page");
    }
    const initials = host.querySelectorAll("span[aria-hidden]");
    expect(initials.length + avatars.length).toBeGreaterThan(0);
    root.unmount();
    host.remove();
    expect(shareLegs.length).toBe(multi!.legs.length);
  });

  it("headshot prefetch skips cross-origin ESPN urls", async () => {
    const legs: PickLeg[] = [
      {
        id: "l",
        gameId: "g",
        team: "T",
        opponent: "O",
        playerId: "p0",
        playerName: "Test",
        headshotUrl: "https://a.espncdn.com/i/headshots/nba/players/full/1.png",
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
    const fetchFn = vi.fn();
    Object.defineProperty(globalThis, "location", {
      value: { origin: "http://localhost" },
      configurable: true,
    });
    const overrides = await prefetchLegHeadshots(legs, fetchFn as typeof fetch);
    expect(fetchFn).not.toHaveBeenCalled();
    expect(overrides).toEqual({});
  });

  it("headshot prefetch falls back to initials when fetch fails", async () => {
    const multi = stubMulti(1);
    const legs: PickLeg[] = multi.legs.map((id) => ({
      id,
      playerId: "p0",
      playerName: "Ada Lovelace",
      headshotUrl: "https://example.com/missing.png",
      gameId: "g1",
      team: "A",
      opponent: "B",
      market: "pts" as const,
      line: 1,
      probability: 0.5,
      fairPrice: 2,
      takeAt: 2,
      tags: [],
      reasons: [],
      starterEligible: true,
    }));
    const fetchFn = vi.fn().mockRejectedValue(new Error("network"));
    const overrides = await prefetchLegHeadshots(legs, fetchFn as typeof fetch);
    expect(Object.keys(overrides)).toHaveLength(0);
    expect(playerInitials("Ada Lovelace")).toBe("AL");
  });
});