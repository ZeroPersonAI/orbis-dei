import { useState } from "react";
import "./App.css";
import { HabitatView } from "./views/HabitatView";
import { SettingsView } from "./views/SettingsView";
import { InstanceView } from "./views/InstanceView";

function App() {
  const [view, setView] = useState<"habitat" | "settings">("habitat");
  const [openInstanceId, setOpenInstanceId] = useState<string | null>(null);

  if (openInstanceId) {
    return (
      <InstanceView
        instanceId={openInstanceId}
        onBack={() => setOpenInstanceId(null)}
      />
    );
  }

  return view === "habitat" ? (
    <HabitatView
      onOpenSettings={() => setView("settings")}
      onOpenInstance={setOpenInstanceId}
    />
  ) : (
    <SettingsView onBack={() => setView("habitat")} />
  );
}

export default App;
