import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useEngineStatus } from "../hooks/useEngineStatus";
import { useGestureEvents } from "../hooks/useGestureEvents";
import type {
  ProfileDef,
  GestureDefinition,
  KeyCalibration,
  BackendInfo,
} from "../types";

const api = (window as any).electronAPI;

// ── Colour helpers ──────────────────────────────────────────────
const GESTURE_COLORS: Record<string, string> = {
  quick: "text-emerald-400",
  long: "text-amber-400",
  super_long: "text-orange-400",
  q_toggle: "text-purple-400",
  l_toggle: "text-purple-400",
  double: "text-blue-400",
  triple: "text-indigo-400",
  quadruple: "text-pink-400",
};
const GESTURE_BG: Record<string, string> = {
  quick: "bg-emerald-500/10",
  long: "bg-amber-500/10",
  super_long: "bg-orange-500/10",
  q_toggle: "bg-purple-500/10",
  l_toggle: "bg-purple-500/10",
  double: "bg-blue-500/10",
  triple: "bg-indigo-500/10",
  quadruple: "bg-pink-500/10",
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

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60_000);
  const hrs = Math.floor(diff / 3_600_000);
  const days = Math.floor(diff / 86_400_000);
  if (days > 0) return `${days}d ago`;
  if (hrs > 0) return `${hrs}h ago`;
  if (mins > 0) return `${mins}m ago`;
  return "just now";
}

