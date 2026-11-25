import fs from "fs";
import path from "path";

const URL_KEYS = ["NBA_EDGE_SUPABASE_URL"] as const;
const KEY_KEYS = ["NBA_EDGE_SUPABASE_SECRET_KEY"] as const;

function fromEnvFile(rootDir: string, key: string): string | undefined {
  const p = path.join(rootDir, ".env.local");
  if (!fs.existsSync(p)) return undefined;
  const line = fs
    .readFileSync(p, "utf8")
    .split("\n")
    .find((l) => l.startsWith(`${key}=`));
  if (!line) return undefined;
  return line.split("=").slice(1).join("=").trim();
}

export function loadSupabaseConfig(rootDir: string): {
  url?: string;
  secretKey?: string;
} {
  let url = process.env.NBA_EDGE_SUPABASE_URL?.trim();
  let secretKey = process.env.NBA_EDGE_SUPABASE_SECRET_KEY?.trim();
  if (!url) url = fromEnvFile(rootDir, "NBA_EDGE_SUPABASE_URL");
  if (!secretKey) secretKey = fromEnvFile(rootDir, "NBA_EDGE_SUPABASE_SECRET_KEY");
  return { url, secretKey };
}