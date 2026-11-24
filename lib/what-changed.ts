import type { InjuryEntry, PickLeg } from "./types.js";
import { isOutOrDoubtful } from "./injury-match.js";

function lastName(name: string): string {
  return name.split(" ").pop() ?? name;
}

/** Build What changed from Out/Doubtful injuries and beneficiary hints in leg reasons */
export function buildWhatChanged(
  injuries: InjuryEntry[],
  picks: PickLeg[],
  limit = 3
): string[] {
  const outs = injuries.filter((i) => isOutOrDoubtful(i.status));
  const lines: string[] = [];

  for (const inj of outs) {
    const key = inj.playerName.split(" ").pop() ?? inj.playerName;
    const beneficiaries = new Map<string, number>();

    for (const leg of picks) {
      if (leg.team !== inj.teamName) continue;
      for (const r of leg.reasons) {
        const lower = r.toLowerCase();
        const injShort = inj.playerName.toLowerCase();
        if (!lower.includes(" out") && !lower.includes("doubtful")) continue;
        if (
          !lower.includes(injShort) &&
          !lower.includes(key.toLowerCase())
        )
          continue;
        if (leg.playerId === inj.playerId) continue;
        const score =
          beneficiaries.get(leg.playerName) ?? 0;
        beneficiaries.set(leg.playerName, score + 1);
      }
    }

    const sorted = [...beneficiaries.entries()].sort((a, b) => b[1] - a[1]);
    const names = sorted.slice(0, 3).map(([n]) => lastName(n));
    if (names.length) {
      lines.push(`${lastName(inj.playerName)} out → ${names.join(", ")}`);
    } else {
      lines.push(`${lastName(inj.playerName)} ${inj.status.toLowerCase()} → usage shift`);
    }
    if (lines.length >= limit) break;
  }

  return lines.slice(0, limit);
}