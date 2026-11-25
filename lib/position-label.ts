import { positionBucket } from "./position-bucket.js";

export function positionBucketLabel(bucket: "G" | "F" | "C"): string {
  if (bucket === "C") return "centers";
  if (bucket === "F") return "forwards";
  return "guards";
}

export function positionLabelFromEspn(position?: string): string {
  return positionBucketLabel(positionBucket(position));
}