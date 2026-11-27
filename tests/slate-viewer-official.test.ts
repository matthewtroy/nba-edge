import { describe, expect, it } from "vitest";
import { shouldShowSlateBuildingScreen } from "../lib/slate-building-mode";
import { viewerUsesOfficialCard } from "../lib/slate-viewer-official";
import { nextPublishAtAfterOfficialRun } from "../lib/index-publish-at";
import { buildDataIndex } from "../lib/data-index";
import type { DataIndexDateEntry } from "../lib/data-index";

const officialEntry = (date: string): DataIndexDateEntry => ({
  date,
  status: "official",
  statusLabel: "Official",
  gameCount: 11,
  legCount: 400,
  multiCount: 5,
  lastUpdated: "2026-11-27T10:00:00.000Z",
  firstTipIso: `${date}T00:00:00.000Z`,
});

describe("slate viewer official vs building", () => {
  const futurePublish = "2026-11-28T10:00:00.000Z";
  const index = buildDataIndex([officialEntry("2026-11-28")], new Date("2026-11-27T08:00:00.000Z"));
  const withFuturePublish = { ...index, nextPublishAt: futurePublish };

  it("shows cards (not building) when index is official even if nextPublishAt is future", () => {
    expect(
      shouldShowSlateBuildingScreen({
        index: withFuturePublish,
        slateDate: "2026-11-28",
        todayDate: "2026-11-27",
        slateEmpty: false,
        officialCard: {
          lockedAt: "x",
          publishedAt: "2026-11-27T10:00:00.000Z",
          slateDate: "2026-11-28",
          bookie: "Ladbrokes",
          multis: [],
          notBuilt: [],
          whatChanged: [],
          injuries: [],
          legSnapshots: { l1: {} as never },
        },
        officialInUse: true,
      })
    ).toBe(false);
  });

  it("viewerUsesOfficialCard when index marks slate official", () => {
    expect(
      viewerUsesOfficialCard({
        index: withFuturePublish,
        officialCard: {
          lockedAt: "x",
          slateDate: "2026-11-28",
          bookie: "Ladbrokes",
          multis: [],
          notBuilt: [],
          whatChanged: [],
          injuries: [],
        },
        slateDate: "2026-11-28",
        slateTipDate: "2026-11-28",
      })
    ).toBe(true);
  });

  it("publish_now sets nextPublishAt to actual publish time", () => {
    const now = new Date("2026-11-27T10:15:00.000Z");
    const base = buildDataIndex(
      [{ ...officialEntry("2026-11-28"), status: "draft", statusLabel: "Draft" }],
      now
    );
    const patched = nextPublishAtAfterOfficialRun(
      { ...base, nextPublishAt: "2026-11-28T10:00:00.000Z" },
      now,
      {
        publishNow: true,
        republishCard: false,
        entries: [officialEntry("2026-11-28")],
      }
    );
    expect(patched.nextPublishAt).toBe(now.toISOString());
  });
});