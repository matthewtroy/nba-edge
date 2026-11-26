import type { PickLeg } from "../../lib/types";
import { legHasSupportiveReason } from "../../lib/picks-supportive-filter";

/** Test helper: ensure synthetic/fixture legs meet pass-8 supportive gate. */
export function ensureSupportivePicks(picks: PickLeg[]): PickLeg[] {
  return picks.map((p) => {
    if (p.market.startsWith("q1") || legHasSupportiveReason(p)) return p;
  return {
      ...p,
      recentTenVsLine: p.recentTenVsLine ?? (Array(10).fill("hit") as PickLeg["recentTenVsLine"]),
      reasons: [
        ...(p.reasons ?? []),
        { type: "form" as const, text: "7/10 at this line" },
      ],
    };
  });
}