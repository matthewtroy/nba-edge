/** Known ESPN athlete id overrides when roster headshot href 404s. */
const ESPN_HEADSHOT_ID_OVERRIDES: Record<string, string> = {};

export function espnHeadshotUrl(playerId: string, hrefFromEspn?: string): string {
  const id = ESPN_HEADSHOT_ID_OVERRIDES[playerId] ?? playerId;
  if (hrefFromEspn?.trim()) return hrefFromEspn.trim();
  return `https://a.espncdn.com/i/headshots/nba/players/full/${id}.png`;
}

export function playerInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`.toUpperCase();
}