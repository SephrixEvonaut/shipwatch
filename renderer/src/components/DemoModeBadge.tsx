import { AlertTriangle } from "lucide-react";

export function DemoModeBadge({ visible }: { visible: boolean }) {
  if (!visible) return null;

  return (
    <div className="fixed top-3 right-3 z-50 flex items-center gap-1.5 rounded-md border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-400 backdrop-blur-sm">
      <AlertTriangle className="h-3.5 w-3.5" />
      Demo Data
    </div>
  );
}
