import { describe, expect, it } from "vitest";
import { buildDataIndex, type DataIndexDateEntry } from "../lib/data-index";
import { indexRetentionDropReason } from "../lib/index-guard";
import { nextSydneyPublishIso, publishAtForNextSlate } from "../lib/index-schedule";
import fs from "fs";
import path from "path";

describe("index guard", () => {
  const now = new Date("2026-11-26T05:15:00.000Z");
  const entry = (date: string): DataIndexDateEntry => ({
    date,
    status: "draft",
    statusLabel: "Draft",
    gameCount: 3,
    legCount: 10,
    multiCount: 2,
    lastUpdated: now.toISOString(),
    firstTipIso: `${date}T09:00:00.000Z`,
  });

  it("allows shrink before retention cutoff", () => {
    const prior = buildDataIndex([entry("2026-11-24")], now);
    const next = buildDataIndex([], now);
    expect(indexRetentionDropReason(prior, next, now)).toBeNull();
  });

  it("blocks drop inside retention window", () => {
    const prior = buildDataIndex([entry("2026-11-26"), entry("2026-11-27")], now);
    const next = buildDataIndex([entry("2026-11-27")], now);
    expect(indexRetentionDropReason(prior, next, now)).toMatch(/2026-11-26/);
  });

  it("blocks drop when data branch has folder but prior index dates is empty", () => {
    const prior = buildDataIndex([], now);
    const next = buildDataIndex([], now);
    const reason = indexRetentionDropReason(prior, next, now, {
      dataBranchFolders: ["2026-11-26"],
    });
    expect(reason).toMatch(/2026-11-26/);
  });
});

describe("index schedule metadata", () => {
  it("publishAtForNextSlate never returns a past instant", () => {
    const now = new Date("2026-11-28T12:00:00.000Z");
    const iso = publishAtForNextSlate("2026-11-28", now);
    expect(new Date(iso).getTime()).toBeGreaterThan(now.getTime());
  });

  it("nextPublishAt lands on 21:00 Sydney", () => {
    const now = new Date("2026-11-26T05:15:00.000Z");
    const iso = nextSydneyPublishIso(now);
    const hour = Number(
      new Date(iso).toLocaleString("en-AU", {
        timeZone: "Australia/Sydney",
        hour: "numeric",
        hour12: false,
      })
    );
    expect(hour).toBe(21);
  });

  it("buildDataIndex exposes nextPublishAt, nextSlateDate, firstTipAt", () => {
    const now = new Date("2026-11-26T05:15:00.000Z");
    const index = buildDataIndex(
      [
        {
          date: "2026-11-26",
          status: "draft",
          statusLabel: "Draft",
          gameCount: 1,
          legCount: 1,
          multiCount: 1,
          lastUpdated: now.toISOString(),
          firstTipIso: "2026-11-26T02:30:00.000Z",
        },
        {
          date: "2026-11-27",
          status: "draft",
          statusLabel: "Draft",
          gameCount: 4,
          legCount: 1,
          multiCount: 1,
          lastUpdated: now.toISOString(),
          firstTipIso: "2026-11-27T09:00:00.000Z",
        },
      ],
      now
    );
    expect(index.nextPublishAt).toBeTruthy();
    expect(index.nextSlateDate).toBe("2026-11-27");
    expect(index.firstTipAt).toBe("2026-11-26T02:30:00.000Z");
  });

  it("workflow has 10+11 UTC evening slots for Sydney 21:00", () => {
    const yml = fs.readFileSync(
      path.join(process.cwd(), ".github/workflows/pipeline.yml"),
      "utf8"
    );
    expect(yml).toMatch(/0 10 \* \* \*/);
    expect(yml).toMatch(/0 11 \* \* \*/);
    expect(yml).toMatch(/0,30 10,11,/);
  });
});