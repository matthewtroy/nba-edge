import type { SlateGame } from "../lib/types.js";
import {
  countPropsListedGames,
  eventHasAuPlayerProps,
  matchOddsEventIdForGame,
  type OddsEventRow,
} from "../lib/publish-now-probe.js";
import { listOddsEvents, fetchProbePlayerPoints } from "./fetch/odds-events.js";

export interface PublishNowProbeResult {
  listed: number;
  total: number;
  remaining?: number;
  probedEventId?: string;
}

/** List events (free) + one AU player_points pull; count matched next-slate games. */
export async function runPublishNowProbe(
  apiKey: string,
  slate: SlateGame[]
): Promise<PublishNowProbeResult> {
  const total = slate.length;
  const { events, remaining: remList } = await listOddsEvents(apiKey);
  let remaining = remList;
  const rows = events as OddsEventRow[];
  const first = slate.find((g) => matchOddsEventIdForGame(g, rows));
  if (!first) {
    return { listed: 0, total, remaining };
  }
  const probedEventId = matchOddsEventIdForGame(first, rows);
  if (!probedEventId) {
    return { listed: 0, total, remaining };
  }
  const probe = await fetchProbePlayerPoints(apiKey, probedEventId);
  if (probe.remaining != null) remaining = probe.remaining;
  const hasProps = eventHasAuPlayerProps(probe.data);
  const { listed } = countPropsListedGames(slate, rows, probedEventId, hasProps);
  return { listed, total, remaining, probedEventId };
}