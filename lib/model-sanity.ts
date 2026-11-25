import type { PlayerGameLog } from "./types.js";
import { logsForModelRates, type ProjectedStats } from "./baseline.js";

const MAX_DEVIATION = 0.35;
const MIN_GAMES = 5;
const FAIL_RATE_BLOCK = 0.05;

export interface ModelSanityResult {
  checked: number;
  failed: number;
  examples: string[];
  blockRepublish: boolean;
}

export function checkModelSanity(
  players: { playerName: string; gameLogs: PlayerGameLog[]; projected: ProjectedStats }[]
): ModelSanityResult {
  const examples: string[] = [];
  let checked = 0;
  let failed = 0;

  for (const p of players) {
    const logs = logsForModelRates(p.gameLogs);
    if (logs.length < MIN_GAMES) continue;
    checked += 1;
    const mins = logs.reduce((s, g) => s + g.minutes, 0);
    if (mins <= 0) continue;
    const ratePts = logs.reduce((s, g) => s + g.pts, 0) / mins;
    const rateReb = logs.reduce((s, g) => s + g.reb, 0) / mins;
    const rateAst = logs.reduce((s, g) => s + g.ast, 0) / mins;
    const projMins = p.projected.minutes;
    const expected = {
      pts: ratePts * projMins,
      reb: rateReb * projMins,
      ast: rateAst * projMins,
    };
    const bad = (stat: "pts" | "reb" | "ast", proj: number, exp: number) => {
      if (exp < 0.5) return false;
      const dev = Math.abs(proj - exp) / exp;
      return dev > MAX_DEVIATION;
    };
    const fails = [
      bad("pts", p.projected.pts, expected.pts) ? "pts" : null,
      bad("reb", p.projected.reb, expected.reb) ? "reb" : null,
      bad("ast", p.projected.ast, expected.ast) ? "ast" : null,
    ].filter(Boolean);
    if (fails.length) {
      failed += 1;
      if (examples.length < 5) {
        examples.push(
          `${p.playerName}: proj ${p.projected.pts.toFixed(1)}/${p.projected.reb.toFixed(1)}/${p.projected.ast.toFixed(1)} vs season×min ${expected.pts.toFixed(1)}/${expected.reb.toFixed(1)}/${expected.ast.toFixed(1)}`
        );
      }
    }
  }

  const blockRepublish = checked > 0 && failed / checked > FAIL_RATE_BLOCK;
  return { checked, failed, examples, blockRepublish };
}

export function logModelSanity(result: ModelSanityResult): void {
  console.log(
    `model sanity: ${result.failed}/${result.checked} failed` +
      (result.examples.length ? ` (examples: ${result.examples.join("; ")})` : "")
  );
  if (result.blockRepublish) {
    console.log("official card blocked: model sanity failed");
  }
}

export { FAIL_RATE_BLOCK as MODEL_SANITY_FAIL_RATE };