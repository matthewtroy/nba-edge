/** Layout hint for multi share image height (px width 390). */
export function shareMultiImageHeightPx(legCount: number): number {
  const header = 72;
  const perLeg = 52;
  const footer = 48;
  return header + legCount * perLeg + footer;
}

export function shareMultiCanvasSize(legCount: number): { width: number; height: number } {
  const width = 390;
  return { width, height: shareMultiImageHeightPx(legCount) };
}