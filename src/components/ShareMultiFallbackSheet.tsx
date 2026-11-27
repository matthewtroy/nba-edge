import { useEffect, useMemo } from "react";
import { createPortal } from "react-dom";

export function ShareMultiFallbackSheet({
  open,
  blob,
  title,
  onShareAgain,
  onClose,
}: {
  open: boolean;
  blob: Blob | null;
  title: string;
  onShareAgain: () => void;
  onClose: () => void;
}) {
  const url = useMemo(
    () => (blob ? URL.createObjectURL(blob) : null),
    [blob]
  );

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [url]);

  if (!open || !url) return null;
  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[120] flex flex-col bg-black/95"
      data-testid="share-multi-fallback-sheet"
      role="dialog"
      aria-label="Share image"
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <p className="text-sm font-semibold text-white truncate">{title}</p>
        <button
          type="button"
          className="text-white/60 text-sm px-2 py-1"
          onClick={onClose}
          aria-label="Close"
        >
          ✕
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 flex items-start justify-center">
        <img
          src={url}
          alt={title}
          className="max-w-full w-[min(100%,430px)] h-auto rounded-lg select-none"
          draggable
        />
      </div>
      <p className="text-center text-xs text-white/50 px-4 pb-2">
        Long-press the image to save, or use Share again.
      </p>
      <div className="flex gap-2 p-4 pt-0 border-t border-white/10">
        <button
          type="button"
          className="flex-1 py-2.5 text-sm font-medium rounded-lg bg-white/10 text-white"
          onClick={onClose}
        >
          Close
        </button>
        <button
          type="button"
          className="flex-1 py-2.5 text-sm font-medium rounded-lg bg-white text-black"
          data-testid="share-multi-fallback-again"
          onClick={() => {
            void onShareAgain();
          }}
        >
          Share again
        </button>
      </div>
    </div>,
    document.body
  );
}

/** Fire Web Share when allowed; returns fallback reason if not. */
export function sharePngFile(
  blob: Blob,
  title: string
): Promise<"shared" | "fallback" | "aborted"> {
  const file = new File([blob], "nba-edge-multi.png", { type: "image/png" });
  if (!navigator.share) return Promise.resolve("fallback");
  if (navigator.canShare && !navigator.canShare({ files: [file] })) {
    return Promise.resolve("fallback");
  }
  return navigator
    .share({ files: [file], title })
    .then(() => "shared" as const)
    .catch((err: Error) => {
      if (err.name === "AbortError") return "aborted";
      if (err.name === "NotAllowedError") return "fallback";
      throw err;
    });
}