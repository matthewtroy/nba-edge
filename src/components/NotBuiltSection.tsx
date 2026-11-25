import { useState } from "react";
import type { MultiNotBuilt } from "@lib/types";

export function NotBuiltSection({
  items,
  heading = "Not built for this slate",
}: {
  items: MultiNotBuilt[];
  heading?: string;
}) {
  const [open, setOpen] = useState(false);
  if (!items.length) return null;

  return (
    <section className="mb-4">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full text-left bg-card/60 border border-white/10 rounded-xl px-4 py-3 text-sm text-white/70"
      >
        {heading} ({items.length}) {open ? "▾" : "▸"}
      </button>
      {open && (
        <ul className="mt-2 space-y-2 text-sm text-white/60 px-2">
          {items.map((item) => (
            <li key={`${item.type}-${item.variant ?? ""}`}>
              <span className="text-white/80">
                {item.label}
                {item.variant ? ` (${item.variant})` : ""}
              </span>
              : {item.reason}
              {item.players?.length ? (
                <span className="block text-xs text-white/45 mt-0.5">
                  Players: {item.players.join(", ")}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}