import fs from "fs";
import path from "path";

const DEFAULT_ALIASES: Record<string, string> = {
  "nicolas claxton": "nic claxton",
  "kentavious caldwell-pope": "kcp",
};

let aliasMap: Record<string, string> = { ...DEFAULT_ALIASES };

export function loadAliasMap(rootDir: string) {
  const p = path.join(rootDir, "fixtures", "player-aliases.json");
  if (fs.existsSync(p)) {
    try {
      aliasMap = { ...DEFAULT_ALIASES, ...JSON.parse(fs.readFileSync(p, "utf8")) };
    } catch {
      /* keep defaults */
    }
  }
}

export function normalizePlayerName(name: string): string {
  let n = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/'/g, "")
    .replace(/\s+/g, " ")
    .trim();
  n = n.replace(/\s(jr|sr|iii|ii|iv)$/i, "").trim();
  if (aliasMap[n]) n = aliasMap[n];
  return n;
}

export function namesMatch(a: string, b: string): boolean {
  return normalizePlayerName(a) === normalizePlayerName(b);
}

/** Preserve Jr/Sr/II/III/IV for UI copy */
export function displayPlayerName(name: string): string {
  return name.replace(/\s+/g, " ").trim();
}