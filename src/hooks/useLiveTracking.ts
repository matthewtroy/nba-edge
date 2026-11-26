import { useEffect, useMemo, useState } from "react";
import type { MultiBet, PickLeg, SlateGame } from "@lib/types";
import {
  LIVE_POLL_MS,
  createEspnDirectProvider,
  subscribeLiveSource,
  type LiveSourceSnapshot,
} from "@lib/live-source";
import { liveBetViewsForMultis, liveViewsForLegs } from "@lib/live-tracking";
import type { LiveBetView } from "@lib/live-bet";
import type { LiveLegView } from "@lib/live-leg";

export interface LiveTrackingState {
  snapshot: LiveSourceSnapshot | null;
  legViews: Map<string, LiveLegView>;
  betViews: Map<string, LiveBetView>;
  error?: string;
}

export type LiveTrackingMaps = Pick<LiveTrackingState, "legViews" | "betViews">;

function yyyymmddFromIso(dateKey: string): Date {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
}

export function useLiveTracking(
  slateDate: string,
  slate: SlateGame[],
  legs: PickLeg[],
  multis: MultiBet[],
  enabled = true
): LiveTrackingState {
  const [snapshot, setSnapshot] = useState<LiveSourceSnapshot | null>(null);
  const [error, setError] = useState<string | undefined>();

  const gameIds = useMemo(() => slate.map((g) => g.id), [slate]);

  useEffect(() => {
    if (!enabled || !slateDate || !gameIds.length) return;
    const provider = createEspnDirectProvider();
  const unsub = subscribeLiveSource({
      provider,
      date: yyyymmddFromIso(slateDate),
      gameIds,
      pollMs: LIVE_POLL_MS,
      onSnapshot: (snap) => {
        setSnapshot(snap);
        setError(undefined);
      },
      onError: (e) => {
        setError(e instanceof Error ? e.message : "Live fetch failed");
      },
    });
    return unsub;
  }, [enabled, slateDate, gameIds.join("|")]);

  const legViews = useMemo(
    () => liveViewsForLegs(legs, slate, snapshot),
    [legs, slate, snapshot]
  );
  const betViews = useMemo(
    () => liveBetViewsForMultis(multis, legViews),
    [multis, legViews]
  );

  return { snapshot, legViews, betViews, error };
}