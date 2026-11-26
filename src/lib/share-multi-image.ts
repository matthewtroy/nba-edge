import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { toPng } from "html-to-image";
import {
  prefetchLegHeadshots,
  SHARE_CAPTURE_DPR,
  SHARE_CAPTURE_PAGE_BG,
  SHARE_CAPTURE_PADDING_PX,
  SHARE_CAPTURE_WIDTH_PX,
  shareCaptureFooterText,
} from "@lib/share-multi-capture";
import type { InjuryEntry, MultiBet, PickLeg, SlateGame } from "@lib/types";
import type { MultiBookieStorageScope } from "../hooks/useMultiBookieSelect";
import { MultiCard } from "../components/MultiCard";

export type CaptureMultiCardShareInput = {
  multi: MultiBet;
  picksById: Map<string, PickLeg>;
  injuries: InjuryEntry[];
  slate?: SlateGame[];
  preferredBookie?: string;
  lockedBookie?: string;
  publishedAt?: string;
  oddsLastPulled?: string;
  discordCopy?: boolean;
  fairOnly?: boolean;
  oddsNote?: string;
  hideBookieSelect?: boolean;
  officialDisplayOnly?: boolean;
  liveCatalog?: PickLeg[];
  compact?: boolean;
  slateDate?: string;
  bookieStorageScope?: MultiBookieStorageScope;
  republishedAt?: string;
  shareLegs: PickLeg[];
};

export async function captureMultiCardSharePng(
  input: CaptureMultiCardShareInput
): Promise<Blob> {
  const headshotOverrides = await prefetchLegHeadshots(
    input.shareLegs,
    globalThis.fetch.bind(globalThis)
  );
  const picksById = new Map(input.picksById);
  for (const [id, leg] of picksById) {
    const url = headshotOverrides[leg.playerId];
    if (url) picksById.set(id, { ...leg, headshotUrl: url });
  }
  const host = document.createElement("div");
  host.setAttribute("data-testid", "share-multi-capture-host");
  host.style.position = "fixed";
  host.style.left = "-10000px";
  host.style.top = "0";
  host.style.width = `${SHARE_CAPTURE_WIDTH_PX}px`;
  host.style.boxSizing = "border-box";
  host.style.padding = `${SHARE_CAPTURE_PADDING_PX}px`;
  host.style.backgroundColor = SHARE_CAPTURE_PAGE_BG;
  host.style.color = "#ffffff";
  document.body.appendChild(host);

  const root = createRoot(host);
  try {
    await new Promise<void>((resolve) => {
      root.render(
        createElement(
          "div",
          {
            "data-testid": "share-multi-capture-root",
            style: {
              width: "100%",
              backgroundColor: SHARE_CAPTURE_PAGE_BG,
              color: "#ffffff",
            },
          },
          createElement(MultiCard, {
            multi: input.multi,
            picksById,
            injuries: input.injuries,
            slate: input.slate,
            preferredBookie: input.preferredBookie,
            lockedBookie: input.lockedBookie,
            publishedAt: input.publishedAt,
            oddsLastPulled: input.oddsLastPulled,
            discordCopy: input.discordCopy,
            fairOnly: input.fairOnly,
            oddsNote: input.oddsNote,
            hideBookieSelect: true,
            officialDisplayOnly: input.officialDisplayOnly,
            liveCatalog: input.liveCatalog,
            compact: input.compact,
            slateDate: input.slateDate,
            bookieStorageScope: input.bookieStorageScope,
            republishedAt: input.republishedAt,
            shareCapture: true,
            onLegTap: () => {},
            onCopy: () => {},
          }),
          createElement(
            "p",
            {
              "data-testid": "share-multi-capture-footer",
              style: {
                marginTop: 12,
                fontSize: 11,
                color: "rgba(255,255,255,0.45)",
                textAlign: "center",
                fontFamily: "system-ui, sans-serif",
              },
            },
            shareCaptureFooterText(input.slateDate)
          )
        )
      );
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });

    const el = host.querySelector(
      '[data-testid="share-multi-capture-root"]'
    ) as HTMLElement;
    if (!el) throw new Error("share capture mount failed");

    const width = el.offsetWidth || SHARE_CAPTURE_WIDTH_PX;
    const height = el.scrollHeight;
    const dataUrl = await toPng(el, {
      width,
      height,
      pixelRatio: SHARE_CAPTURE_DPR,
      cacheBust: true,
      backgroundColor: SHARE_CAPTURE_PAGE_BG,
    });
    const res = await fetch(dataUrl);
    return res.blob();
  } finally {
    root.unmount();
    host.remove();
  }
}