import fs from "fs";
import path from "path";

export function loadOddsApiKey(rootDir: string): string | undefined {
  if (process.env.ODDS_API_KEY?.trim()) return process.env.ODDS_API_KEY.trim();
  const p = path.join(rootDir, ".env.local");
  if (!fs.existsSync(p)) return undefined;
  const line = fs
    .readFileSync(p, "utf8")
    .split("\n")
    .find((l) => l.startsWith("ODDS_API_KEY="));
  if (!line) return undefined;
  return line.split("=").slice(1).join("=").trim();
}