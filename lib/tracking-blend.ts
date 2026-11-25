import type { PerMinuteRates } from "./baseline.js";
import type { PlayerTrackingDay } from "./player-tracking-cache.js";

const TRACKING_BLEND = 0.3;

/** Blend ast/reb per-minute rates toward tracking signals (30% tracking / 70% ESPN box logs). */
export function blendRatesWithTracking(
  rates: PerMinuteRates,
  tracking: PlayerTrackingDay | undefined,
  minutes: number
): PerMinuteRates {
  if (!tracking || minutes <= 0) return rates;
  let ast = rates.ast;
  let reb = rates.reb;

  if (tracking.potentialAst != null && tracking.source === "nba") {
    const perMin = tracking.potentialAst / Math.max(minutes, 24);
    ast = (1 - TRACKING_BLEND) * rates.ast + TRACKING_BLEND * perMin;
  }
  if (tracking.potentialReb != null && tracking.source === "nba") {
    const perMin = tracking.potentialReb / Math.max(minutes, 24);
    reb = (1 - TRACKING_BLEND) * rates.reb + TRACKING_BLEND * perMin;
  }
  if (tracking.source === "espn" && tracking.fgaPerMinL10 != null) {
    const astBump = tracking.fgaPerMinL10 * 0.08;
    ast = (1 - TRACKING_BLEND) * rates.ast + TRACKING_BLEND * (rates.ast + astBump);
  }

  return {
    ...rates,
    ast: Math.max(0, ast),
    reb: Math.max(0, reb),
  };
}