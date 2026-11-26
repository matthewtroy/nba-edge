import type { OfficialCardMeta } from "./official-card-time.js";
import type { LegReason } from "./leg-reason-types.js";
export type { OfficialCardMeta } from "./official-card-time.js";
export type { LegReason, LegReasonType } from "./leg-reason-types.js";

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
  | "td";

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
  /** Official NBA report release time (from PDF URL); wins over ESPN updatedAt when newer. */
  reportTime?: string;
}

export type SignalKey = "PRICE" | "MATCHUP" | "FORM" | "ANGLE";

export interface LegSignalDetail {
  active: boolean;
  /** Short numeric label for UI, e.g. "L10 70%" */
  label?: string;
}

export type LegSignals = Partial<Record<SignalKey, LegSignalDetail>> & {
  context?: Record<string, string>;
  unavailable?: string[];
};

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
  /** Raw model probability before market blend */
  modelProbability?: number;
  /** Implied or borrowed market probability used in blend */
  marketProbability?: number;
  fairPrice: number;
  takeAt: number;
  bestPrice?: number;
  bestBookie?: string;
  bookiePrices?: Record<string, number>;
  oddsPulledAt?: string;
  tags: string[];
  reasons: LegReason[];
  recentVsLine?: ("hit" | "miss" | "na")[];
  /** Last 10 games Q1 hit rate at this line (starters with ESPN Q1 splits). */
  q1Last10HitRate?: number;
  /** Season Q1 clears at this line (numerator/denominator). */
  q1SeasonHitAtLine?: { hits: number; total: number };
  recentTenVsLine?: ("hit" | "miss" | "na")[];
  /** Raw stat values for last-10 chart (most recent first). */
  lastTenStatValues?: (number | null)[];
  questionable?: boolean;
  boardsShared?: boolean;
  b2b?: boolean;
  blowoutRisk?: boolean;
  ageB2B?: boolean;
  projectedMinutes?: number;
  starterEligible?: boolean;
  /** Step 4b: PRICE+MATCHUP+FORM+ANGLE count (0–4). */
  confluence?: number;
  signals?: LegSignals;
  /** Grey one-liner under name (~70 chars, numbers only). */
  reasonLine?: string;
  /** Feed priced a different rung (e.g. reb 5+ → 6+). */
  feedLineNote?: string;
  /** Model p after matchup tweak, before market blend */
  preBlendModelProbability?: number;
  /** Shadow matchup p (±4pp); not used for cards when MATCHUP_ENABLED=false */
  probabilityMatchupShadow?: number;
  matchupDeltaPp?: number;
  formGuardExcluded?: boolean;
  seasonAvg?: { pts: number; reb: number; ast: number; threes: number };
  lastFiveAvg?: { pts: number; reb: number; ast: number; threes: number };
}

export type MultiType =
  | "mainPlay"
  | "doubleUp"
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
  /** Players on the attempted multi when dropped post-build (exposure/gate/clash). */
  players?: string[];
}

export interface MultisJson {
  bets: MultiBet[];
  notBuilt: MultiNotBuilt[];
}

export type CrossGameGroupStatus = "included" | "excluded";

export interface CrossGameSgmGroup {
  gameId: string;
  status: CrossGameGroupStatus;
  legs: string[];
  excludedReason?: string;
}

export interface MultiBet {
  type: MultiType;
  label: string;
  legs: string[];
  combinedProbability: number;
  combinedFairPrice: number;
  combinedTakeAt: number;
  /** Cross-game SGM: every slate game with included legs or excluded reason. */
  crossGameGroups?: CrossGameSgmGroup[];
  /** @deprecated use bestBookieTotal */
  combinedBestPrice?: number;
  /** @deprecated use bestBookie */
  combinedBestBookie?: string;
  bestBookie?: string;
  bestBookieTotal?: number;
  bookieTotals?: Record<string, number>;
  summary: string;
  variant?: string;
  smallSlateNote?: boolean;
  /** Frozen at official publish; 0.05u bands from combined price. */
  stakeUnits?: number;
}

export type SourceHealth = "ok" | "stale" | "failed" | "paused";

export interface MetaJson {
  lastUpdated: string;
  oddsLastPulled?: string;
  sources: Record<string, SourceHealth | string>;
  slateSize: number;
  smallSlate?: boolean;
  officialCard?: OfficialCardMeta;
  whatChanged?: string[];
  nbaOfficialUrl?: string;
  nbaOfficialLastTriedUrl?: string;
  oddsCoverageNote?: string;
  pricedLegCounts?: Record<string, { total: number; priced: number }>;
  oddsAttachWarnings?: string[];
  gateViolations?: string[];
  injuryImpactLog?: string[];
  q1ExclusionLog?: string[];
  signalUnavailable?: string[];
  topConfluenceLegs?: { player: string; market: string; line: number; confluence: number; reasonLine?: string }[];
  mainPlayConfluenceRelaxed?: boolean;
  mainPlayNotes?: string[];
  slateTipDate?: string;
  slatePublicationStatus?: "draft" | "official" | "locked_at_tip";
  slateStatusLabel?: string;
  /** Per-game when odds budget skipped pull (UI reads later; JSON only). */
  gameOddsLabels?: Record<string, string>;
  /** Per-game cached price timestamp label (Sydney), JSON only. */
  gameOddsPriceAge?: Record<string, string>;
  modelSanityFailures?: number;
  modelSanityChecked?: number;
  formGuardExcludedCount?: number;
  /** Pre-tip injury rows captured when games start (badge freeze seed). */
  injuriesAtTip?: InjuryEntry[];
  /** Pre-tip reason lines captured when games start (display freeze). */
  reasonsAtTip?: ReasonAtTipSnapshot[];
  /** Data-branch commit (before first tip) that started-game legs are frozen to. */
  reasonsFrozenFrom?: ReasonsFrozenFrom;
}

export interface ReasonsFrozenFrom {
  commit: string;
  committedAt: string;
  firstTipAt: string;
}

export interface ReasonAtTipSnapshot {
  id: string;
  gameId: string;
  reasons: import("./leg-reason-types.js").LegReason[];
  reasonLine?: string;
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

export type GameLogSource = "espn" | "boxscore";

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
  teamId?: string;
  opponentTeamId?: string;
  opponent?: string;
  isHome?: boolean;
  fga?: number;
  fg3a?: number;
  fta?: number;
  turnovers?: number;
  /** ESPN player endpoint vs league boxscore backfill */
  source?: GameLogSource;
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
  /** Primary bookie for manual / API line (bet365 has no feed) */
  myBookie: string;
}

export const AU_BOOKMAKERS = [
  "bet365",
  "Sportsbet",
  "TAB",
  "TABtouch",
  "Ladbrokes",
  "Neds",
  "PointsBet",
  "Unibet",
  "Betr",
  "Picklebet",
  "Bet Right",
] as const;