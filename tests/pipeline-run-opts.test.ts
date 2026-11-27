import { describe, expect, it } from "vitest";
import { skipOfficialPublishOnRun } from "../lib/pipeline-run-opts";

describe("pipeline run opts", () => {
  it("allows evening publish when force_odds and republish_card", () => {
    expect(
      skipOfficialPublishOnRun({
        forceOdds: true,
        republishCard: true,
        fromLive: false,
      })
    ).toBe(false);
  });

  it("never skips publish on publish_now", () => {
    expect(
      skipOfficialPublishOnRun({
        forceOdds: true,
        republishCard: false,
        fromLive: false,
        publishNow: true,
      })
    ).toBe(false);
  });

  it("skips auto publish on force_odds without republish", () => {
    expect(
      skipOfficialPublishOnRun({
        forceOdds: true,
        republishCard: false,
        fromLive: false,
      })
    ).toBe(true);
  });
});