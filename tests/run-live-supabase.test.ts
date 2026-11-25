import { describe, expect, it, vi, afterEach } from "vitest";

const finalizeMock = vi.fn();

vi.mock("../scripts/supabase-sync.js", async (importOriginal) => {
  const orig = await importOriginal<typeof import("../scripts/supabase-sync")>();
  return {
    ...orig,
    finalizePipelineSupabaseSync: (...args: unknown[]) => finalizeMock(...args),
  };
});

import { safeFinalizePipelineSupabaseSync } from "../scripts/run-live";

describe("safeFinalizePipelineSupabaseSync", () => {
  afterEach(() => {
    finalizeMock.mockReset();
  });

  it("does not throw when finalize rejects", async () => {
    finalizeMock.mockRejectedValue(new Error("isEspnPlayerId trim blew up"));
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(
      safeFinalizePipelineSupabaseSync("/tmp", [
        {
          slateDate: "2026-11-26",
          slate: [],
          injuries: [],
          players: [],
          ranking: [],
        },
      ])
    ).resolves.toBeUndefined();
    expect(err).toHaveBeenCalledWith(
      "supabase sync failed: isEspnPlayerId trim blew up"
    );
    err.mockRestore();
  });
});