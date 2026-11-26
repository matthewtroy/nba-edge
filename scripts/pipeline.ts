import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";
import { fileURLToPath } from "url";
import { runModelFromFixture, loadHistory } from "./run-model.js";
import { runLivePipeline } from "./run-live.js";
import { skipOfficialPublishOnRun } from "../lib/pipeline-run-opts.js";
import {
  DataBranchRestoreError,
  restorePersistedDataFromBranch,
} from "../lib/restore-data-branch.js";
import { computeCalibration } from "../lib/grading.js";
import { runFreezeTippedReasons } from "./freeze-tipped-reasons.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const outDir = path.join(rootDir, "public/data");

const fixtureMode = process.argv.includes("--fixture");
const forceOdds =
  process.argv.includes("--force-odds") || process.env.PIPELINE_FORCE_ODDS === "1";
const republishCard =
  process.argv.includes("--republish-card") ||
  process.env.PIPELINE_REPUBLISH_CARD === "1";
const fromLive = process.argv.includes("--from-live");

function runFixturePipeline(): void {
  const result = runModelFromFixture(rootDir);
  const beneficiaries = result.whatChanged;

  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "slate.json"), JSON.stringify(result.slate, null, 2));
  fs.writeFileSync(path.join(outDir, "injuries.json"), JSON.stringify(result.injuries, null, 2));
  fs.writeFileSync(path.join(outDir, "picks.json"), JSON.stringify(result.picks, null, 2));
  fs.writeFileSync(
    path.join(outDir, "multis.json"),
    JSON.stringify(
      { bets: result.multis, notBuilt: result.multisPayload.notBuilt },
      null,
      2
    )
  );
  fs.writeFileSync(
    path.join(outDir, "meta.json"),
    JSON.stringify({ ...result.meta, whatChanged: beneficiaries }, null, 2)
  );

  const history = loadHistory(rootDir);
  history.calibration = computeCalibration(history.legs);
  fs.writeFileSync(path.join(outDir, "history.json"), JSON.stringify(history, null, 2));

  console.log(
    `Pipeline OK: ${result.slate.length} games, ${result.picks.length} legs, ${result.multis.length} multis`
  );
}

function runSettleStep(): void {
  runFreezeTippedReasons(rootDir);
  execFileSync("npx", ["tsx", "scripts/settle.ts"], {
    cwd: rootDir,
    stdio: "inherit",
    env: { ...process.env, SETTLE_DATA_RESTORED: "1" },
  });
}

async function main() {
  if (fixtureMode) {
    runFixturePipeline();
    return;
  }
  const skipRestore = process.env.PIPELINE_SKIP_DATA_RESTORE === "1";
  const restore = () => {
    if (skipRestore) {
      console.log("pipeline: skip data branch restore (PIPELINE_SKIP_DATA_RESTORE=1)");
      return;
    }
    restorePersistedDataFromBranch(rootDir, { requireWhenDataBranch: true });
  };
  if (process.env.SETTLE_ONLY === "1") {
    restore();
    runSettleStep();
    return;
  }
  if (process.env.SETTLE_FIRST === "1") {
    restore();
    runSettleStep();
  }
  const useFromLive = fromLive;
  try {
    restore();
  } catch (e) {
    if (e instanceof DataBranchRestoreError) {
      console.error(e.message);
      process.exit(1);
    }
    throw e;
  }
  console.log(`pipeline: dual-slate${useFromLive ? " from-live" : ""}`);
  await runLivePipeline(rootDir, outDir, {
    forceOdds: forceOdds || useFromLive,
    fromLive: useFromLive,
    republishCard,
    skipOfficialPublish: skipOfficialPublishOnRun({
      forceOdds,
      republishCard,
      fromLive: useFromLive,
    }),
  });
  if (process.env.SETTLE_AFTER_PIPELINE !== "0") {
    runSettleStep();
  } else {
    runFreezeTippedReasons(rootDir);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});