// ═════════════════════════════════════════════════════════════════
export function Dashboard() {
  const status = useEngineStatus();
  const gestureEvents = useGestureEvents();

  const [profiles, setProfiles] = useState<ProfileDef[]>([]);
  const [gestureDefs, setGestureDefs] = useState<GestureDefinition[]>([]);
  const [backendInfo, setBackendInfo] = useState<BackendInfo | null>(null);
  const [transitioning, setTransitioning] = useState(false);
  const [uptimeDisplay, setUptimeDisplay] = useState("0s");
  const uptimeTimer = useRef<ReturnType<typeof setInterval>>();

  const running = status?.running ?? false;

  // ── Load real data on mount ───────────────────────────────────
  useEffect(() => {
    api.listGuiProfiles?.().then((p: ProfileDef[]) => setProfiles(p)).catch(() => {});
    api.listGestureDefinitions?.().then((d: GestureDefinition[]) => setGestureDefs(d)).catch(() => {});
    api.getBackendInfo?.().then((b: BackendInfo) => setBackendInfo(b)).catch(() => {});
  }, []);

  // ── Uptime ticker ─────────────────────────────────────────────
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

  // ── Derived data ──────────────────────────────────────────────
  const activeProfile = profiles.find((p) => p.active) ?? null;
  const enabledGestures = gestureDefs.filter((g) => g.enabled);

  const calibration = activeProfile?.calibration ?? {};
  const calibratedKeys = Object.keys(calibration);
  const inputKeys = activeProfile?.inputKeys ?? [];
  const uncalibratedKeys = inputKeys.filter((k) => !calibration[k]);

  const avgConfidence = useMemo(() => {
    const cals = Object.values(calibration);
    if (cals.length === 0) return 0;
    return Math.round(cals.reduce((s, c) => s + c.confidence, 0) / cals.length);
  }, [calibration]);

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

  // ── Engine control ────────────────────────────────────────────
  const handleToggleEngine = useCallback(async () => {
    setTransitioning(true);
    try {
      if (running) {
        await api.stopEngine();
      } else {
        await api.startEngine(activeProfile?.name ?? "Default");
      }
    } finally {
      setTransitioning(false);
    }
  }, [running, activeProfile]);

  const handleSetActive = useCallback(
    async (id: string) => {
      const updated = profiles.map((p) => ({ ...p, active: p.id === id }));
      setProfiles(updated);
      for (const p of updated) {
        await api.saveGuiProfile?.(p);
      }
    },
    [profiles],
  );

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
            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
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

      {/* CONTROL ROW: PROFILE + BACKEND */}
      <div className="grid grid-cols-2 gap-4">
        {/* Profile selector — uses real GUI profiles */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <p className="mb-3 text-xs font-medium uppercase tracking-wider text-zinc-500">
            Active Profile
          </p>
          {profiles.length === 0 ? (
            <p className="text-sm text-zinc-600">
              No profiles — create one in the Profiles tab
            </p>
          ) : (
            <>
              <select
                value={activeProfile?.id ?? ""}
                onChange={(e) => handleSetActive(e.target.value)}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-emerald-500/50"
              >
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name || "Unnamed"}
                  </option>
                ))}
              </select>
              {activeProfile && (
                <p className="mt-2 text-xs text-zinc-500">
                  {activeProfile.inputKeys.length} input keys ·{" "}
                  {activeProfile.bindings.length} bindings ·{" "}
                  {calibratedKeys.length}/{inputKeys.length} calibrated
                </p>
              )}
            </>
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

      {/* ENGINE STATS — all dynamic */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard
          label="Input Keys"
          value={inputKeys.length}
        />
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

      {/* OVERVIEW CARDS: GESTURES, BINDINGS, CALIBRATION */}
      <div className="grid grid-cols-3 gap-4">
        {/* Gesture definitions summary */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <p className="mb-3 text-xs font-medium uppercase tracking-wider text-zinc-500">
            Gesture Definitions
          </p>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-zinc-100">
              {enabledGestures.length}
            </span>
            <span className="text-xs text-zinc-500">
              enabled / {gestureDefs.length} total
            </span>
          </div>
          {enabledGestures.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {enabledGestures.map((g) => (
                <span
                  key={g.id}
                  className="rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] font-medium text-zinc-400"
                >
                  {g.name}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Active bindings summary */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <p className="mb-3 text-xs font-medium uppercase tracking-wider text-zinc-500">
            Active Bindings
          </p>
          {activeProfile ? (
            <>
              <span className="text-2xl font-bold text-zinc-100">
                {activeProfile.bindings.length}
              </span>
              {activeProfile.bindings.length > 0 && (
                <div className="mt-3 space-y-1 max-h-28 overflow-y-auto">
                  {activeProfile.bindings.slice(0, 8).map((b, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2 text-[11px]"
                    >
                      <span className="font-mono font-bold text-zinc-300 w-6">
                        {b.key}
                      </span>
                      <span className="text-zinc-600">→</span>
                      <span
                        className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                          GESTURE_COLORS[b.gesture] ?? "text-zinc-400"
                        } ${GESTURE_BG[b.gesture] ?? "bg-zinc-800"}`}
                      >
                        {b.gesture}
                      </span>
                      <span className="text-zinc-600">→</span>
                      <span className="font-mono text-zinc-400">{b.output}</span>
                      {b.label && (
                        <span className="text-zinc-600 truncate">
                          ({b.label})
                        </span>
                      )}
                    </div>
                  ))}
                  {activeProfile.bindings.length > 8 && (
                    <p className="text-[10px] text-zinc-600">
                      +{activeProfile.bindings.length - 8} more
                    </p>
                  )}
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-zinc-600">No active profile</p>
          )}
        </div>

        {/* Calibration summary */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <p className="mb-3 text-xs font-medium uppercase tracking-wider text-zinc-500">
            Calibration
          </p>
          {inputKeys.length === 0 ? (
            <p className="text-sm text-zinc-600">No input keys configured</p>
          ) : calibratedKeys.length === 0 ? (
            <div>
              <span className="text-2xl font-bold text-red-400">0%</span>
              <p className="mt-1 text-xs text-zinc-500">
                {inputKeys.length} keys need calibration
              </p>
            </div>
          ) : (
            <div>
              <div className="flex items-baseline gap-2">
                <span
                  className={`text-2xl font-bold ${
                    avgConfidence >= 80
                      ? "text-emerald-400"
                      : avgConfidence >= 60
                        ? "text-amber-400"
                        : "text-red-400"
                  }`}
                >
                  {avgConfidence}%
                </span>
                <span className="text-xs text-zinc-500">avg confidence</span>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {inputKeys.map((k) => {
                  const cal = calibration[k];
                  return (
                    <span
                      key={k}
                      className={`rounded px-1.5 py-0.5 text-[10px] font-mono font-bold ${
                        cal
                          ? cal.confidence >= 80
                            ? "bg-emerald-500/15 text-emerald-400"
                            : cal.confidence >= 60
                              ? "bg-amber-500/15 text-amber-400"
                              : "bg-red-500/15 text-red-400"
                          : "bg-zinc-800 text-zinc-600"
                      }`}
                    >
                      {k} {cal ? `${cal.confidence}%` : "—"}
                    </span>
                  );
                })}
              </div>
              {uncalibratedKeys.length > 0 && (
                <p className="mt-2 text-[10px] text-yellow-400/70">
                  {uncalibratedKeys.length} key{uncalibratedKeys.length > 1 ? "s" : ""} uncalibrated
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ALL PROFILES OVERVIEW */}
      {profiles.length > 1 && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <p className="mb-3 text-xs font-medium uppercase tracking-wider text-zinc-500">
            All Profiles
          </p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {profiles.map((p) => {
              const pCal = p.calibration ?? {};
              const pCalKeys = Object.keys(pCal).length;
              const pInputLen = p.inputKeys.length;
              return (
                <div
                  key={p.id}
                  className={`rounded-lg border p-3 ${
                    p.active
                      ? "border-emerald-500/30 bg-emerald-500/5"
                      : "border-zinc-800 bg-zinc-800/40"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-zinc-200">
                      {p.name || "Unnamed"}
                    </span>
                    {p.active && (
                      <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[9px] font-bold text-emerald-400">
                        ACTIVE
                      </span>
                    )}
                  </div>
                  <div className="mt-1.5 flex gap-3 text-[10px] text-zinc-500">
                    <span>
                      <span className="text-emerald-400 font-medium">{pInputLen}</span> keys
                    </span>
                    <span>
                      <span className="text-zinc-300 font-medium">{p.bindings.length}</span> bindings
                    </span>
                    <span>
                      <span
                        className={
                          pCalKeys === pInputLen && pInputLen > 0
                            ? "text-emerald-400 font-medium"
                            : "text-zinc-500 font-medium"
                        }
                      >
                        {pCalKeys}/{pInputLen}
                      </span>{" "}
                      cal
                    </span>
                  </div>
                  {p.updatedAt && (
                    <p className="mt-1 text-[9px] text-zinc-600">
                      {timeAgo(p.updatedAt)}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

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
                  {evt.binding && (
                    <span className="text-xs text-zinc-500">
                      → {evt.binding.name}
                    </span>
                  )}
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
