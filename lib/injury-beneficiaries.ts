import type { InjuryEntry, InjuryTeammateEffect } from "./types.js";

const STAT_LABEL: Record<InjuryTeammateEffect["stat"], string> = {
  pts: "pts",
  reb: "reb",
  ast: "ast",
  threes: "3pm",
};

export function topTeammateInjuryEffects(
  inj: InjuryEntry,
  cap = 3
): InjuryTeammateEffect[] {
  const raw = inj.teammateEffects ?? [];
  return [...raw]
    .filter((e) => Math.abs(e.delta) >= 0.5)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, cap);
}

export function formatTeammateInjuryEffectLine(inj: InjuryEntry): string | null {
  const top = topTeammateInjuryEffects(inj);
  if (!top.length) return null;
  return top
    .map((e) => {
      const last = e.playerName.split(/\s+/).pop() ?? e.playerName;
      const sign = e.delta >= 0 ? "+" : "−";
      return `${last} ${sign}${Math.abs(e.delta).toFixed(1)} ${STAT_LABEL[e.stat]}`;
    })
    .join(" · ");
}

/** @deprecated use formatTeammateInjuryEffectLine */
export function topBeneficiaryLastNames(): string[] {
  return [];
}