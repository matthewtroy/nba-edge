import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { runModelFromFixture, loadHistory } from "./run-model.js";
import { runLivePipeline } from "./run-live.js";
import { computeCalibration, emptyHistory } from "../lib/grading.js";

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

  let history = loadHistory(rootDir);
  if (!history.legs.length) {
    history = {
      ...emptyHistory(),
      legs: [
        {
          id: "sample-leg",
          date: "2025-11-23",
          probability: 0.72,
          result: "hit",
          gradedAt: "2025-11-24T06:00:00Z",
        },
      ],
      multis: [
        {
          id: "sample-multi",
          type: "mainPlay",
          date: "2025-11-23",
          legIds: ["sample-leg"],
          result: "hit",
          gradedAt: "2025-11-24T06:00:00Z",
        },
      ],
    };
  }
  history.calibration = computeCalibration(history.legs);
  fs.writeFileSync(path.join(outDir, "history.json"), JSON.stringify(history, null, 2));

  console.log(
    `Pipeline OK: ${result.slate.length} games, ${result.picks.length} legs, ${result.multis.length} multis`
  );
}

async function main() {
  if (fixtureMode) {
    runFixturePipeline();
    return;
  }
  const useFromLive = fromLive;
  console.log(`pipeline: dual-slate${useFromLive ? " from-live" : ""}`);
  await runLivePipeline(rootDir, outDir, {
    forceOdds: forceOdds || useFromLive,
    fromLive: useFromLive,
    republishCard,
    skipOfficialPublish: (forceOdds && !useFromLive) || republishCard,
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});