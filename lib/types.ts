export type InjuryStatus = "Out" | "Doubtful" | "Questionable" | "Probable" | "Available";

export type Market =
  | "pts"
  | "reb"
  | "ast"
  | "3pm"
  | "q1pts"
  | "q1reb"
  | "q1ast"
  | "dd"
  | "td"
  | "combo";

export interface SlateGame {
  id: string;
  startTime: string;
  startTimeSydney: string;
  homeTeam: string;
  awayTeam: string;
  homeTeamId: string;
  awayTeamId: string;
  spread?: number;
  total?: number;
  homeB2B: boolean;
  awayB2B: boolean;
  status: string;
}

export interface InjuryEntry {
  playerId: string;
  playerName: string;
  teamId: string;
  teamName: string;
  gameId: string;
  status: InjuryStatus;
  source: string;
  updatedAt: string;
}

export interface PickLeg {
  id: string;
  gameId: string;
  team: string;
  opponent: string;
  playerId: string;
  playerName: string;
  headshotUrl: string;
  market: Market;
  line: number;
  probability: number;
  fairPrice: number;
  takeAt: number;
  bestPrice?: number;
  bestBookie?: string;
  oddsPulledAt?: string;
  tags: string[];
  reasons: string[];
  questionable?: boolean;
  boardsShared?: boolean;
  b2b?: boolean;
  blowoutRisk?: boolean;
  ageB2B?: boolean;
}

export type MultiType =
  | "mainPlay"
  | "booster"
  | "q1Multi"
  | "crossGameSgm"
  | "boostSgm"
  | "longshot";

export interface MultiNotBuilt {
  type: MultiType;
  label: string;
  variant?: string;
  reason: string;
}

export interface MultisJson {
  bets: MultiBet[];
  notBuilt: MultiNotBuilt[];
}

export interface MultiBet {
  type: MultiType;
  label: string;
  legs: string[];
  combinedProbability: number;
  combinedFairPrice: number;
  combinedTakeAt: number;
  combinedBestPrice?: number;
  combinedBestBookie?: string;
  oneInX: number;
  stakeSuggestion?: number;
  summary: string;
  variant?: string;
  smallSlateNote?: boolean;
}

export type SourceHealth = "ok" | "stale" | "failed" | "paused";

export interface MetaJson {
  lastUpdated: string;
  oddsLastPulled?: string;
  sources: Record<string, SourceHealth | string>;
  slateSize: number;
  smallSlate?: boolean;
}

export interface HistoryLeg {
  id: string;
  date: string;
  probability: number;
  playerId?: string;
  gameId?: string;
  market?: Market;
  line?: number;
  result?: "hit" | "miss" | "void";
  gradedAt?: string;
}

export interface HistoryMulti {
  id: string;
  type: MultiType;
  date: string;
  legIds: string[];
  result?: "hit" | "miss" | "partial";
  gradedAt?: string;
}

export interface CalibrationBucket {
  range: string;
  expected: number;
  actual: number;
  count: number;
}

export interface HistoryJson {
  legs: HistoryLeg[];
  multis: HistoryMulti[];
  calibration: CalibrationBucket[];
}

export interface PlayerGameLog {
  gameId: string;
  minutes: number;
  pts: number;
  reb: number;
  ast: number;
  threes: number;
  q1Pts?: number;
  q1Reb?: number;
  q1Ast?: number;
  date: string;
}

export interface PlayerProfile {
  id: string;
  name: string;
  teamId: string;
  teamName: string;
  position: string;
  age?: number;
  headshotUrl: string;
  seasonAvgMinutes: number;
  gameLogs: PlayerGameLog[];
}

export interface AppSettings {
  targetProfit: number;
  minEdge: number;
  showQ1Bets: boolean;
  showLongshots: boolean;
}