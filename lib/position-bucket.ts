/** Map ESPN position string to G / F / C for defense tables. */
export function positionBucket(position?: string): "G" | "F" | "C" {
  const p = (position ?? "").toUpperCase();
  if (p.includes("CENTER") || p === "C") return "C";
  if (p.includes("FORWARD") || p === "F" || p === "PF" || p === "SF") return "F";
  return "G";
}