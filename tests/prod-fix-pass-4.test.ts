/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi, beforeAll } from "vitest";
import fs from "fs";
import path from "path";
import { createElement } from "react";
import { createRoot } from "react-dom/client";
import {
  activeLiveGameIds,
  buildLiveSnapshot,
  createMockLiveProvider,
  FinalLiveCache,
  mergeIntoFinalCache,
  subscribeLiveSource,
} from "../lib/live-source";
import type { OfficialCardFile } from "../lib/official-card-time";
import { MultiCard } from "../src/components/MultiCard";
import { liveBetView } from "../lib/live-bet";
import { multiCardLiveBorderClass } from "../lib/live-leg-ui";
import { fixtureSlateDir, loadPublishedSlate } from "./public-data-fixture";
import { picksByIdFromOfficialSnapshots } from "../lib/official-leg-snapshot";

const fixtureDir = path.join(process.cwd(), "tests/fixtures/espn");
const scoreboard = JSON.parse(
  fs.readFileSync(path.join(fixtureDir, "scoreboard-mini.json"), "utf8")
);
const summaryFinal = JSON.parse(
  fs.readFileSync(path.join(fixtureDir, "summary-final.json"), "utf8")
);

describe("prod fix pass 4 — row tint gradient", () => {
  it("won row uses left-strong fade with opaque stop at 0%", () => {
    const css = fs.readFileSync(path.join(process.cwd(), "src/index.css"), "utf8");
    const block = css.match(/\.leg-row-live-won\s*\{[\s\S]*?\}/)?.[0] ?? "";
    expect(block).toMatch(/rgba\(52,\s*211,\s*153,\s*0\.07\)\s*0%/);
    expect(block).not.toMatch(/transparent\s*0%/);

    const el = document.createElement("motion-div");
    el.className = "leg-row-live-won";
    document.head.appendChild(
      Object.assign(document.createElement("style"), {
        textContent: `.leg-row-live-won{${block.replace(/\.leg-row-live-won\s*\{|\}/g, "")}}`,
      })
    );
    document.body.appendChild(el);
    const bg = getComputedStyle(el).backgroundImage;
    expect(bg).toMatch(/rgba\(52,\s*211,\s*153,\s*0\.07\)/);
    el.remove();
  });
});

describe("prod fix pass 4 — ESPN polling finals", () => {
  it("caches final games and skips them from active poll ids", async () => {
    const provider = createMockLiveProvider({
      scoreboards: { "20261126": scoreboard },
      summaries: { "fixture-game-won": summaryFinal },
    });
    const cache: FinalLiveCache = {
      games: new Map([
        [
          "fixture-game-won",
          {
            gameId: "fixture-game-won",
            phase: "final",
            status: "Final",
            period: 4,
            statusDetail: "Final",
          },
        ],
      ]),
      boxesByGame: new Map([
        ["fixture-game-won", new Map([["p-won", { pts: 24, reb: 5, ast: 3, minutes: "32" }]])],
      ]),
    };
    const fetchSpy = vi.spyOn(provider, "fetchSummary");
    const snap = await buildLiveSnapshot(
      provider,
      [{ id: "fixture-game-won", startTime: "2026-11-26T15:00:00Z" }],
      ["fixture-game-won"],
      undefined,
      { finalCache: cache }
    );
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(snap.games.find((g) => g.gameId === "fixture-game-won")?.phase).toBe("final");
    fetchSpy.mockRestore();
  });

  it("stops scheduling polls when every game is final", async () => {
    vi.useFakeTimers();
    let scoreboardCalls = 0;
    const provider = createMockLiveProvider({
      scoreboards: { "20261126": scoreboard },
      summaries: { "fixture-game-won": summaryFinal },
    });
    const origSb = provider.fetchScoreboard.bind(provider);
    provider.fetchScoreboard = async (...args) => {
      scoreboardCalls += 1;
      return origSb(...args);
    };
    const unsub = subscribeLiveSource({
      provider,
      slateGames: [{ id: "fixture-game-won", startTime: "2026-11-26T15:00:00Z" }],
      gameIds: ["fixture-game-won"],
      pollMs: 1000,
      onSnapshot: () => {},
    });
    await vi.advanceTimersByTimeAsync(50);
    expect(scoreboardCalls).toBeGreaterThanOrEqual(1);
    const cache: FinalLiveCache = { games: new Map(), boxesByGame: new Map() };
    mergeIntoFinalCache(
      await buildLiveSnapshot(
        provider,
        [{ id: "fixture-game-won", startTime: "2026-11-26T15:00:00Z" }],
        ["fixture-game-won"]
      ),
      cache
    );
    expect(activeLiveGameIds([], ["fixture-game-won"], cache)).toEqual([]);
    const before = scoreboardCalls;
    await vi.advanceTimersByTimeAsync(5000);
    expect(scoreboardCalls).toBe(before);
    unsub();
    vi.useRealTimers();
  });
});

describe("prod fix pass 4 — games SGM card glow", () => {
  it("won live bet applies multi-card-live-won border class", () => {
    const view = liveBetView(["won", "won", "won"]);
    expect(multiCardLiveBorderClass(view)).toBe("multi-card-live-won");
  });
});

describe("prod fix pass 4 — share capture prices", () => {
  it("shareCapture keeps green header total and leg prices", async () => {
    const dir = fixtureSlateDir("2026-11-26");
    const { slate, picks } = loadPublishedSlate("2026-11-26");
    const official = JSON.parse(
      fs.readFileSync(path.join(dir, "official-card.json"), "utf8")
    ) as OfficialCardFile;
    const multi = official.multis.find((m) => m.type === "mainPlay")!;
    const picksById = picksByIdFromOfficialSnapshots(official.legSnapshots, picks);
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    await new Promise<void>((resolve) => {
      root.render(
        createElement(MultiCard, {
          multi,
          picksById,
          injuries: official.injuries,
          slate,
          shareCapture: true,
          hideBookieSelect: true,
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
    const greenEls = host.querySelectorAll(".text-price-green");
    expect(greenEls.length).toBeGreaterThan(0);
    expect(host.querySelector('[data-share-ui="actions"]')).toBeNull();
    root.unmount();
    host.remove();
  });
});

describe("prod fix pass 4 — leg progress width transition", () => {
  it("LegProgress omits width transition class when fill unchanged", () => {
    const src = fs.readFileSync(
      path.join(process.cwd(), "src/components/LegProgress.tsx"),
      "utf8"
    );
    expect(src).toMatch(/widthTransition/);
    expect(src).toMatch(/transition-\[width\].*widthTransition/s);
  });
});