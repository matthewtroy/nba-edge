import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { restorePersistedDataFromBranch } from "../lib/restore-data-branch.js";
import {
  applyHeadshotUrlsToSlatePicks,
  collectPlayerIdsFromPublishedSlates,
  downloadHeadshotsForPlayers,
} from "../lib/headshot-pipeline.js";
import { selfHostedHeadshotRelPath } from "../lib/headshot-store.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const dataRoot = path.join(rootDir, "public/data");

async function main() {
  const slateArg = process.argv[2]?.trim();
  if (!slateArg || !/^\d{4}-\d{2}-\d{2}$/.test(slateArg)) {
    console.error("Usage: tsx scripts/headshots-step.ts YYYY-MM-DD");
    process.exit(2);
  }

  try {
    restorePersistedDataFromBranch(rootDir, { requireWhenDataBranch: false });
  } catch {
  }

  if (!fs.existsSync(path.join(dataRoot, slateArg, "picks.json"))) {
    console.error(`headshots-step: no picks.json for slate ${slateArg}`);
    process.exit(1);
  }

  const playerIds = collectPlayerIdsFromPublishedSlates(dataRoot, [slateArg]);
  console.log(`headshots-step: ${playerIds.size} player ids on slate ${slateArg}`);
  const result = await downloadHeadshotsForPlayers(dataRoot, playerIds);
  const patched = applyHeadshotUrlsToSlatePicks(dataRoot, [slateArg]);

  const exampleId = [...playerIds][0];
  const examplePath = exampleId
    ? `public/data/${selfHostedHeadshotRelPath(exampleId)}`
    : "(none)";

  console.log(
    JSON.stringify(
      {
        downloaded: result.downloaded,
        skipped: result.skipped,
        failed: result.failed,
        totalBytes: result.totalBytes,
        picksPatched: patched,
        examplePath,
      },
      null,
      2
    )
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});