import { useState } from "react";
import { Sidebar } from "./components/Sidebar";
import { DemoModeBadge } from "./components/DemoModeBadge";
import { useEngineStatus } from "./hooks/useEngineStatus";
import { Dashboard } from "./pages/Dashboard";
import { InputMonitor } from "./pages/InputMonitor";
import { GestureGallery } from "./pages/GestureGallery";
import { Profiles } from "./pages/Profiles";
import Calibration from "./pages/Calibration";
import { TrafficController } from "./pages/TrafficController";
import { TimingEngine } from "./pages/TimingEngine";
import { ExecutionPipeline } from "./pages/ExecutionPipeline";

const pages: Record<string, () => JSX.Element> = {
  dashboard: Dashboard,
  "input-monitor": InputMonitor,
  gestures: GestureGallery,
  profiles: Profiles,
  calibration: Calibration,
  "traffic-control": TrafficController,
  "timing-engine": TimingEngine,
  pipeline: ExecutionPipeline,
};

export default function App() {
  const [activePage, setActivePage] = useState("dashboard");
  const status = useEngineStatus();
  const Page = pages[activePage] ?? Dashboard;

  return (
    <div className="flex h-screen bg-zinc-950 text-zinc-100">
      <Sidebar activePage={activePage} onNavigate={setActivePage} />
      <main className="flex-1 overflow-y-auto p-6">
        <Page />
      </main>
      <DemoModeBadge visible={status?.mock === true} />
    </div>
  );
}
