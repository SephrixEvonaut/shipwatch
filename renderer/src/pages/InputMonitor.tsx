import { useState, useEffect, useRef, useCallback } from "react";
import type {
  ProfileDef,
  KeyEvent,
  GestureEvent,
  EngineStatus,
  KeyCalibration,
} from "../types";

const api = (window as any).electronAPI;

// ── Gesture colours ─────────────────────────────────────────────────
const GESTURE_COLOR: Record<string, string> = {
  quick: "#34d399",
  long: "#fbbf24",
  super_long: "#f97316",
  q_toggle: "#a78bfa",
  l_toggle: "#c084fc",
  double: "#60a5fa",
  triple: "#818cf8",
  quadruple: "#e879f9",
  cancel: "#ef4444",
};
const GESTURE_BG: Record<string, string> = {
  quick: "bg-emerald-500/20 text-emerald-400",
  long: "bg-amber-500/20 text-amber-400",
  super_long: "bg-orange-500/20 text-orange-400",
  q_toggle: "bg-purple-500/20 text-purple-400",
  l_toggle: "bg-purple-500/20 text-purple-400",
  double: "bg-blue-500/20 text-blue-400",
  triple: "bg-indigo-500/20 text-indigo-400",
  quadruple: "bg-fuchsia-500/20 text-fuchsia-400",
  cancel: "bg-red-500/20 text-red-400",
};

function holdColor(ms: number, cal?: KeyCalibration): string {
  if (!cal) {
    if (ms < 150) return "#34d399";
    if (ms < 400) return "#fbbf24";
    if (ms < 800) return "#f97316";
    return "#ef4444";
  }
  if (ms <= cal.singleTapMax) return "#34d399";
  if (ms <= cal.longPressMax) return "#fbbf24";
  if (ms <= cal.superLongMax) return "#f97316";
  return "#ef4444";
}

