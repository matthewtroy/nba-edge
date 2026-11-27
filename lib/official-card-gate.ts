import type { ModelPlayer } from "../scripts/model-engine.js";
import { perMinuteRates, projectedMinutes } from "./baseline.js";
import { modelRatesLogCount, normalizeLogsForPlayer } from "./game-log-normalize.js";
import type { ModelSanityResult } from "./model-sanity.js";

export interface OfficialPublishGate {
  block: boolean;
  reasons: string[];
  starterProjectedRate: number;
}

export function starterProjectedRate(players: ModelPlayer[]): number {
  if (!players.length) return 0;
  let n = 0;
  for (const p of players) {
    const logs = normalizeLogsForPlayer(p.gameLogs);
    if (modelRatesLogCount(logs) < 3) continue;
    const rates = perMinuteRates(logs);
    if (!rates) continue;
    const mins = projectedMinutes(logs);
    if (mins >= 24) n += 1;
  }
  return n / players.length;
}

export function evaluateOfficialPublishGate(input: {
  slateGameCount: number;
  pickCount: number;
  players: ModelPlayer[];
  sanity: ModelSanityResult;
}): OfficialPublishGate {
  const reasons: string[] = [];
  const starterRate = starterProjectedRate(input.players);

  if (input.slateGameCount > 0 && input.pickCount === 0) {
    reasons.push("slate has games but 0 legs");
  }
  if (input.slateGameCount > 0 && input.sanity.checked === 0) {
    reasons.push("model sanity checked 0 players");
  }
  // Model sanity and multi gate violations drop individual bets; they never block the card.
  if (input.players.length >= 8 && starterRate < 0.5) {
    reasons.push(`starter projected ${(starterRate * 100).toFixed(0)}% (<50%)`);
  }

  const block = reasons.length > 0;
  return { block, reasons, starterProjectedRate: starterRate };
}