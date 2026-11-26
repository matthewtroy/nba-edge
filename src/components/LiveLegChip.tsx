import type { LiveLegView } from "@lib/live-leg";
import { liveLegChipClass, liveLegChipLabel } from "@lib/live-leg-ui";

export function LiveLegChip({ view }: { view?: LiveLegView }) {
  if (!view) return null;
  const label = liveLegChipLabel(view);
  if (!label) return null;
  return (
    <span
      className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${liveLegChipClass(view)}`}
      data-testid="live-leg-chip"
    >
      {label}
    </span>
  );
}