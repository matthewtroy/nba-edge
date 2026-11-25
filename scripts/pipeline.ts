import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { runModelFromFixture, loadHistory } from "./run-model.js";
import { runLivePipeline } from "./run-live.js";
import { parsePreviewFlag, parseSlateMode } from "../lib/slate-mode.js";
import { computeCalibration, emptyHistory } from "../lib/grading.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const outDir = path.join(rootDir, "public/data");

const fixtureMode = process.argv.includes("--fixture");
const forceOdds = process.argv.includes("--force-odds");
const fromLive = process.argv.includes("--from-live");
const slateMode = parseSlateMode(process.argv);

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
  const preview = parsePreviewFlag(process.argv);
  const useFromLive = fromLive;
  if (!fromLive && slateMode === "next") {
    console.log(
      "pipeline: next slate — skipping Pages from-live; will pull odds API for preview events"
    );
  } else if (fromLive && slateMode === "next") {
    console.log(
      "pipeline: next slate from-live — using Pages odds cache (markets may be thin until closer to tip)"
    );
  }
  console.log(
    `pipeline: slate=${slateMode}${preview ? " preview" : ""}${useFromLive ? " from-live" : ""}`
  );
  await runLivePipeline(rootDir, outDir, {
    forceOdds: forceOdds || useFromLive || slateMode === "next",
    fromLive: useFromLive,
    slateMode,
    preview,
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});