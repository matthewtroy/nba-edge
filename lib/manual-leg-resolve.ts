import type { Market, PickLeg, SlateGame } from "./types.js";
import { normalizePlayerName } from "./player-names.js";

export interface ManualLegSpec {
  playerName: string;
  market: Market | string;
  line: number;
  /** Match key e.g. `PHI@IND` or ESPN game id. */
  game?: string;
}

export interface ManualLegResolveError {
  playerName: string;
  market: string;
  line: number;
  game?: string;
  message: string;
}

const GAME_KEY_TO_ID: Record<string, string> = {
  "PHI@IND": "401909328",
  "MIA@NYK": "401909326",
  "MIL@DET": "401909327",
  "BKN@TOR": "401909329",
  "ATL@BOS": "401909330",
  "MEM@MIN": "401909331",
  "DAL@PHX": "401909332",
  "LAL@SAS": "401909333",
  "DEN@UTA": "401909334",
  "NOP@LAC": "401909335",
  "GSW@POR": "401909336",
};

export function gameIdFromKey(game: string | undefined, slate: SlateGame[]): string | undefined {
  if (!game) return undefined;
  const key = game.toUpperCase().replace(/\s/g, "");
  if (GAME_KEY_TO_ID[key]) return GAME_KEY_TO_ID[key];
  if (/^\d+$/.test(game)) return game;
  const parts = key.split("@");
  if (parts.length !== 2) return undefined;
  for (const g of slate) {
    const away = g.awayTeam.split(/\s+/).pop() ?? "";
    const home = g.homeTeam.split(/\s+/).pop() ?? "";
    if (
      away.toUpperCase().startsWith(parts[0]!) ||
      parts[0]!.startsWith(away.toUpperCase().slice(0, 3))
    ) {
      if (
        home.toUpperCase().startsWith(parts[1]!) ||
        parts[1]!.startsWith(home.toUpperCase().slice(0, 3))
      ) {
        return g.id;
      }
    }
  }
  return undefined;
}

function playerCandidates(
  name: string,
  picks: PickLeg[],
  gameId?: string
): PickLeg[] {
  const norm = normalizePlayerName(name);
  const last = name.trim().split(/\s+/).pop()?.toLowerCase() ?? "";
  const out: PickLeg[] = [];
  const seen = new Set<string>();
  for (const p of picks) {
    if (gameId && p.gameId !== gameId) continue;
    const pn = normalizePlayerName(p.playerName);
    if (pn === norm || pn.includes(norm) || norm.includes(pn) || p.playerName.toLowerCase().includes(last)) {
      if (seen.has(p.playerId)) continue;
      seen.add(p.playerId);
      out.push(p);
    }
  }
  return out;
}

export function legIdFromPickShape(playerId: string, market: string, line: number): string {
  const lineKey = Number.isInteger(line) ? String(line) : String(line);
  return `${playerId}-${market}-${lineKey}`;
}

/** Resolve a manual leg to a pick-catalog leg id (may be off-ladder). */
export function resolveManualLegId(
  spec: ManualLegSpec,
  picks: PickLeg[],
  slate: SlateGame[]
): { legId: string; pick: PickLeg } | ManualLegResolveError {
  const gameId = gameIdFromKey(spec.game, slate);
  const cands = playerCandidates(spec.playerName, picks, gameId);
  if (!cands.length) {
    return {
      playerName: spec.playerName,
      market: String(spec.market),
      line: spec.line,
      game: spec.game,
      message: `no pick for name+team/game`,
    };
  }
  const playerId = cands[0]!.playerId;
  const exact = cands.find((p) => p.market === spec.market && p.line === spec.line);
  if (exact) return { legId: exact.id, pick: exact };
  const seed =
    cands.find((p) => p.market === spec.market) ??
    cands.find((p) => p.gameId === cands[0]!.gameId) ??
    cands[0]!;
  const legId = legIdFromPickShape(playerId, String(spec.market), spec.line);
  const pick: PickLeg = {
    ...seed,
    id: legId,
    market: spec.market as Market,
    line: spec.line,
  };
  return { legId, pick };
}

export function pickLegForBetId(legId: string, picks: PickLeg[]): PickLeg | null {
  const hit = picks.find((p) => p.id === legId);
  if (hit) return hit;
  const m = /^(\d+)-([a-z0-9]+)-([\d.]+)$/i.exec(legId);
  if (!m) return null;
  const playerId = m[1]!;
  const market = m[2]!;
  const line = Number(m[3]);
  const seed =
    picks.find((p) => p.playerId === playerId && p.market === market) ??
    picks.find((p) => p.playerId === playerId);
  if (!seed) return null;
  return { ...seed, id: legId, market: market as Market, line };
}