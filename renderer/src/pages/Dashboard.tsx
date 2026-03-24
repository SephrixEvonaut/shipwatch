import { useState, useEffect, useCallback, useRef } from "react";
import { useEngineStatus } from "../hooks/useEngineStatus";
import { useGestureEvents } from "../hooks/useGestureEvents";
import type { Profile, BackendInfo } from "../types";

const GESTURE_COLORS: Record<string, string> = {
  quick: "text-emerald-400",
  long: "text-amber-400",
  toggle: "text-purple-400",
  "multi-tap": "text-blue-400",
  double: "text-blue-400",
};

const GESTURE_BG: Record<string, string> = {
  quick: "bg-emerald-500/10",
  long: "bg-amber-500/10",
  toggle: "bg-purple-500/10",
  "multi-tap": "bg-blue-500/10",
  double: "bg-blue-500/10",
};

function formatUptime(startMs: number): string {
  if (!startMs) return "0s";
  const elapsed = Math.floor((Date.now() - startMs) / 1000);
  const h = Math.floor(elapsed / 3600);
  const m = Math.floor((elapsed % 3600) / 60);
  const s = elapsed % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function formatTimestamp(ts: number): string {
  return new Date(ts).toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function Dashboard() {
  const status = useEngineStatus();
  const gestureEvents = useGestureEvents();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [backendInfo, setBackendInfo] = useState<BackendInfo | null>(null);
  const [transitioning, setTransitioning] = useState(false);
  const [uptimeDisplay, setUptimeDisplay] = useState("0s");
  const uptimeTimer = useRef<ReturnType<typeof setInterval>>();

  const running = status?.running ?? false;

  // Fetch profiles and backend info on mount
  useEffect(() => {
    window.electronAPI
      .getProfiles()
      .then(setProfiles)
      .catch(() => {});
    window.electronAPI
      .getBackendInfo()
      .then(setBackendInfo)
      .catch(() => {});
  }, []);

  // Uptime ticker
  useEffect(() => {
    if (running && status?.uptime) {
      const tick = () => setUptimeDisplay(formatUptime(status.uptime));
      tick();
      uptimeTimer.current = setInterval(tick, 1000);
      return () => clearInterval(uptimeTimer.current);
    } else {
      setUptimeDisplay("0s");
    }
  }, [running, status?.uptime]);

  // Gestures per minute (rolling 60s window)
  const gesturesPerMin = gestureEvents.filter(
    (e) => Date.now() - e.timestamp < 60_000,
  ).length;

  const queuePressure = status
    ? Math.min(
        100,
        Math.round(
          (status.queueDepth / Math.max(status.activeExecutions, 1)) * 25,
        ),
      )
    : 0;

  const handleToggleEngine = useCallback(async () => {
    setTransitioning(true);
    try {
      if (running) {
        await window.electronAPI.stopEngine();
      } else {
        const active = profiles.find((p) => p.active);
        await window.electronAPI.startEngine(active?.name ?? "Default");
      }
    } finally {
      setTransitioning(false);
    }
  }, [running, profiles]);

  const handleProfileChange = useCallback(async (name: string) => {
    await window.electronAPI.setActiveProfile(name);
    const updated = await window.electronAPI.getProfiles();
    setProfiles(updated);
  }, []);

  const activeProfile = profiles.find((p) => p.active) ?? profiles[0];

  return (
    <div className="space-y-5">
      {/* STATUS HEADER */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-zinc-100">GestureKit</h1>
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              {running && (
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              )}
              <span
                className={`relative inline-flex h-2.5 w-2.5 rounded-full ${
                  running ? "bg-emerald-400" : "bg-red-400"
                }`}
              />
            </span>
            <span
              className={`text-sm font-medium ${
                running ? "text-emerald-400" : "text-red-400"
              }`}
            >
              {running ? "Running" : "Stopped"}
            </span>
          </div>
          {running && (
            <span className="text-sm text-zinc-500">
              Uptime: {uptimeDisplay}
            </span>
          )}
        </div>

        {/* START/STOP BUTTON */}
        <button
          onClick={handleToggleEngine}
          disabled={transitioning}
          className={`flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium transition-colors disabled:opacity-50 ${
            running
              ? "bg-red-500/15 text-red-400 border border-red-500/30 hover:bg-red-500/25"
              : "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25"
          }`}
        >
          {transitioning ? (
            <svg
              className="h-4 w-4 animate-spin"
              viewBox="0 0 24 24"
              fill="none"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
              />
            </svg>
          ) : running ? (
            "■"
          ) : (
            "▶"
          )}
          {transitioning
            ? running
              ? "Stopping…"
              : "Starting…"
            : running
              ? "Stop Engine"
              : "Start Engine"}
        </button>
      </div>

      {/* CONTROL ROW */}
      <div className="grid grid-cols-2 gap-4">
        {/* Profile selector */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <p className="mb-3 text-xs font-medium uppercase tracking-wider text-zinc-500">
            Active Profile
          </p>
          <select
            value={activeProfile?.name ?? ""}
            onChange={(e) => handleProfileChange(e.target.value)}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-emerald-500/50"
          >
            {profiles.map((p) => (
              <option key={p.name} value={p.name}>
                {p.name}
              </option>
            ))}
          </select>
          {activeProfile && (
            <p className="mt-2 text-xs text-zinc-500">
              {activeProfile.keys} keys · {activeProfile.gestures} gestures ·{" "}
              {activeProfile.backend} backend
            </p>
          )}
        </div>

        {/* Backend status */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <p className="mb-3 text-xs font-medium uppercase tracking-wider text-zinc-500">
            Backend
          </p>
          <div className="flex items-center gap-3">
            <span
              className={`inline-flex h-2.5 w-2.5 rounded-full ${
                backendInfo?.connected ? "bg-emerald-400" : "bg-zinc-600"
              }`}
            />
            <span className="text-lg font-semibold text-zinc-100">
              {backendInfo?.name
                ? backendInfo.name.charAt(0).toUpperCase() +
                  backendInfo.name.slice(1)
                : "—"}
            </span>
          </div>
          {backendInfo && (
            <p className="mt-2 text-xs text-zinc-500">
              {backendInfo.connected ? "Connected" : "Disconnected"}
              {backendInfo.port ? ` · ${backendInfo.port}` : ""}
              {backendInfo.latency
                ? ` · ${backendInfo.latency.toFixed(1)}ms latency`
                : ""}
            </p>
          )}
        </div>
      </div>

      {/* ENGINE STATS */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Keys Tracked" value={status?.gesturesDetected ?? 33} />
        <StatCard label="Gestures / min" value={gesturesPerMin} />
        <StatCard
          label="Queue Pressure"
          value={`${queuePressure}%`}
          accent={
            queuePressure > 75
              ? "text-red-400"
              : queuePressure > 40
                ? "text-amber-400"
                : "text-emerald-400"
          }
        />
        <StatCard
          label="Active Sequences"
          value={status?.activeExecutions ?? 0}
        />
      </div>

      {/* RECENT ACTIVITY */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
        <p className="mb-3 text-xs font-medium uppercase tracking-wider text-zinc-500">
          Recent Activity
        </p>
        <div className="max-h-72 space-y-1 overflow-y-auto pr-1">
          {gestureEvents.length === 0 ? (
            <p className="py-8 text-center text-sm text-zinc-600">
              No gesture events yet — start the engine to begin capturing
            </p>
          ) : (
            gestureEvents.map((evt, i) => {
              const gestureType = evt.gesture.toLowerCase();
              const colorClass = GESTURE_COLORS[gestureType] ?? "text-zinc-300";
              const bgClass = GESTURE_BG[gestureType] ?? "bg-zinc-800";
              return (
                <div
                  key={`${evt.timestamp}-${i}`}
                  className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm hover:bg-zinc-800/50"
                >
                  <span className="w-16 shrink-0 font-mono text-xs text-zinc-600">
                    {formatTimestamp(evt.timestamp)}
                  </span>
                  <span className="w-10 shrink-0 rounded bg-zinc-800 px-1.5 py-0.5 text-center font-mono text-xs text-zinc-300">
                    {evt.key}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${colorClass} ${bgClass}`}
                  >
                    {evt.gesture}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string | number;
  accent?: string;
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
      <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
        {label}
      </p>
      <p className={`mt-2 text-2xl font-bold ${accent ?? "text-zinc-100"}`}>
        {value}
      </p>
    </div>
  );
}
