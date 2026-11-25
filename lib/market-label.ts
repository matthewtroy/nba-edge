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
  combo: "7+ reb & ast",
  ptsreb: "pts+reb",
  ptsast: "pts+ast",
  rebast: "reb+ast",
  pra: "PRA",
};

/** Bookie Over line for model X+ (25+ → Over 24.5). */
export function bookieOverLine(modelLine: number): number {
  return Math.round((modelLine - 0.5) * 10) / 10;
}

export function marketLabel(market: string, line: number): string {
  const name = MARKET_NAMES[market] ?? market;
  if (market === "dd" || market === "td") return name;
  if (market === "ptsreb" || market === "ptsast" || market === "rebast" || market === "pra") {
    return `${line}+ ${name}`;
  }
  return `${line}+ ${name}`;
}

/** How AU books quote milestone props (Over 24.5 pts → model 25+ pts). */
export function bookieMarketLabel(market: string, line: number): string {
  const name = MARKET_NAMES[market] ?? market;
  if (market === "dd") return "Double-double";
  if (market === "td") return "Triple-double";
  if (market === "combo") return "Over 6.5 reb & ast";
  if (market === "ptsreb" || market === "ptsast" || market === "rebast" || market === "pra") {
    return `Over ${bookieOverLine(line)} ${name}`;
  }
  return `Over ${bookieOverLine(line)} ${name}`;
}