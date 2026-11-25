import type { AppSettings } from "@lib/types";
import { FEED_BOOKIES } from "@lib/card-bookie";

interface Props {
  open: boolean;
  settings: AppSettings;
  onChange: (s: AppSettings) => void;
  onClose: () => void;
}

export function SettingsSheet({ open, settings, onChange, onClose }: Props) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex justify-end" onClick={onClose}>
      <div
        className="w-full max-w-phone bg-card h-full p-4 overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold mb-4">Settings</h2>
        <label className="block text-sm mb-2">My bookie</label>
        <select
          value={settings.myBookie}
          onChange={(e) => onChange({ ...settings, myBookie: e.target.value })}
          className="w-full mb-4 bg-surface border border-white/10 rounded-lg px-3 py-2"
        >
          {FEED_BOOKIES.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>
        <p className="text-xs text-white/50 mb-4">
          AU feed bookies only. Odds fill from the API when available.
        </p>
        <label className="block text-sm mb-2">Target profit ($)</label>
        <input
          type="number"
          value={settings.targetProfit}
          onChange={(e) =>
            onChange({ ...settings, targetProfit: Number(e.target.value) || 300 })
          }
          className="w-full mb-4 bg-surface border border-white/10 rounded-lg px-3 py-2"
        />
        <label className="block text-sm mb-2">Minimum edge (e.g. 0.08 = 8%)</label>
        <input
          type="number"
          step="0.01"
          value={settings.minEdge}
          onChange={(e) =>
            onChange({ ...settings, minEdge: Number(e.target.value) || 0.08 })
          }
          className="w-full mb-4 bg-surface border border-white/10 rounded-lg px-3 py-2"
        />
        <label className="flex items-center gap-2 mb-3">
          <input
            type="checkbox"
            checked={settings.showQ1Bets}
            onChange={(e) => onChange({ ...settings, showQ1Bets: e.target.checked })}
          />
          Show Q1 bets
        </label>
        <label className="flex items-center gap-2 mb-6">
          <input
            type="checkbox"
            checked={settings.showLongshots}
            onChange={(e) => onChange({ ...settings, showLongshots: e.target.checked })}
          />
          Show longshots
        </label>
        <button type="button" className="w-full py-2 bg-accent-high/20 rounded-lg" onClick={onClose}>
          Done
        </button>
      </div>
    </div>
  );
}