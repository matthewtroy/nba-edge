const MARKET_NAMES: Record<string, string> = {
  pts: "pts",
  reb: "reb",
  ast: "ast",
  "3pm": "3PM",
  q1pts: "Q1 pts",
  q1reb: "Q1 reb",
  q1ast: "Q1 ast",
  dd: "DD",
  td: "TD",
};

/** Bookie Over line for model X+ (25+ → Over 24.5). */
export function bookieOverLine(modelLine: number): number {
  return Math.round((modelLine - 0.5) * 10) / 10;
}

export function marketLabel(market: string, line: number): string {
  const name = MARKET_NAMES[market] ?? market;
  if (market === "dd" || market === "td") return name;
  return `${line}+ ${name}`;
}

/** How AU books quote milestone props (Over 24.5 pts → model 25+ pts). */
export function bookieMarketLabel(market: string, line: number): string {
  const name = MARKET_NAMES[market] ?? market;
  if (market === "dd") return "Double-double";
  if (market === "td") return "Triple-double";
  return `Over ${bookieOverLine(line)} ${name}`;
}