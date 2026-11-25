import type { InjuryEntry, PickLeg } from "./types.js";
import { reasonText } from "./leg-reason-types.js";

/** Last names of teammates with leg reasons mentioning this injury (up to 3). */
export function topBeneficiaryLastNames(
  inj: InjuryEntry,
  picks: PickLeg[],
  cap = 3
): string[] {
  const last = inj.playerName.split(" ").pop()?.toLowerCase() ?? "";
  const full = inj.playerName.toLowerCase();
  const names: string[] = [];
  for (const p of picks) {
    if (p.team !== inj.teamName) continue;
    if (p.playerId === inj.playerId) continue;
    const hit = p.reasons.some((r) => {
      const low = reasonText(r).toLowerCase();
      return low.includes(full) || (last.length > 2 && low.includes(last));
    });
    if (!hit) continue;
    const label = p.playerName.split(" ").pop() ?? p.playerName;
    if (!names.includes(label)) names.push(label);
    if (names.length >= cap) break;
  }
  return names;
}