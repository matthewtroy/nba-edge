import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

export function BookieBottomSheet({
  open,
  title,
  options,
  value,
  onSelect,
  onClose,
}: {
  open: boolean;
  title: string;
  options: { value: string; label: string }[];
  value: string;
  onSelect: (v: string) => void;
  onClose: () => void;
}) {
  const [dragY, setDragY] = useState(0);
  const [touchStartY, setTouchStartY] = useState<number | null>(null);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      setDragY(0);
      setTouchStartY(null);
    }
  }, [open]);

  if (!open) return null;

  if (typeof document === "undefined") return null;
  const portalTarget =
    document.getElementById("bookie-sheet-portal") ?? document.body;

  return createPortal(
    <BookieSheetOverlay onClose={onClose}>
      <BookieSheetPanel
        dragY={dragY}
        onTouchStart={(y) => setTouchStartY(y)}
        onTouchMove={(dy) => dy > 0 && setDragY(dy)}
        onTouchEnd={() => {
          if (dragY > 80) onClose();
          setDragY(0);
          setTouchStartY(null);
        }}
        touchStartY={touchStartY}
      >
        <p className="text-sm font-semibold text-white mb-3">{title}</p>
        <ul className="space-y-1 max-h-[50vh] overflow-y-auto">
          {options.map((row) => (
            <li key={row.value}>
              <button
                type="button"
                className={`w-full text-left text-sm px-3 py-2.5 rounded-lg ${
                  row.value === value
                    ? "bg-white/[0.12] text-white"
                    : "text-white/70 active:bg-white/[0.06]"
                }`}
                onClick={() => {
                  onSelect(row.value);
                  onClose();
                }}
              >
                {row.label}
              </button>
            </li>
          ))}
        </ul>
      </BookieSheetPanel>
    </BookieSheetOverlay>,
    portalTarget
  );
}

function BookieSheetOverlay({
  children,
  onClose,
}: {
  children: ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[210] pointer-events-auto" role="dialog" aria-modal="true">
      <button
        type="button"
        className="absolute inset-0 bg-black/60"
        aria-label="Close bookie picker"
        onClick={onClose}
      />
      <div className="absolute inset-x-0 bottom-0 flex justify-center pointer-events-none">
        <div className="w-full max-w-phone pointer-events-auto">{children}</div>
      </div>
    </div>
  );
}

function BookieSheetPanel({
  children,
  dragY,
  touchStartY,
  onTouchStart,
  onTouchMove,
  onTouchEnd,
}: {
  children: ReactNode;
  dragY: number;
  touchStartY: number | null;
  onTouchStart: (y: number) => void;
  onTouchMove: (dy: number) => void;
  onTouchEnd: () => void;
}) {
  return (
    <div
      className="border-t border-white/[0.08] shadow-[0_-8px_40px_rgba(0,0,0,0.45)] rounded-t-[20px] px-4 pt-3 pb-8"
      style={{ backgroundColor: "#121821", transform: dragY ? `translateY(${dragY}px)` : undefined }}
      onClick={(e) => e.stopPropagation()}
      onTouchStart={(e) => onTouchStart(e.touches[0].clientY)}
      onTouchMove={(e) => {
        if (touchStartY == null) return;
        onTouchMove(e.touches[0].clientY - touchStartY);
      }}
      onTouchEnd={onTouchEnd}
    >
      <div className="flex justify-center pb-2">
        <div className="w-9 h-1 bg-white/15 rounded-full" aria-hidden />
      </div>
      {children}
    </div>
  );
}