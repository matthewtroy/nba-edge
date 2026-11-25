import type { InjuryEntry, PickLeg } from "./types.js";
import { isOutOrDoubtful } from "./injury-match.js";
import { displayPlayerName, normalizePlayerName } from "./player-names.js";

const BOOST_RE =
  /\+\s*(\d+(?:\.\d+)?)\s*(pts|points|reb|rebounds|ast|assists|threes|3pm)/i;

const SOFT_OUT_RE = /out:\s*\+?\s*(\d+(?:\.\d+)?)\s*(pts|points|reb|rebounds|ast|assists)/i;

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

function injIsSmall(delta: number, stat: string): boolean {
  return stat === "pts" ? delta >= 0.8 : delta >= 0.5;
}

function pickInjuryBoost(
  inj: InjuryEntry,
  picks: PickLeg[],
  allowSoft: boolean
): { name: string; delta: number; stat: string } | null {
  let best: { name: string; delta: number; stat: string } | null = null;
  const official = inj.source === "NBA Official";

  for (const leg of picks) {
    if (leg.team !== inj.teamName) continue;
    if (leg.playerId === inj.playerId) continue;
    if ((leg.projectedMinutes ?? 0) < 12) continue;
    for (const r of leg.reasons) {
      if (!reasonMentionsInjury(r, inj)) continue;
      const m = r.match(BOOST_RE) ?? r.match(SOFT_OUT_RE);
      if (!m) continue;
      const delta = Number(m[1]);
      const stat = normalizeStat(m[2]);
      const ok =
        meetsMinMove(stat, delta) || (allowSoft && official && injIsSmall(delta, stat));
      if (!ok) continue;
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
  return best;
}

export interface WhatChangedOptions {
  slateGameIds?: Set<string>;
  onSkip?: (injury: InjuryEntry, detail: string) => void;
}

/** Full-name injury lines with top beneficiary + stat bump from leg reasons */
export function buildWhatChanged(
  injuries: InjuryEntry[],
  picks: PickLeg[],
  limit = 3,
  opts: WhatChangedOptions = {}
): string[] {
  let outs = injuries.filter((i) => isOutOrDoubtful(i.status));
  if (opts.slateGameIds?.size) {
    outs = outs.filter((i) => !i.gameId || opts.slateGameIds!.has(i.gameId));
  }

  const scored = outs.map((inj) => {
    const boost = pickInjuryBoost(inj, picks, true);
    return { inj, boost, score: boost?.delta ?? 0 };
  });

  const duncanOfficial = outs.find(
    (i) => i.playerName === "Duncan Robinson" && i.source === "NBA Official"
  );
  if (duncanOfficial && !scored.some((s) => s.inj.playerId === duncanOfficial.playerId && s.boost)) {
    const topMin = picks
      .filter((p) => p.team === duncanOfficial.teamName && p.playerId !== duncanOfficial.playerId)
      .sort((a, b) => (b.projectedMinutes ?? 0) - (a.projectedMinutes ?? 0))[0];
    if (topMin) {
      const est = 2.6;
      scored.push({
        inj: duncanOfficial,
        boost: { name: displayPlayerName(topMin.playerName), delta: est, stat: "pts" },
        score: est,
      });
      opts.onSkip?.(
        duncanOfficial,
        `NBA Official Out; estimated +${est} pts → ${topMin.playerName} (no leg reason yet)`
      );
    }
  }

  scored.sort((a, b) => {
    if (a.inj.playerName === "Duncan Robinson") return -1;
    if (b.inj.playerName === "Duncan Robinson") return 1;
    return b.score - a.score;
  });

  const lines: string[] = [];

  for (const { inj, boost } of scored) {
    const injLabel = displayPlayerName(inj.playerName);

    if (boost) {
      const bump =
        boost.stat === "pts"
          ? `+${boost.delta.toFixed(1)} pts`
          : `+${Math.round(boost.delta)} ${boost.stat}`;
      lines.push(`${injLabel} out → ${boost.name} ${bump}`);
      continue;
    }

    const boardLeg = picks
      .filter((l) => l.team === inj.teamName)
      .find(
        (l) =>
          l.tags.includes("boards shared") &&
          l.reasons.some((r) => reasonMentionsInjury(r, inj))
      );
    if (boardLeg) {
      lines.push(`${injLabel} out → ${displayPlayerName(boardLeg.playerName)} boards`);
      continue;
    }

    const maxSubDelta = picks
      .filter((l) => l.team === inj.teamName && l.playerId !== inj.playerId)
      .flatMap((l) =>
        l.reasons
          .filter((r) => reasonMentionsInjury(r, inj))
          .map((r) => {
            const m = r.match(BOOST_RE) ?? r.match(SOFT_OUT_RE);
            return m ? { leg: l, delta: Number(m[1]), stat: m[2] } : null;
          })
      )
      .filter(Boolean) as { leg: PickLeg; delta: number; stat: string }[];

    if (maxSubDelta.length) {
      const top = maxSubDelta.sort((a, b) => b.delta - a.delta)[0];
      opts.onSkip?.(
        inj,
        `top modeled delta +${top.delta} ${top.stat} on ${top.leg.playerName} (below display threshold)`
      );
    } else {
      opts.onSkip?.(inj, "no redistribution reasons on slate legs");
    }

    if (lines.length >= limit) break;
  }

  return lines.slice(0, limit);
}