interface StatusBadgeProps {
  status: "running" | "stopped" | "error" | "idle" | "calibrating";
  label?: string;
}

const statusStyles: Record<StatusBadgeProps["status"], string> = {
  running: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  stopped: "bg-zinc-500/15 text-zinc-400 border-zinc-500/30",
  error: "bg-red-500/15 text-red-400 border-red-500/30",
  idle: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  calibrating: "bg-blue-500/15 text-blue-400 border-blue-500/30",
};

const statusLabels: Record<StatusBadgeProps["status"], string> = {
  running: "Running",
  stopped: "Stopped",
  error: "Error",
  idle: "Idle",
  calibrating: "Calibrating",
};

export function StatusBadge({ status, label }: StatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${statusStyles[status]}`}
    >
      <span className="relative flex h-2 w-2">
        {status === "running" && (
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
        )}
        <span
          className={`relative inline-flex h-2 w-2 rounded-full ${
            status === "running"
              ? "bg-emerald-400"
              : status === "error"
                ? "bg-red-400"
                : status === "calibrating"
                  ? "bg-blue-400"
                  : status === "idle"
                    ? "bg-amber-400"
                    : "bg-zinc-400"
          }`}
        />
      </span>
      {label ?? statusLabels[status]}
    </span>
  );
}
