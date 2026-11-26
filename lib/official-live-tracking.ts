import type { OfficialCardFile } from "./official-card-time.js";
import { pickLegFromSnapshot } from "./official-leg-snapshot.js";
import type { PickLeg, SlateGame } from "./types.js";

/** Official card legs + slate rows for live polling (includes games/legs dropped from picks.json). */
export function officialLiveTrackingInputs(
  slateDate: string,
  slate: SlateGame[],
  picks: PickLeg[],
  official: OfficialCardFile | null | undefined
): { slate: SlateGame[]; legs: PickLeg[] } {
  if (!official?.legSnapshots || official.slateDate !== slateDate) {
    return { slate, legs: picks };
  }
  const fromOfficial = Object.values(official.legSnapshots).map((snap) =>
    pickLegFromSnapshot(snap)
  );
  const legsById = new Map<string, PickLeg>();
  for (const leg of picks) legsById.set(leg.id, leg);
  for (const leg of fromOfficial) {
    if (!legsById.has(leg.id)) legsById.set(leg.id, leg);
  }
  const legs = [...legsById.values()];
  const byGame = new Map(slate.map((g) => [g.id, g]));
  const mergedSlate = [...slate];
  for (const leg of legs) {
    if (byGame.has(leg.gameId)) continue;
    mergedSlate.push({
      id: leg.gameId,
      startTime: new Date().toISOString(),
      startTimeSydney: "—",
      homeTeam: leg.team,
      awayTeam: leg.opponent,
      homeTeamId: "unknown",
      awayTeamId: "unknown",
      homeB2B: false,
      awayB2B: false,
      status: "live",
    });
  }
  return { slate: mergedSlate, legs };
}