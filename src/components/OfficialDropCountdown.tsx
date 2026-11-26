import { useEffect, useState } from "react";
import type { DataIndexFile } from "@lib/data-index";
import { viewerTimeZone } from "@lib/viewer-slate";
import {
  dropCountdownParts,
  formatCountdownClock,
} from "@lib/premium-drop-countdown";

interface Props {
  index: DataIndexFile | null;
  show: boolean;
}

export function OfficialDropCountdown({ index, show }: Props) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  if (!show) return null;

  if (!index?.nextPublishAt) {
    return (
      <section
        className="rounded-card border border-white/[0.08] bg-gradient-to-b from-white/[0.06] to-transparent px-3 py-2.5 mb-3"
        aria-label="Official card publish countdown"
      >
        <p className="text-sm text-white/70">Next card time TBC</p>
      </section>
    );
  }

  const reduced =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const parts = dropCountdownParts(index.nextPublishAt, now, viewerTimeZone());

  return (
    <section
      className="rounded-card border border-white/[0.08] bg-gradient-to-b from-white/[0.06] to-transparent px-3 py-2.5 mb-3"
      aria-label="Official card publish countdown"
    >
      <p className="text-[11px] uppercase tracking-wide text-white/45">{parts.tease}</p>
      <p className="text-sm text-white/80 mt-0.5">
        Drops ~{parts.publishLabel}
      </p>
      {!parts.done && !reduced && (
        <p className="text-2xl font-semibold tabular-nums tracking-tight mt-1" aria-live="polite">
          {formatCountdownClock(parts)}
        </p>
      )}
      {(parts.done || reduced) && !parts.done && (
        <p className="text-sm text-white/70 mt-1">{formatCountdownClock(parts)}</p>
      )}
    </section>
  );
}