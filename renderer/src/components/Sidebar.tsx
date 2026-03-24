import {
  Home,
  Keyboard,
  Hand,
  FileText,
  Target,
  GitBranch,
  BarChart3,
  Zap,
} from "lucide-react";

const navItems = [
  { id: "dashboard", label: "Dashboard", icon: Home },
  { id: "input-monitor", label: "Input Monitor", icon: Keyboard },
  { id: "gestures", label: "Gestures", icon: Hand },
  { id: "profiles", label: "Profiles", icon: FileText },
  { id: "calibration", label: "Calibration", icon: Target },
  { id: "traffic-control", label: "Traffic Control", icon: GitBranch },
  { id: "timing-engine", label: "Timing Engine", icon: BarChart3 },
  { id: "pipeline", label: "Pipeline", icon: Zap },
];

interface SidebarProps {
  activePage: string;
  onNavigate: (page: string) => void;
}

export function Sidebar({ activePage, onNavigate }: SidebarProps) {
  return (
    <nav className="flex h-full w-[220px] flex-col bg-zinc-900 border-r border-zinc-800">
      <div className="px-5 py-4 border-b border-zinc-800">
        <h1 className="text-lg font-bold text-emerald-400 tracking-tight">
          GestureKit
        </h1>
      </div>
      <ul className="flex-1 py-2 space-y-0.5">
        {navItems.map(({ id, label, icon: Icon }) => {
          const isActive = activePage === id;
          return (
            <li key={id}>
              <button
                onClick={() => onNavigate(id)}
                className={`flex w-full items-center gap-3 px-5 py-2.5 text-sm transition-colors ${
                  isActive
                    ? "text-emerald-400 bg-emerald-500/10 border-l-2 border-emerald-500"
                    : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50 border-l-2 border-transparent"
                }`}
              >
                <Icon size={18} />
                <span>{label}</span>
              </button>
            </li>
          );
        })}
      </ul>
      <div className="px-5 py-3 border-t border-zinc-800 text-xs text-zinc-600">
        GestureKit v1.0.0
      </div>
    </nav>
  );
}
