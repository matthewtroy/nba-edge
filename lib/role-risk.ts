import type { InjuryEntry, InjuryStatus } from "./types.js";
import type { PerMinuteRates, ProjectedStats } from "./baseline.js";
import { isMeaningfulRotation } from "./rotation.js";
import type { TeamContext } from "./injury-redistribution.js";
import { applyInjuryRedistribution } from "./injury-redistribution.js";
import { isInjuryRedistributionReason } from "./injury-reason.js";

/** Teammate return probability (plays normal minutes) for Q/D/P. */
export function teammateReturnProbability(status: InjuryStatus): number | null {
  switch (status) {
    case "Questionable":
      return 0.5;
    case "Doubtful":
      return 0.25;
    case "Probable":
      return 0.75;
    default:
      return null;
  }
}

export function blendProjectedWithTeammateReturn(
  baseline: ProjectedStats,
  outScenario: ProjectedStats,
  returnProb: number
): ProjectedStats {
  const miss = 1 - returnProb;
  return {
    pts: baseline.pts * returnProb + outScenario.pts * miss,
    reb: baseline.reb * returnProb + outScenario.reb * miss,
    ast: baseline.ast * returnProb + outScenario.ast * miss,
    threes: baseline.threes * returnProb + outScenario.threes * miss,
    minutes: baseline.minutes * returnProb + outScenario.minutes * miss,
  };
}

const ROLE_RISK_PREFIX = "Role risk: ";

function pushRoleRiskReason(map: Map<string, string[]>, playerId: string, line: string) {
  const arr = map.get(playerId) ?? [];
  const full = line.startsWith(ROLE_RISK_PREFIX) ? line : `${ROLE_RISK_PREFIX}${line}`;
  if (arr.length < 3 && !arr.some((r) => r === full)) arr.push(full);
  map.set(playerId, arr);
}

/** Q/D/P: partial out scenario on projections (no with/without splits). */
export function applyTeammateReturnRoleRisk(
  team: TeamContext,
  base: Map<string, ProjectedStats>,
  rates: Map<string, PerMinuteRates>,
  adjusted: Map<string, ProjectedStats>,
  reasons: Map<string, string[]>
): void {
  const qdp = team.injuries.filter(
    (i) =>
      i.status === "Questionable" ||
      i.status === "Doubtful" ||
      i.status === "Probable"
  );

  for (const inj of qdp) {
    const returnProb = teammateReturnProbability(inj.status);
    if (returnProb == null) continue;

    let injured = team.players.find((p) => p.id === inj.playerId);
    if (!injured && inj.playerName) {
      const norm = inj.playerName.toLowerCase();
      injured = team.players.find((p) => p.name.toLowerCase() === norm);
    }
    if (!injured) continue;

    const injLogs = team.gameLogsByPlayer.get(injured.id) ?? [];
    if (!isMeaningfulRotation(injLogs)) continue;

    const baseCopy = new Map(
      [...base].map(([id, v]) => [id, { ...v }] as const)
    );
    const fakeInjury: InjuryEntry = { ...inj, status: "Out" };
    const { adjusted: outAdj } = applyInjuryRedistribution(
      { ...team, injuries: [fakeInjury] },
      baseCopy,
      rates,
      { skipWithWithoutSplits: true }
    );

    const last =
      inj.playerName?.split(/\s+/).pop() ??
      injured.name.split(/\s+/).pop() ??
      "Teammate";
    const statusWord = inj.status.toLowerCase();

    for (const [id, outStat] of outAdj) {
      if (id === injured.id) continue;
      const baseline = base.get(id);
      const before = adjusted.get(id);
      if (!baseline || !before || before.minutes < 12) continue;

      const blended = blendProjectedWithTeammateReturn(baseline, outStat, returnProb);
      adjusted.set(id, blended);

      const ptsDelta = Math.round((blended.pts - before.pts) * 10) / 10;
      const rebDelta = Math.round((blended.reb - before.reb) * 10) / 10;
      const astDelta = Math.round((blended.ast - before.ast) * 10) / 10;

      if (ptsDelta >= 0.3) {
        pushRoleRiskReason(
          reasons,
          id,
          `${last} ${statusWord} → +${ptsDelta.toFixed(1)} pts`
        );
      } else if (rebDelta >= 0.5) {
        pushRoleRiskReason(
          reasons,
          id,
          `${last} ${statusWord} → +${rebDelta.toFixed(1)} reb`
        );
      } else if (astDelta >= 0.5) {
        pushRoleRiskReason(
          reasons,
          id,
          `${last} ${statusWord} → +${astDelta.toFixed(1)} ast`
        );
      }
    }
  }
}

/** Main Play / Double Up: no injury-redistribution split copy on legs. */
export function reasonsExcludingInjurySplits(reasons: string[]): string[] {
  return reasons.filter((r) => !isInjuryRedistributionReason(r));
}