import { describe, expect, it } from "vitest";
import { republishCardIsLocked, REPUBLISH_CARD_LOCK_MS } from "../lib/republish-card-lock";
import type { OfficialCardFile } from "../lib/official-card-time";

function card(publishedAt: string): OfficialCardFile {
  return {
    slateDate: "2026-11-28",
    lockedAt: publishedAt,
    publishedAt,
    legSnapshots: {},
    multis: [],
    notBuilt: [],
    whatChanged: [],
    injuries: [],
  };
}

describe("republish card lock", () => {
  const published = new Date("2026-11-27T12:00:00.000Z");

  it("locks within 30 minutes of first publishedAt", () => {
    const now = new Date(published.getTime() + 20 * 60 * 1000);
    expect(republishCardIsLocked(card(published.toISOString()), now, false)).toBe(true);
  });

  it("allows republish after 40 minutes", () => {
    const now = new Date(published.getTime() + 40 * 60 * 1000);
    expect(republishCardIsLocked(card(published.toISOString()), now, false)).toBe(false);
  });

  it("force republish bypasses lock", () => {
    const now = new Date(published.getTime() + 5 * 60 * 1000);
    expect(republishCardIsLocked(card(published.toISOString()), now, true)).toBe(false);
  });

  it("lock window is 30 minutes", () => {
    expect(REPUBLISH_CARD_LOCK_MS).toBe(30 * 60 * 1000);
  });
});