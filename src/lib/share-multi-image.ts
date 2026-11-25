import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { toPng } from "html-to-image";
import type { ShareBetslipLayout } from "@lib/share-betslip-layout";
import { ShareBetslipCard } from "../components/ShareBetslipCard";

export async function captureShareBetslipPng(layout: ShareBetslipLayout): Promise<Blob> {
  const host = document.createElement("div");
  host.style.position = "fixed";
  host.style.left = "-10000px";
  host.style.top = "0";
  document.body.appendChild(host);
  const root = createRoot(host);
  try {
    await new Promise<void>((resolve) => {
      root.render(createElement(ShareBetslipCard, { layout }));
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });
    const el = host.firstElementChild as HTMLElement;
    if (!el) throw new Error("share betslip mount failed");
    const dataUrl = await toPng(el, {
      width: layout.width,
      height: layout.height,
      pixelRatio: layout.dpr,
      cacheBust: true,
      backgroundColor: "#0b4d2a",
    });
    const res = await fetch(dataUrl);
    return res.blob();
  } finally {
    root.unmount();
    host.remove();
  }
}