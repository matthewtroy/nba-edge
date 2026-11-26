export function isGameFinal(status: string): boolean {
  const s = status.toLowerCase();
  return s === "final" || s.includes("final") || s === "post" || s.includes("final/ot");
}

export function isGameLive(status: string): boolean {
  const s = status.toLowerCase();
  if (s === "live") return true;
  return (
    s.includes("progress") ||
    s.includes("halftime") ||
    s.includes("end of") ||
    s === "in"
  );
}

export function gamesForCards(slate: import("./types.js").SlateGame[]): import("./types.js").SlateGame[] {
  return slate.filter((g) => !isGameFinal(g.status));
}

/** Games tab — one section per slate game (finals stay visible for live tracking). */
export function gamesForGamesTab(
  slate: import("./types.js").SlateGame[]
): import("./types.js").SlateGame[] {
  return slate;
}