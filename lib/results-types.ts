import type { CalibrationBucket } from "./types.js";
import type { SettledLegRow } from "./settle-core.js";

export interface ResultsJson {
  updatedAt: string;
  official: {
    record: { won: number; lost: number; void: number; roi: number };
    byBetType: Record<
      string,
      { won: number; lost: number; void: number; legs: number }
    >;
    last14dLegs: number;
  };
  model: {
    calibration: CalibrationBucket[];
    valueRoi: number | null;
    brierShadow: number | null;
    tagHitRates: Record<string, { hits: number; total: number }>;
  };
  legs: SettledLegRow[];
}