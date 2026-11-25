#!/usr/bin/env tsx
import { probeNbaStats, logTrackingProbe } from "../lib/nba-tracking-probe.js";

const main = async () => {
  const result = await probeNbaStats();
  logTrackingProbe(result.status);
  if (result.detail) console.log(`tracking detail: ${result.detail}`);
  if (process.env.CI && result.status === "blocked") {
    console.log("tracking: using ESPN stand-ins in pipeline");
  }
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});