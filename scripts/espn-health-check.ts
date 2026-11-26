import { verifyEspnCorsForPages } from "../lib/live-source.js";

const res = await verifyEspnCorsForPages();
console.log(
  `espn-health: cors ok=${res.ok} status=${res.status} allow-origin=${res.allowOrigin ?? "null"}`
);
if (!res.ok) process.exit(1);