export const INJURY_COMBINE_LOG_FILE = "injury-combine-log.json";
export const INJURY_COMBINE_LOG_REL = `public/data/${INJURY_COMBINE_LOG_FILE}`;

export interface InjuryCombineOutSplit {
  playerId: string;
  playerName: string;
  stat: "pts" | "reb" | "ast";
  n: number;
  individualEffect: number;
}

export interface InjuryCombineLogEntry {
  slateDate: string;
  playerId: string;
  playerName: string;
  stat: "pts" | "reb" | "ast";
  outSplits: InjuryCombineOutSplit[];
  method: "joint" | "sum";
  jointN?: number;
  combinedBoost: number;
  appliedBoost: number;
  actualStat?: number;
  loggedAt: string;
}

export interface InjuryCombineLogFile {
  version: 1;
  entries: InjuryCombineLogEntry[];
}