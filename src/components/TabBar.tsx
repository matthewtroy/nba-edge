type Tab = "today" | "picks" | "games" | "injuries" | "results";

interface Props {
  active: Tab;
  onChange: (t: Tab) => void;
}

const tabs: { id: Tab; label: string }[] = [
  { id: "today", label: "Home" },
  { id: "picks", label: "Picks" },
  { id: "games", label: "Games" },
  { id: "injuries", label: "Injuries" },
  { id: "results", label: "Results" },
];

export function TabBar({ active, onChange }: Props) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-card border-t border-white/10">
      <div className="mx-auto max-w-phone flex">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => onChange(t.id)}
            className={`flex-1 py-2.5 text-[11px] sm:text-xs font-medium ${
              active === t.id ? "text-white" : "text-white/50"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
    </nav>
  );
}