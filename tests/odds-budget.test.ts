import { describe, expect, it } from "vitest";
import {
  computeAllowance,
  maxGamesAboveReserve,
  pullsLeftBeforeReset,
  selectGamesForAllowance,
  shouldPauseForReserve,
} from "../lib/odds-budget";

describe("odds budget", () => {
  const now = new Date("2026-01-15T10:00:00Z");

  it("holds flat 20-credit reserve", () => {
    const r = computeAllowance(now, {
      monthlyLimit: 500,
      resetDay: 1,
      pretipPull: false,
      creditsRemaining: 400,
      reserveCredits: 20,
    });
    expect(r.reserve).toBe(20);
    expect(r.spendable).toBe(380);
  });

  it("splits allowance across pulls left", () => {
    const pulls = pullsLeftBeforeReset(now, {
      monthlyLimit: 500,
      resetDay: 1,
      pretipPull: false,
    });
    expect(pulls).toBeGreaterThan(0);
    const r = computeAllowance(now, {
      monthlyLimit: 500,
      resetDay: 1,
      pretipPull: false,
      creditsRemaining: 450,
    });
    expect(r.allowance).toBe(Math.floor(r.spendable / r.pullsLeft));
  });

  it("pauses below flat reserve", () => {
    expect(shouldPauseForReserve(19, 20)).toBe(true);
    expect(shouldPauseForReserve(20, 20)).toBe(false);
    expect(shouldPauseForReserve(21, 20)).toBe(false);
  });

  it("caps fixed game pulls above reserve", () => {
    expect(maxGamesAboveReserve(54, 10, 1, 20)).toBe(3);
    expect(maxGamesAboveReserve(25, 10, 1, 20)).toBe(0);
  });

  it("selects ranked games within allowance", () => {
    const ranked = [{ gameId: "a" }, { gameId: "b" }, { gameId: "c" }];
    expect(selectGamesForAllowance(ranked, 3, 1, 1)).toHaveLength(2);
  });

  it("154 remaining, flat reserve, ~10 credits per game", () => {
    const now = new Date("2026-01-30T10:00:00Z");
    const r = computeAllowance(now, {
      monthlyLimit: 500,
      resetDay: 1,
      pretipPull: false,
      creditsRemaining: 154,
      creditsPerGame: 10,
      reserveCredits: 20,
    });
    expect(r.reserve).toBe(20);
    expect(r.spendable).toBe(134);
    expect(r.approxGames).toBeLessThanOrEqual(
      Math.floor(Math.max(0, r.allowance - 1) / 10)
    );
    const ranked = Array.from({ length: 12 }, (_, i) => ({ gameId: `g${i}` }));
    const picked = selectGamesForAllowance(
      ranked,
      r.allowance,
      1,
      r.creditsPerGame
    );
    expect(picked.length).toBeLessThanOrEqual(r.approxGames);
    expect(picked.length).toBeGreaterThan(0);
  });
});