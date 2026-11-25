import { useState } from "react";
import { ui } from "../lib/card-type-scale";

export interface CrossChip {
  id: string;
  label: string;
  legCount: number;
  excluded?: boolean;
  excludedReason?: string;
}

interface Props {
  chips: CrossChip[];
  enabled: Set<string>;
  onToggle: (id: string) => void;
}

export function CrossGameChips({ chips, enabled, onToggle }: Props) {
  const [popover, setPopover] = useState<string | null>(null);

  return (
    <div className="flex flex-wrap gap-2 mb-3 relative">
      {chips.map((chip) => {
        const on = enabled.has(chip.id);
        const excluded = chip.excluded || chip.legCount === 0;
        return (
          <span key={chip.id} className="relative">
            <button
              type="button"
              onClick={() => {
                if (excluded) {
                  setPopover(popover === chip.id ? null : chip.id);
                  return;
                }
                onToggle(chip.id);
              }}
              className={`${ui.chip} ${excluded ? ui.chipExcluded : on ? ui.chipOn : ui.chipOff}`}
            >
              {on && !excluded ? (
                <span className="text-price-green mr-0.5" aria-hidden>
                  ✓
                </span>
              ) : null}
              {chip.label}
              {!excluded && chip.legCount > 0 ? ` · ${chip.legCount}` : ""}
            </button>
            {excluded && popover === chip.id && chip.excludedReason && (
              <motionPopover
                message={chip.excludedReason}
                onClose={() => setPopover(null)}
              />
            )}
          </span>
        );
      })}
    </div>
  );
}

function motionPopover({
  message,
  onClose,
}: {
  message: string;
  onClose: () => void;
}) {
  return (
  <>
    <button
      type="button"
      className="fixed inset-0 z-30"
      aria-label="Close"
      onClick={onClose}
    />
    <p
      className="absolute z-40 left-0 top-full mt-1 w-56 text-[11px] leading-snug text-white/80 bg-card border border-white/[0.08] rounded-xl p-3 shadow-none"
      role="tooltip"
    >
      {message}
    </p>
  </>
  );
}