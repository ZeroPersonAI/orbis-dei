import { useState } from "react";
import "./App.css";
import { HabitatView } from "./views/HabitatView";
import { SettingsView } from "./views/SettingsView";
import { InstanceView } from "./views/InstanceView";
import { PoweredBy } from "./components/PoweredBy";

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-screen flex flex-col bg-neutral-950">
      <div className="flex-1 min-h-0">{children}</div>
      <PoweredBy />
    </div>
  );
}

function App() {
  const [view, setView] = useState<"habitat" | "settings">("habitat");
  const [openInstanceId, setOpenInstanceId] = useState<string | null>(null);

  let inner: React.ReactNode;
  if (openInstanceId) {
    inner = (
      <InstanceView
        instanceId={openInstanceId}
        onBack={() => setOpenInstanceId(null)}
      />
    );
  } else if (view === "habitat") {
    inner = (
      <HabitatView
        onOpenSettings={() => setView("settings")}
        onOpenInstance={setOpenInstanceId}
      />
    );
  } else {
    inner = <SettingsView onBack={() => setView("habitat")} />;
  }

  return <Shell>{inner}</Shell>;
}

export default App;
