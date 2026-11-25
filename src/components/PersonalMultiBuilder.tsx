import { useMemo, useState } from "react";
import type { PickLeg } from "@lib/types";
import { multiHasClash } from "@lib/clash";

interface Props {
  open: boolean;
  picks: PickLeg[];
  onClose: () => void;
  onSave: (legIds: string[], label: string) => void;
}

export function PersonalMultiBuilder({ open, picks, onClose, onSave }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [label, setLabel] = useState("My multi");

  const chosen = useMemo(
    () => picks.filter((p) => selected.has(p.id)),
    [picks, selected]
  );

  const clash = chosen.length >= 2 && multiHasClash(chosen);
  const canSave = chosen.length >= 2 && chosen.length <= 6 && !clash;

  if (!open) return null;

  const toggle = (id: string) => {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else if (n.size < 6) n.add(id);
      return n;
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/60" onClick={onClose}>
      <div
        className="bg-card rounded-t-2xl p-4 max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold mb-1">Generate new multi</h2>
        <p className="text-xs text-white/60 mb-3">
          Personal only — stored on this device, not posted to Discord.
        </p>
        <input
          className="w-full mb-3 py-2 px-3 bg-surface border border-white/10 rounded-lg text-sm"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Label"
        />
        <div className="space-y-1 mb-3 max-h-[50vh] overflow-y-auto">
          {picks.map((p) => (
            <label
              key={p.id}
              className="flex items-center gap-2 py-2 px-1 text-sm active:bg-white/5 rounded-lg"
            >
              <input
                type="checkbox"
                checked={selected.has(p.id)}
                onChange={() => toggle(p.id)}
              />
              <span className="truncate">
                {p.playerName} · {p.market} {p.line}+
              </span>
            </label>
          ))}
        </div>
        {clash && (
          <p className="text-sm text-accent-warn mb-2">Those legs clash — pick a different mix.</p>
        )}
        <div className="flex gap-2">
          <button
            type="button"
            className="flex-1 py-2 text-sm border border-white/20 rounded-lg"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!canSave}
            className="flex-1 py-2 text-sm bg-accent-high/30 border border-accent-high/50 rounded-lg font-medium disabled:opacity-40"
            onClick={() => {
              onSave(chosen.map((c) => c.id), label);
              setSelected(new Set());
              onClose();
            }}
          >
            Save personal multi
          </button>
        </div>
      </div>
    </div>
  );
}