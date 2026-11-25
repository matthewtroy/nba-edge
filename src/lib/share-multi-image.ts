import { toPng } from "html-to-image";
import { shareMultiCanvasSize } from "@lib/share-multi-layout";

export async function captureMultiCardPng(el: HTMLElement, legCount: number): Promise<Blob> {
  const { width, height } = shareMultiCanvasSize(legCount);
  const dataUrl = await toPng(el, {
    width,
    height,
    pixelRatio: 2,
    cacheBust: true,
    backgroundColor: "#121821",
  });
  const res = await fetch(dataUrl);
  return res.blob();
}