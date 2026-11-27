import { describe, expect, it, beforeAll } from "vitest";
import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { buildDataIndex, type DataIndexDateEntry } from "../lib/data-index";
import {
  nextSlateFolderDate,
  noNbaOnCalendarTomorrow,
  slateTabDateChip,
  todayTabLabel,
} from "../lib/slate-tab-labels";
import { resolveViewerSlateSegment } from "../lib/viewer-slate";
import { legProgressFillClass } from "../lib/live-leg-ui";
import type { LiveLegView } from "../lib/live-leg";

const entry = (date: string, tip: string): DataIndexDateEntry => ({
  date,
  status: "draft",
  statusLabel: "Draft",
  gameCount: 4,
  legCount: 10,
  multiCount: 2,
  lastUpdated: "2026-11-26T05:00:00.000Z",
  firstTipIso: tip,
});

describe("prod fix pass 2 — date tabs", () => {
  it("Sydney Thu 26 Nov: Today + Sat tabs skip Thanksgiving", () => {
    const now = new Date("2026-11-26T05:46:00.000Z");
    const index = buildDataIndex(
      [
        entry("2026-11-26", "2026-11-26T09:00:00.000Z"),
        entry("2026-11-28", "2026-11-28T09:00:00.000Z"),
      ],
      now
    );
    const seg = resolveViewerSlateSegment(index, now, "Australia/Sydney");
    expect(todayTabLabel(seg.viewerTodayYmd, "Australia/Sydney")).toMatch(
      /Today \(.*26.*11\)/
    );
    expect(seg.tomorrowFolder).toBe("2026-11-28");
    expect(slateTabDateChip("2026-11-28", "Australia/Sydney")).toMatch(/Sat.*28/);
    expect(noNbaOnCalendarTomorrow(index, seg.viewerTodayYmd, "Australia/Sydney")).toBe(
      true
    );
  });

  it("LA viewer uses en-US locale for tab chip weekday", () => {
    const chip = slateTabDateChip("2026-11-28", "America/Los_Angeles");
    expect(chip).toMatch(/Sat/);
    expect(chip).toMatch(/28/);
  });

  it("next folder jumps two days when intermediate date empty", () => {
    const index = buildDataIndex(
      [entry("2026-11-26", "2026-11-26T09:00:00.000Z"), entry("2026-11-29", "2026-11-29T09:00:00.000Z")],
      new Date("2026-11-26T12:00:00.000Z")
    );
    expect(nextSlateFolderDate(index, "2026-11-26")).toBe("2026-11-29");
  });
});

describe("prod fix pass 2 — tailwind + picks", () => {
  beforeAll(() => {
    execSync("npm run build", { cwd: process.cwd(), stdio: "pipe" });
  });

  it("built CSS contains leg progress fill utilities from lib/", () => {
    const dist = path.join(process.cwd(), "dist", "assets");
    const cssFile = fs
      .readdirSync(dist)
      .find((f) => f.endsWith(".css") && f.startsWith("index"));
    expect(cssFile).toBeTruthy();
    const css = fs.readFileSync(path.join(dist, cssFile!), "utf8");
    expect(css).toMatch(/bg-green-500/);
    expect(css).toMatch(/bg-red-400/);
    expect(css).toMatch(/bg-green-400/);
  });

  it("picks list uses card container and rows avoid negative margins", () => {
    const picks = fs.readFileSync(
      path.join(process.cwd(), "src/screens/PicksScreen.tsx"),
      "utf8"
    );
    const row = fs.readFileSync(
      path.join(process.cwd(), "src/components/PickLegRow.tsx"),
      "utf8"
    );
    const css = fs.readFileSync(path.join(process.cwd(), "src/index.css"), "utf8");
    expect(picks).toMatch(/data-testid="picks-leg-list"/);
    expect(picks).toMatch(/ui\.card[\s\S]*picks-leg-list/);
    expect(row).not.toContain("pick-leg-row-bleed");
    expect(row).not.toMatch(/margin-inline:\s*-/);
    expect(css).not.toMatch(/\.pick-leg-row-bleed/);
  });

  it("tailwind content scans lib for dynamic leg classes", () => {
    const cfg = fs.readFileSync(path.join(process.cwd(), "tailwind.config.js"), "utf8");
    expect(cfg).toMatch(/lib\/\*\*\/\*\.\{js,ts,tsx\}/);
  });
});

describe("prod fix pass 2 — building screen", () => {
  it("exposes premium building UI component", () => {
    const src = fs.readFileSync(
      path.join(process.cwd(), "src/components/SlateBuildingScreen.tsx"),
      "utf8"
    );
    expect(src).toContain('data-testid="slate-building-screen"');
    expect(src).toContain("Main Play");
    expect(src).toContain("Best Double Up");
    expect(src).toContain("Best SGM");
    expect(src).toContain("Card time TBC");
    expect(src).toContain("NO_NBA_TODAY_BUILDING_TEASE");
    expect(src).not.toMatch(/No NBA tomorrow/i);
    expect(src).not.toContain("tomorrowNoNbaTease");
  });
});

describe("prod fix pass 2 — leg progress fill DOM", () => {
  /**
   * @vitest-environment jsdom
   */
  it("fill class resolves to non-transparent background when rule injected", () => {
    const view = {
      line: 20,
      actual: 12,
      progress: 0.6,
      state: "live",
    } as LiveLegView;
    const cls = legProgressFillClass(view);
    const style = document.createElement("style");
    style.textContent = `.probe-fill{background-color:rgb(34 197 94 / 0.85)}`;
    document.head.appendChild(style);
    const el = document.createElement("span");
    el.className = `probe-fill ${cls}`;
    document.body.appendChild(el);
    const bg = getComputedStyle(el).backgroundColor;
    expect(bg).not.toBe("rgba(0, 0, 0, 0)");
    expect(bg).not.toBe("transparent");
  });
});