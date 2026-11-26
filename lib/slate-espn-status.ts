/** Canonical slate game statuses written to slate.json */
export type SlateGamePhase = "scheduled" | "live" | "final";

export function normalizeEspnGameStatus(
  state: string,
  name?: string
): SlateGamePhase {
  const s = `${state} ${name ?? ""}`.toLowerCase();
  if (s.includes("final") || s === "post" || s.includes("final/ot")) {
    return "final";
  }
  if (
    s.includes("progress") ||
    s.includes("halftime") ||
    s.includes("end of") ||
    s === "in" ||
    s.trim() === "live"
  ) {
    return "live";
  }
  return "scheduled";
}

export function slateStatusLabel(phase: SlateGamePhase): string {
  if (phase === "final") return "final";
  if (phase === "live") return "live";
  return "scheduled";
}