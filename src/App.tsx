import { useState, type ReactNode } from "react";
import { useData } from "./hooks/useData";
import { useSettings } from "./hooks/useSettings";
import { TabBar } from "./components/TabBar";
import { LegSheet } from "./components/LegSheet";
import { SettingsSheet } from "./components/SettingsSheet";
import { TodayScreen } from "./screens/TodayScreen";
import { PicksScreen } from "./screens/PicksScreen";
import { InjuriesScreen } from "./screens/InjuriesScreen";
import { ResultsScreen } from "./screens/ResultsScreen";
import type { PickLeg } from "@lib/types";

type Tab = "today" | "picks" | "injuries" | "results";

function PhoneShell({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`mx-auto w-full max-w-phone min-h-full bg-surface text-white ${className}`}>
      {children}
    </div>
  );
}

export default function App() {
  const data = useData();
  const { settings, setSettings } = useSettings();
  const [tab, setTab] = useState<Tab>("today");
  const [leg, setLeg] = useState<PickLeg | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const copy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setToast("Copied");
    setTimeout(() => setToast(null), 1500);
  };

  if (data.loading) {
    return (
      <PhoneShell className="flex items-center justify-center text-white/60 px-4">
        Loading…
      </PhoneShell>
    );
  }

  return (
    <PhoneShell className="px-4 pt-4">
      {data.error && <p className="text-sm text-red-400 mb-2">{data.error}</p>}
      {tab === "today" && (
        <TodayScreen
          data={data}
          onLegTap={setLeg}
          onCopy={copy}
          onOpenSettings={() => setSettingsOpen(true)}
          showQ1={settings.showQ1Bets}
          showLongshots={settings.showLongshots}
        />
      )}
      {tab === "picks" && (
        <PicksScreen data={data} myBookie={settings.myBookie} onLegTap={setLeg} />
      )}
      {tab === "injuries" && <InjuriesScreen data={data} />}
      {tab === "results" && <ResultsScreen data={data} />}
      <TabBar active={tab} onChange={setTab} />
      <LegSheet leg={leg} myBookie={settings.myBookie} onClose={() => setLeg(null)} />
      <SettingsSheet
        open={settingsOpen}
        settings={settings}
        onChange={setSettings}
        onClose={() => setSettingsOpen(false)}
      />
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 bg-card px-4 py-2 rounded-lg text-sm z-50">
          {toast}
        </div>
      )}
    </PhoneShell>
  );
}