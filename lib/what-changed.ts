import type { InjuryEntry, PickLeg } from "./types.js";
import { isOutOrDoubtful } from "./injury-match.js";
import { displayPlayerName, normalizePlayerName } from "./player-names.js";

const BOOST_RE =
  /\+\s*(\d+(?:\.\d+)?)\s*(pts|points|reb|rebounds|ast|assists|threes|3pm)/i;

function normalizeStat(raw: string): string {
  const s = raw.toLowerCase();
  if (s.startsWith("pt")) return "pts";
  if (s.startsWith("reb")) return "reb";
  if (s.startsWith("ast")) return "ast";
  return "3pm";
}

function meetsMinMove(stat: string, delta: number): boolean {
  if (stat === "pts") return delta >= 1.5;
  if (stat === "reb" || stat === "ast") return delta >= 1;
  return delta >= 0.5;
}

function reasonMentionsInjury(reason: string, inj: InjuryEntry): boolean {
  const lower = reason.toLowerCase();
  const injNorm = normalizePlayerName(inj.playerName);
  const last = inj.playerName.split(" ").pop()?.toLowerCase() ?? "";
  if (lower.includes(inj.playerName.toLowerCase())) return true;
  if (last.length > 2 && lower.includes(last)) return true;
  if (lower.includes(injNorm)) return true;
  return /out:|doubtful/i.test(lower) && lower.includes(last);
}

/** Full-name injury lines with top beneficiary + stat bump from leg reasons */
export function buildWhatChanged(
  injuries: InjuryEntry[],
  picks: PickLeg[],
  limit = 3
): string[] {
  const outs = injuries.filter((i) => isOutOrDoubtful(i.status));
  const lines: string[] = [];

  for (const inj of outs) {
    const injLabel = displayPlayerName(inj.playerName);
    let best: { name: string; delta: number; stat: string } | null = null;

    for (const leg of picks) {
      if (leg.team !== inj.teamName) continue;
      if (leg.playerId === inj.playerId) continue;
      for (const r of leg.reasons) {
        if (!reasonMentionsInjury(r, inj)) continue;
        const m = r.match(BOOST_RE);
        if (!m) continue;
        const delta = Number(m[1]);
        const stat = normalizeStat(m[2]);
        if (!meetsMinMove(stat, delta)) continue;
        const better = !best || delta > best.delta;
        if (better) {
          best = {
            name: displayPlayerName(leg.playerName),
            delta,
            stat,
          };
        }
      }
    }

    if (best) {
      const bump =
        best.stat === "pts"
          ? `+${best.delta.toFixed(1)} pts`
          : `+${Math.round(best.delta)} ${best.stat}`;
      lines.push(`${injLabel} out → ${best.name} ${bump}`);
    } else {
      const boardLeg = picks
        .filter((l) => l.team === inj.teamName)
        .find(
          (l) =>
            l.tags.includes("boards shared") &&
            l.reasons.some((r) => reasonMentionsInjury(r, inj))
        );
      const starterBump = picks
        .filter((l) => l.team === inj.teamName && l.starterEligible)
        .flatMap((l) =>
          l.reasons
            .filter((r) => reasonMentionsInjury(r, inj))
            .map((r) => ({ leg: l, reason: r }))
        )
        .sort((a, b) => b.leg.probability - a.leg.probability)[0];
      if (boardLeg) {
        lines.push(`${injLabel} out → ${displayPlayerName(boardLeg.playerName)} boards`);
      } else if (starterBump) {
        const m = starterBump.reason.match(BOOST_RE);
        if (m) {
          const stat = normalizeStat(m[2]);
          const bump =
            stat === "pts"
              ? `+${Number(m[1]).toFixed(1)} pts`
              : `+${Math.round(Number(m[1]))} ${stat}`;
          lines.push(
            `${injLabel} out → ${displayPlayerName(starterBump.leg.playerName)} ${bump}`
          );
        }
      } else {
        const topBoard = picks
          .filter((l) => l.team === inj.teamName && l.tags.includes("boards shared"))
          .sort((a, b) => b.probability - a.probability)[0];
        if (topBoard) {
          lines.push(
            `${injLabel} out → ${displayPlayerName(topBoard.playerName)} boards`
          );
        }
      }
    }
    if (lines.length >= limit) break;
  }

  return lines.slice(0, limit);
}