/** Normal CDF approximation */
function normCdf(x: number): number {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;
  const sign = x < 0 ? -1 : 1;
  const t = 1 / (1 + p * Math.abs(x) / Math.SQRT2);
  const y =
    1 -
    ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-(x * x) / 2);
  return 0.5 * (1 + sign * y);
}

/** P(X >= k) for points: Normal(mean, sd=0.27*mean) with continuity correction */
export function probPointsOver(mean: number, line: number): number {
  if (mean <= 0) return line <= 0 ? 1 : 0;
  const sd = 0.27 * mean;
  const threshold = line - 0.5;
  const z = (threshold - mean) / sd;
  return Math.max(0.001, Math.min(0.999, 1 - normCdf(z)));
}

/** Negative binomial: variance/mean = dispersion r; mean = m */
function nbParams(mean: number, dispersion: number): { r: number; p: number } {
  const r = mean / (dispersion - 1);
  const p = r / (r + mean);
  return { r, p };
}

function logGamma(z: number): number {
  if (z < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * z)) - logGamma(1 - z);
  z -= 1;
  const g = 7;
  const c = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028,
    771.32342877765313, -176.61502916214059, 12.507343278686905,
    -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
  ];
  let x = c[0];
  for (let i = 1; i < g + 2; i++) x += c[i] / (z + i);
  const t = z + g + 0.5;
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
}

function nbPmf(k: number, r: number, p: number): number {
  if (k < 0) return 0;
  const logCoef = logGamma(k + r) - logGamma(r) - logGamma(k + 1);
  return Math.exp(logCoef + r * Math.log(p) + k * Math.log(1 - p));
}

/** P(X >= line) for negative binomial */
export function probNbOver(mean: number, dispersion: number, line: number): number {
  if (mean <= 0) return line <= 0 ? 1 : 0;
  const { r, p } = nbParams(mean, dispersion);
  const threshold = Math.floor(line);
  let cdf = 0;
  for (let k = 0; k < threshold; k++) cdf += nbPmf(k, r, p);
  return Math.max(0.001, Math.min(0.999, 1 - cdf));
}

export const REB_DISPERSION = 1.25;
export const AST_DISPERSION = 1.2;
export const THREES_DISPERSION = 1.3;
export const Q1_PTS_DISPERSION = 2.2;
export const Q1_REB_AST_DISPERSION = 1.3;

export function probMarketOver(
  market: string,
  mean: number,
  line: number
): number {
  if (market === "pts" || market === "q1pts") {
    if (market === "q1pts") {
      return probNbOver(mean, Q1_PTS_DISPERSION, line);
    }
    return probPointsOver(mean, line);
  }
  if (market === "reb" || market === "q1reb") {
    const d = market === "q1reb" ? Q1_REB_AST_DISPERSION : REB_DISPERSION;
    return probNbOver(mean, d, line);
  }
  if (market === "ast" || market === "q1ast") {
    const d = market === "q1ast" ? Q1_REB_AST_DISPERSION : AST_DISPERSION;
    return probNbOver(mean, d, line);
  }
  if (market === "3pm") {
    return probNbOver(mean, THREES_DISPERSION, line);
  }
  return 0;
}

/** Seeded PRNG mulberry32 */
export function mulberry32(seed: number): () => number {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function monteCarloCombo(
  means: { pts: number; reb: number; ast: number },
  predicate: (p: { pts: number; reb: number; ast: number }) => boolean,
  sims = 20000,
  seed = 42
): number {
  const rng = mulberry32(seed);
  let hits = 0;
  for (let i = 0; i < sims; i++) {
    const factor = 1 + (rng() + rng() + rng() + rng() - 2) * 0.12;
    const m = {
      pts: means.pts * factor,
      reb: means.reb * factor,
      ast: means.ast * factor,
    };
    const drawNb = (mean: number, disp: number) => {
      const { r, p } = nbParams(Math.max(0.01, mean), disp);
      let sum = 0;
      const lam = r * (1 - p) / p;
      const n = Math.min(200, Math.ceil(lam * 3));
      for (let j = 0; j < n; j++) {
        if (rng() < p) break;
        sum++;
      }
      return sum;
    };
    const p = {
      pts: Math.round(means.pts * factor + (rng() - 0.5) * 0.27 * means.pts * factor),
      reb: drawNb(m.reb, REB_DISPERSION),
      ast: drawNb(m.ast, AST_DISPERSION),
    };
    if (predicate(p)) hits++;
  }
  return hits / sims;
}

export function probDoubleDouble(means: { pts: number; reb: number; ast: number }): number {
  return monteCarloCombo(means, (p) => {
    const cats = [p.pts >= 10, p.reb >= 10, p.ast >= 10].filter(Boolean).length;
    return cats >= 2;
  });
}

export function probTripleDouble(means: { pts: number; reb: number; ast: number }): number {
  return monteCarloCombo(means, (p) => p.pts >= 10 && p.reb >= 10 && p.ast >= 10);
}

export function probComboRebAst(means: { pts: number; reb: number; ast: number }): number {
  return monteCarloCombo(means, (p) => p.reb >= 7 && p.ast >= 7);
}

export function probStatSumOver(
  market: "ptsreb" | "ptsast" | "rebast" | "pra",
  means: { pts: number; reb: number; ast: number },
  line: number
): number {
  return monteCarloCombo(means, (p) => {
    let sum = 0;
    if (market === "ptsreb") sum = p.pts + p.reb;
    else if (market === "ptsast") sum = p.pts + p.ast;
    else if (market === "rebast") sum = p.reb + p.ast;
    else sum = p.pts + p.reb + p.ast;
    return sum >= line;
  });
}