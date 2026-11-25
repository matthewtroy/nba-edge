/** Tags shown on leg rows / sheets (model-only tags stay internal). */
export function visibleLegTags(tags: string[]): string[] {
  return tags.filter((t) => t !== "boards shared");
}

export function visibleLegReasons(reasons: string[]): string[] {
  return reasons.filter((r) => r.toLowerCase() !== "boards shared");
}