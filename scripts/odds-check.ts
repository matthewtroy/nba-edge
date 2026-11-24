import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { oddsCheckFirstGame } from "./fetch/odds-api.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

function loadEnvLocal(): string | undefined {
  const p = path.join(rootDir, ".env.local");
  if (!fs.existsSync(p)) return undefined;
  const line = fs
    .readFileSync(p, "utf8")
    .split("\n")
    .find((l) => l.startsWith("ODDS_API_KEY="));
  if (!line) return undefined;
  return line.split("=").slice(1).join("=").trim();
}

const key = process.env.ODDS_API_KEY ?? loadEnvLocal();
if (!key) {
  console.log("No ODDS_API_KEY set. Add to .env.local or environment.");
  process.exit(0);
}

oddsCheckFirstGame(key).catch((e) => {
  console.error(e);
  process.exit(1);
});