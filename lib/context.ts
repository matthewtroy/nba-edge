import type { ProjectedStats } from "./baseline.js";

export function applyContextAdjustments(
  stats: ProjectedStats,
  opts: {
    oppFactor?: number;
    spread?: number;
    b2b?: boolean;
    age?: number;
  }
): ProjectedStats & { blowoutRisk?: boolean; ageB2B?: boolean } {
  const out = { ...stats };
  let blowoutRisk = false;
  let ageB2B = false;

  if (opts.oppFactor !== undefined) {
    const capped = Math.max(-0.08, Math.min(0.08, opts.oppFactor));
    out.pts *= 1 + capped;
    out.reb *= 1 + capped * 0.5;
    out.ast *= 1 + capped * 0.5;
    out.threes *= 1 + capped;
  }

  if (opts.spread !== undefined && Math.abs(opts.spread) >= 13) {
    out.minutes *= 0.91;
    blowoutRisk = true;
  } else if (opts.spread !== undefined && Math.abs(opts.spread) >= 10) {
    out.minutes *= 0.94;
    blowoutRisk = true;
  }

  out.pts = (out.pts / stats.minutes) * out.minutes;
  out.reb = (out.reb / stats.minutes) * out.minutes;
  out.ast = (out.ast / stats.minutes) * out.minutes;
  out.threes = (out.threes / stats.minutes) * out.minutes;

  if (opts.b2b) {
    out.minutes *= 0.97;
    out.pts = (out.pts / stats.minutes) * out.minutes;
    out.reb = (out.reb / stats.minutes) * out.minutes;
    out.ast = (out.ast / stats.minutes) * out.minutes;
    out.threes = (out.threes / stats.minutes) * out.minutes;
    if (opts.age !== undefined && opts.age >= 32) ageB2B = true;
  }

  return { ...out, blowoutRisk, ageB2B };
}