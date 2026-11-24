import type { PickLeg, HistoryJson, HistoryLeg, CalibrationBucket } from "./types.js";

export function gradeLegFromBox(
  leg: PickLeg,
  box: { minutes: number; pts: number; reb: number; ast: number; threes: number; q1?: { pts: number; reb: number; ast: number } }
): "hit" | "miss" | "void" {
  if (box.minutes <= 0) return "void";
  let val = 0;
  switch (leg.market) {
    case "pts":
      val = box.pts;
      break;
    case "reb":
      val = box.reb;
      break;
    case "ast":
      val = box.ast;
      break;
    case "3pm":
      val = box.threes;
      break;
    case "q1pts":
      val = box.q1?.pts ?? 0;
      break;
    case "q1reb":
      val = box.q1?.reb ?? 0;
      break;
    case "q1ast":
      val = box.q1?.ast ?? 0;
      break;
    case "dd": {
      const cats = [box.pts >= 10, box.reb >= 10, box.ast >= 10].filter(Boolean).length;
      return cats >= 2 ? "hit" : "miss";
    }
    case "td":
      return box.pts >= 10 && box.reb >= 10 && box.ast >= 10 ? "hit" : "miss";
    case "combo":
      return box.reb >= 7 && box.ast >= 7 ? "hit" : "miss";
    default:
      return "miss";
  }
  return val >= leg.line ? "hit" : "miss";
}

export function computeCalibration(legs: HistoryLeg[]): CalibrationBucket[] {
  const buckets = [
    { range: "50-60%", lo: 0.5, hi: 0.6 },
    { range: "60-70%", lo: 0.6, hi: 0.7 },
    { range: "70-80%", lo: 0.7, hi: 0.8 },
    { range: "80-90%", lo: 0.8, hi: 0.9 },
  ];
  return buckets.map(({ range, lo, hi }) => {
    const inBucket = legs.filter(
      (l) => l.result && l.result !== "void" && l.probability >= lo && l.probability < hi
    );
    const hits = inBucket.filter((l) => l.result === "hit").length;
    const actual = inBucket.length ? hits / inBucket.length : 0;
    const expected = (lo + hi) / 2;
    return { range, expected, actual, count: inBucket.length };
  });
}

export function emptyHistory(): HistoryJson {
  return { legs: [], multis: [], calibration: [] };
}