function formatTs(ts: number): string {
  return new Date(ts).toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

// ── Stream event for the log ────────────────────────────────────────
interface StreamEntry {
  id: number;
  ts: number;
  type: "key" | "gesture";
  key: string;
  direction?: "down" | "up";
  gesture?: string;
  bindingName?: string;
  output?: string[];
}

// ── Component ───────────────────────────────────────────────────────
export function InputMonitor() {
  const [status, setStatus] = useState<EngineStatus | null>(null);
  const [profile, setProfile] = useState<ProfileDef | null>(null);
  const [calibration, setCal] = useState<Record<string, KeyCalibration>>({});
  const [stream, setStream] = useState<StreamEntry[]>([]);
  const [paused, setPaused] = useState(false);
  const [keyDownTimes, setKeyDownTimes] = useState<Record<string, number>>({});
  const [keyColors, setKeyColors] = useState<Record<string, string>>({});
  const [keyGestures, setKeyGestures] = useState<
    Record<string, { gesture: string; bindingName?: string; output?: string[] }>
  >({});
  const seqRef = useRef(0);
  const logEndRef = useRef<HTMLDivElement>(null);
  const holdTimers = useRef<Record<string, ReturnType<typeof setInterval>>>({});
  const gestureTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>(
    {},
  );

  // ── Load profile + engine status ──────────────────────────────
  useEffect(() => {
    api.getEngineStatus().then((s: EngineStatus) => setStatus(s));
    api.listGuiProfiles().then((profiles: ProfileDef[]) => {
      const active = profiles.find((p: ProfileDef) => p.active) ?? profiles[0];
      setProfile(active ?? null);
      if (active?.calibration) setCal(active.calibration);
    });
  }, []);

  // Poll engine status every 2s
  useEffect(() => {
    const id = setInterval(() => {
      api.getEngineStatus().then((s: EngineStatus) => setStatus(s));
    }, 2000);
    return () => clearInterval(id);
  }, []);

  // ── Subscribe to real key events ──────────────────────────────
  useEffect(() => {
    if (!api.onKeyEvent) return;

    const handleKey = (data: KeyEvent) => {
      const key = data.key.toUpperCase();

      if (data.type === "down") {
        const now = Date.now();
        setKeyDownTimes((prev) => ({ ...prev, [key]: now }));
        setKeyColors((prev) => ({
          ...prev,
          [key]: holdColor(0, calibration[key]),
        }));

        // Clear any prior gesture badge
        if (gestureTimers.current[key]) {
          clearTimeout(gestureTimers.current[key]);
          delete gestureTimers.current[key];
        }
        setKeyGestures((prev) => {
          const next = { ...prev };
          delete next[key];
          return next;
        });

        // Start hold-color cycling
        holdTimers.current[key] = setInterval(() => {
          setKeyDownTimes((prev) => {
            const down = prev[key];
            if (!down) return prev;
            const elapsed = Date.now() - down;
            setKeyColors((c) => ({
              ...c,
              [key]: holdColor(elapsed, calibration[key]),
            }));
            return prev;
          });
        }, 50);
      } else {
        // up
        if (holdTimers.current[key]) {
          clearInterval(holdTimers.current[key]);
          delete holdTimers.current[key];
        }
        setKeyDownTimes((prev) => {
          const next = { ...prev };
          delete next[key];
          return next;
        });
        // Fade color after brief delay if no gesture arrives
        setTimeout(() => {
          setKeyColors((prev) => {
            const next = { ...prev };
            if (!keyGestures[key]) delete next[key];
            return next;
          });
        }, 400);
      }

      if (!paused) {
        setStream((prev) =>
          [
            ...prev,
            {
              id: seqRef.current++,
              ts: data.timestamp,
              type: "key" as const,
              key,
              direction: data.type,
            },
          ].slice(-200),
        );
      }
    };

    const unsub = api.onKeyEvent(handleKey);
    return () => { if (typeof unsub === 'function') unsub(); };
  }, [paused, calibration]);

  // ── Subscribe to gesture events ───────────────────────────────
  useEffect(() => {
    if (!api.onGestureEvent) return;

    const handleGesture = (data: GestureEvent) => {
      const key = data.key.toUpperCase();
      const gesture = data.gesture;
      const binding = (data as any).binding;

      // Show gesture badge on key
      setKeyGestures((prev) => ({
        ...prev,
        [key]: {
          gesture,
          bindingName: binding?.name,
          output: binding?.output,
        },
      }));
      setKeyColors((prev) => ({
        ...prev,
        [key]: GESTURE_COLOR[gesture] ?? "#34d399",
      }));

      // Clear after 2.5s
      if (gestureTimers.current[key])
        clearTimeout(gestureTimers.current[key]);
      gestureTimers.current[key] = setTimeout(() => {
        setKeyGestures((prev) => {
          const next = { ...prev };
          delete next[key];
          return next;
        });
        setKeyColors((prev) => {
          const next = { ...prev };
          delete next[key];
          return next;
        });
      }, 2500);

      if (!paused) {
        setStream((prev) =>
          [
            ...prev,
            {
              id: seqRef.current++,
              ts: data.timestamp,
              type: "gesture" as const,
              key,
              gesture,
              bindingName: binding?.name,
              output: binding?.output,
            },
          ].slice(-200),
        );
      }
    };

    const unsub = api.onGestureEvent(handleGesture);
    return () => { if (typeof unsub === 'function') unsub(); };
  }, [paused]);

  // Auto-scroll log
  useEffect(() => {
    if (!paused) logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [stream, paused]);

  const clearStream = useCallback(() => setStream([]), []);

  const bindings = profile?.bindings ?? [];
  const inputKeys = profile?.inputKeys ?? [];

  return (
    <div className="space-y-5">
      {/* ENGINE STATUS BAR */}
      <div className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900 px-5 py-3">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div
              className={`h-2.5 w-2.5 rounded-full ${status?.running ? "bg-emerald-400 animate-pulse" : "bg-zinc-600"}`}
            />
            <span className="text-sm font-medium text-zinc-300">
              {status?.running ? "Engine Running" : "Engine Stopped"}
            </span>
          </div>
          {status?.running && (
            <>
              <span className="text-xs text-zinc-500">|</span>
              <span className="text-xs text-zinc-400">
                Profile:{" "}
                <span className="text-emerald-400">
                  {status.activeProfile}
                </span>
              </span>
              <span className="text-xs text-zinc-500">|</span>
              <span className="text-xs text-zinc-400">
                Backend:{" "}
                <span className="text-amber-400">{status.backend}</span>
              </span>
              <span className="text-xs text-zinc-500">|</span>
              <span className="text-xs text-zinc-400">
                Gestures:{" "}
                <span className="text-blue-400">
                  {status.gesturesDetected}
                </span>
              </span>
            </>
          )}
        </div>
        {!status?.running && (
          <span className="text-xs text-zinc-500">
            Start the engine from Dashboard to test bindings
          </span>
        )}
      </div>

      {/* KEY PAD — only shows input keys from active profile */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
        <p className="mb-4 text-xs font-medium uppercase tracking-wider text-zinc-500">
          Input Keys — Press to test
        </p>
        {inputKeys.length === 0 ? (
          <p className="py-6 text-center text-sm text-zinc-600">
            No input keys configured. Set them up in the Profiles tab.
          </p>
        ) : (
          <div className="flex flex-wrap gap-3 justify-center">
            {inputKeys.map((k) => {
              const uk = k.toUpperCase();
              const isDown = !!keyDownTimes[uk];
              const color = keyColors[uk] || "";
              const gestureInfo = keyGestures[uk];
              const cal = calibration[uk] || calibration[k];
              return (
                <div key={k} className="flex flex-col items-center gap-1">
                  <div
                    className="relative flex flex-col items-center justify-center rounded-xl border border-zinc-700 transition-all duration-100"
                    style={{
                      width: 72,
                      height: 72,
                      backgroundColor: color || "#27272a",
                      transform: isDown ? "scale(1.08)" : "scale(1)",
                      boxShadow: isDown
                        ? `0 0 18px ${color}`
                        : color
                          ? `0 0 8px ${color}40`
                          : "none",
                    }}
                  >
                    <span
                      className="text-lg font-mono font-bold"
                      style={{ color: isDown || color ? "#fff" : "#a1a1aa" }}
                    >
                      {k}
                    </span>
                    {gestureInfo && (
                      <span
                        className="absolute -bottom-1 rounded-full px-1.5 py-0.5 text-[9px] font-bold"
                        style={{
                          backgroundColor:
                            (GESTURE_COLOR[gestureInfo.gesture] ?? "#34d399") +
                            "30",
                          color:
                            GESTURE_COLOR[gestureInfo.gesture] ?? "#34d399",
                        }}
                      >
                        {gestureInfo.gesture}
                      </span>
                    )}
                  </div>
                  {/* Calibration mini-bar under each key */}
                  {cal && (
                    <div
                      className="flex gap-px mt-0.5"
                      style={{ width: 72 }}
                    >
                      <div
                        className="h-1 rounded-l"
                        style={{
                          flex: cal.singleTapMax,
                          backgroundColor: "#34d399",
                        }}
                        title={`Quick <${cal.singleTapMax}ms`}
                      />
                      <div
                        className="h-1"
                        style={{
                          flex: cal.longPressMax - cal.longPressMin,
                          backgroundColor: "#fbbf24",
                        }}
                        title={`Long ${cal.longPressMin}-${cal.longPressMax}ms`}
                      />
                      <div
                        className="h-1 rounded-r"
                        style={{
                          flex: cal.superLongMax - cal.superLongMin,
                          backgroundColor: "#f97316",
                        }}
                        title={`Super ${cal.superLongMin}-${cal.superLongMax}ms`}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* BINDING REFERENCE TABLE */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
        <p className="mb-3 text-xs font-medium uppercase tracking-wider text-zinc-500">
          Active Bindings
        </p>
        {bindings.length === 0 ? (
          <p className="py-4 text-center text-sm text-zinc-600">
            No bindings configured. Add them in the Profiles tab.
          </p>
        ) : (
          <div className="grid grid-cols-[auto_auto_auto_1fr] gap-x-6 gap-y-1.5 text-xs font-mono">
            <span className="text-zinc-500 font-sans font-medium">Input</span>
            <span className="text-zinc-500 font-sans font-medium">
              Gesture
            </span>
            <span className="text-zinc-500 font-sans font-medium">
              Output
            </span>
            <span className="text-zinc-500 font-sans font-medium">Label</span>
            {bindings.map((b, i) => (
              <div key={i} className="contents">
                <span className="text-zinc-200">{b.key}</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-medium inline-block w-fit ${GESTURE_BG[b.gesture] ?? "bg-zinc-700 text-zinc-300"}`}
                >
                  {b.gesture}
                </span>
                <span className="text-emerald-400">{b.output}</span>
                <span className="text-zinc-400">{b.label}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* LIVE EVENT STREAM */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
            Live Event Stream
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPaused((p) => !p)}
              className="rounded-md border border-zinc-700 bg-zinc-800 px-3 py-1 text-xs text-zinc-300 hover:bg-zinc-700"
            >
              {paused ? "▶ Resume" : "⏸ Pause"}
            </button>
            <button
              onClick={clearStream}
              className="rounded-md border border-zinc-700 bg-zinc-800 px-3 py-1 text-xs text-zinc-300 hover:bg-zinc-700"
            >
              ✕ Clear
            </button>
          </div>
        </div>
        <div className="h-72 overflow-y-auto rounded-lg bg-zinc-950 p-3 font-mono text-xs">
          {stream.length === 0 ? (
            <p className="py-8 text-center text-zinc-600">
              {status?.running
                ? "Press any input key to see events…"
                : "Start the engine to begin monitoring"}
            </p>
          ) : (
            stream.map((evt) => {
              if (evt.type === "key") {
                const isDown = evt.direction === "down";
                return (
                  <div
                    key={evt.id}
                    className={`flex items-center gap-3 py-0.5 ${isDown ? "text-zinc-500" : "text-zinc-400"}`}
                  >
                    <span className="w-20 shrink-0 text-zinc-600">
                      {formatTs(evt.ts)}
                    </span>
                    <span className="w-4 shrink-0">
                      {isDown ? "▼" : "▲"}
                    </span>
                    <span className="w-12 shrink-0">{evt.key}</span>
                    <span className="w-10 shrink-0 text-zinc-600">
                      {isDown ? "DOWN" : "UP"}
                    </span>
                  </div>
                );
              } else {
                const gestureStyle =
                  GESTURE_BG[evt.gesture ?? ""] ??
                  "bg-zinc-700 text-zinc-300";
                return (
                  <div
                    key={evt.id}
                    className="flex items-center gap-3 py-0.5 text-zinc-100"
                  >
                    <span className="w-20 shrink-0 text-zinc-600">
                      {formatTs(evt.ts)}
                    </span>
                    <span className="w-4 shrink-0">🎯</span>
                    <span className="w-12 shrink-0 text-white font-bold">
                      {evt.key}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${gestureStyle}`}
                    >
                      {evt.gesture}
                    </span>
                    {evt.bindingName ? (
                      <>
                        <span className="text-zinc-600">→</span>
                        <span className="text-emerald-400 font-medium">
                          {evt.bindingName}
                        </span>
                        {evt.output && (
                          <span className="text-zinc-500">
                            [{evt.output.join(", ")}]
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="text-zinc-600 italic">
                        no binding
                      </span>
                    )}
                  </div>
                );
              }
            })
          )}
          <div ref={logEndRef} />
        </div>
      </div>

      {/* CALIBRATION THRESHOLDS REFERENCE */}
      {Object.keys(calibration).length > 0 && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <p className="mb-3 text-xs font-medium uppercase tracking-wider text-zinc-500">
            Calibration Thresholds
          </p>
          <div className="space-y-3">
            {Object.entries(calibration).map(([key, cal]) => (
              <div key={key} className="flex items-center gap-4">
                <span className="w-10 text-sm font-mono font-bold text-zinc-200">
                  {key}
                </span>
                <div className="flex-1 flex h-5 rounded overflow-hidden">
                  <div
                    className="flex items-center justify-center text-[9px] font-medium text-white/80"
                    style={{
                      flex: cal.singleTapMax,
                      backgroundColor: "#34d39980",
                    }}
                  >
                    Quick &lt;{cal.singleTapMax}
                  </div>
                  <div
                    style={{
                      flex: Math.max(0, cal.longPressMin - cal.singleTapMax),
                      backgroundColor: "#27272a",
                    }}
                  />
                  <div
                    className="flex items-center justify-center text-[9px] font-medium text-white/80"
                    style={{
                      flex: cal.longPressMax - cal.longPressMin,
                      backgroundColor: "#fbbf2480",
                    }}
                  >
                    Long {cal.longPressMin}–{cal.longPressMax}
                  </div>
                  <div
                    className="flex items-center justify-center text-[9px] font-medium text-white/80"
                    style={{
                      flex: cal.superLongMax - cal.superLongMin,
                      backgroundColor: "#f9731680",
                    }}
                  >
                    Super {cal.superLongMin}–{cal.superLongMax}
                  </div>
                </div>
                <span className="text-[10px] text-zinc-500 w-20 text-right">
                  Multi: {cal.multiPressWindow}ms
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
