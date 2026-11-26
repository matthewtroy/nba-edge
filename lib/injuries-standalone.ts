import type { InjuryEntry, SlateGame } from "./types.js";
import { injuriesForInjuryPanel } from "./injuries-at-tip.js";

export interface InjuryTeamBlock {
  gameId: string;
  teamId: string;
  teamName: string;
  tipIso: string;
  injuries: InjuryEntry[];
}

/** Live injuries for viewer today + optional next slate, tip order, grouped by team. */
export function standaloneInjuryBlocks(input: {
  today: { slate: SlateGame[]; injuries: InjuryEntry[]; injuriesAtTip?: InjuryEntry[] };
  next?: { slate: SlateGame[]; injuries: InjuryEntry[]; injuriesAtTip?: InjuryEntry[] } | null;
  now: Date;
}): InjuryTeamBlock[] {
  const blocks: InjuryTeamBlock[] = [];
  const seen = new Set<string>();
  const segments = [
    { label: "today", ...input.today },
    ...(input.next?.slate.length ? [{ label: "next", ...input.next }] : []),
  ] as const;
  for (const seg of segments) {
    const panel = injuriesForInjuryPanel(
      seg.injuries,
      seg.injuriesAtTip,
      seg.slate,
      input.now
    );
  const slateOrder = [...seg.slate].sort(
    (a, b) => Date.parse(a.startTime) - Date.parse(b.startTime)
  );
    for (const game of slateOrder) {
      const byTeam = new Map<string, InjuryEntry[]>();
      for (const inj of panel.filter((r) => r.gameId === game.id)) {
        const key = inj.teamId || inj.teamName;
        const arr = byTeam.get(key) ?? [];
        arr.push(inj);
        byTeam.set(key, arr);
      }
      const teams = [...byTeam.entries()].sort((a, b) =>
        (a[1][0]?.teamName ?? "").localeCompare(b[1][0]?.teamName ?? "")
      );
      for (const [teamKey, list] of teams) {
        const rowKey = `${game.id}:${teamKey}`;
        if (seen.has(rowKey)) continue;
        seen.add(rowKey);
        blocks.push({
          gameId: game.id,
          teamId: list[0]?.teamId ?? teamKey,
          teamName: list[0]?.teamName ?? teamKey,
          tipIso: game.startTime,
          injuries: list.sort((a, b) => a.playerName.localeCompare(b.playerName)),
        });
      }
    }
  }
  blocks.sort((a, b) => Date.parse(a.tipIso) - Date.parse(b.tipIso));
  return blocks;
}

export function clearQuestionableAsOutStorage(): void {
  try {
    localStorage.removeItem("nba-edge-questionable-as-out");
  } catch {
    /* ignore */
  }
}
