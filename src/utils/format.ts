export function sydneyTimeFromIso(iso: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-AU", {
    timeZone: "Australia/Sydney",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export function marketLabel(market: string, line: number): string {
  const map: Record<string, string> = {
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
  };
  const name = map[market] ?? market;
  if (market === "dd" || market === "td") return name;
  return `${line}+ ${name}`;
}

export function verdict(price: number, takeAt: number): "value" | "fair" | "pass" {
  if (price >= takeAt) return "value";
  if (price >= takeAt * 0.95) return "fair";
  return "pass";
}