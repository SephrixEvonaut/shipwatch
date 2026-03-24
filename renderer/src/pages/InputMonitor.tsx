import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  Cell,
} from "recharts";

// ── Layout ──────────────────────────────────────────────────────────
const KEYBOARD_ROWS = [
  ["1", "2", "3", "4", "5", "6", "7", "8"],
  ["W", "A", "S", "D", "B", "I", "Y", "U"],
  ["T", "C", "H", "P", "Q", "E", "F", "G"],
  ["SPACE", "=", "F2", ";", "MID_CLK"],
];

const WIDE_KEYS = new Set(["SPACE", "MID_CLK"]);

// ── Gesture colours ─────────────────────────────────────────────────
const GESTURE_COLOR: Record<string, string> = {
  quick: "#34d399",
  long: "#fbbf24",
  toggle: "#a78bfa",
  "multi-tap": "#60a5fa",
  double: "#60a5fa",
};
const GESTURE_BG: Record<string, string> = {
  quick: "bg-emerald-500/20 text-emerald-400",
  long: "bg-amber-500/20 text-amber-400",
  toggle: "bg-purple-500/20 text-purple-400",
  "multi-tap": "bg-blue-500/20 text-blue-400",
  double: "bg-blue-500/20 text-blue-400",
};

// ── Hold-duration → colour mapping ─────────────────────────────────
function holdColor(ms: number): string {
  if (ms < 100) return "#34d399"; // emerald
  if (ms < 200) return "#facc15"; // yellow
  if (ms < 400) return "#f59e0b"; // amber
  return "#ef4444"; // red
}

// ── Histogram bucket colours ────────────────────────────────────────
const BUCKET_LABELS = [
  "0-50",
  "50-100",
  "100-200",
  "200-400",
  "400-800",
  "800+",
];
const BUCKET_COLORS = [
  "#34d399",
  "#34d399",
  "#facc15",
  "#f59e0b",
  "#ef4444",
  "#ef4444",
];

function bucketIndex(ms: number): number {
  if (ms < 50) return 0;
  if (ms < 100) return 1;
  if (ms < 200) return 2;
  if (ms < 400) return 3;
  if (ms < 800) return 4;
  return 5;
}

// ── Seed mock hold-duration data (realistic distribution) ───────────
function generateMockDurations(n: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const r = Math.random();
    if (r < 0.35)
      out.push(Math.round(20 + Math.random() * 30)); // 0-50
    else if (r < 0.65)
      out.push(Math.round(50 + Math.random() * 50)); // 50-100
    else if (r < 0.82)
      out.push(Math.round(100 + Math.random() * 100)); // 100-200
    else if (r < 0.92)
      out.push(Math.round(200 + Math.random() * 200)); // 200-400
    else if (r < 0.97)
      out.push(Math.round(400 + Math.random() * 400)); // 400-800
    else out.push(Math.round(800 + Math.random() * 600)); // 800+
  }
  return out;
}

const SEED_DURATIONS = generateMockDurations(200);

interface KeyState {
  downSince: number | null;
  color: string;
  gesture: string | null;
  gestureTimer: ReturnType<typeof setTimeout> | null;
  scale: boolean;
}

function gestureForDuration(ms: number): string {
  if (ms < 100) return "quick";
  if (ms < 400) return "long";
  return "toggle";
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
interface StreamEvent {
  id: number;
  ts: number;
  key: string;
  type: "down" | "up";
  holdMs: number | null;
  gesture: string | null;
}

// ── Component ───────────────────────────────────────────────────────
export function InputMonitor() {
  const [keyStates, setKeyStates] = useState<Record<string, KeyState>>({});
  const [stream, setStream] = useState<StreamEvent[]>([]);
  const [paused, setPaused] = useState(false);
  const [durations, setDurations] = useState<number[]>(SEED_DURATIONS);
  const seqRef = useRef(0);
  const logEndRef = useRef<HTMLDivElement>(null);
  const holdTimers = useRef<Record<string, ReturnType<typeof setInterval>>>({});

  // Auto-scroll the event log
  useEffect(() => {
    if (!paused) logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [stream, paused]);

  // Simulate live key events every 300-900ms
  useEffect(() => {
    const ALL_KEYS = KEYBOARD_ROWS.flat();

    const fire = () => {
      const key = ALL_KEYS[Math.floor(Math.random() * ALL_KEYS.length)];
      handleKeyDown(key);
      const holdMs =
        SEED_DURATIONS[Math.floor(Math.random() * SEED_DURATIONS.length)];
      setTimeout(() => handleKeyUp(key, holdMs), holdMs);
    };

    const id = setInterval(fire, 300 + Math.random() * 600);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paused]);

  const handleKeyDown = useCallback(
    (key: string) => {
      const now = Date.now();

      // Start a color-cycling timer
      holdTimers.current[key] = setInterval(() => {
        setKeyStates((prev) => {
          const ks = prev[key];
          if (!ks?.downSince) return prev;
          const elapsed = Date.now() - ks.downSince;
          return { ...prev, [key]: { ...ks, color: holdColor(elapsed) } };
        });
      }, 50);

      setKeyStates((prev) => ({
        ...prev,
        [key]: {
          downSince: now,
          color: holdColor(0),
          gesture: null,
          gestureTimer: prev[key]?.gestureTimer ?? null,
          scale: true,
        },
      }));

      if (!paused) {
        setStream((prev) =>
          [
            ...prev,
            {
              id: seqRef.current++,
              ts: now,
              key,
              type: "down" as const,
              holdMs: null,
              gesture: null,
            },
          ].slice(-100),
        );
      }
    },
    [paused],
  );

  const handleKeyUp = useCallback(
    (key: string, holdMs: number) => {
      const now = Date.now();
      const gesture = gestureForDuration(holdMs);

      // Stop the color cycling timer
      if (holdTimers.current[key]) {
        clearInterval(holdTimers.current[key]);
        delete holdTimers.current[key];
      }

      setKeyStates((prev) => {
        const old = prev[key];
        // Clear any existing gesture fade timer
        if (old?.gestureTimer) clearTimeout(old.gestureTimer);

        const timer = setTimeout(() => {
          setKeyStates((p) => ({
            ...p,
            [key]: {
              ...(p[key] ?? ({} as KeyState)),
              gesture: null,
              color: "",
            },
          }));
        }, 2000);

        return {
          ...prev,
          [key]: {
            downSince: null,
            color: GESTURE_COLOR[gesture] ?? "#34d399",
            gesture,
            gestureTimer: timer,
            scale: false,
          },
        };
      });

      if (!paused) {
        setStream((prev) =>
          [
            ...prev,
            {
              id: seqRef.current++,
              ts: now,
              key,
              type: "up" as const,
              holdMs,
              gesture,
            },
          ].slice(-100),
        );
      }

      setDurations((prev) => [...prev, holdMs].slice(-500));
    },
    [paused],
  );

  const clearStream = useCallback(() => setStream([]), []);

  // ── Histogram data ──────────────────────────────────────────────
  const histogramData = useMemo(() => {
    const counts = [0, 0, 0, 0, 0, 0];
    for (const d of durations) counts[bucketIndex(d)]++;
    return BUCKET_LABELS.map((label, i) => ({
      range: label,
      count: counts[i],
      fill: BUCKET_COLORS[i],
    }));
  }, [durations]);

  return (
    <div className="space-y-5">
      {/* SECTION 1: KEYBOARD HEATMAP */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
        <p className="mb-4 text-xs font-medium uppercase tracking-wider text-zinc-500">
          Keyboard Heatmap
        </p>
        <div className="flex flex-col items-center gap-2">
          {KEYBOARD_ROWS.map((row, ri) => (
            <div key={ri} className="flex gap-2">
              {row.map((k) => {
                const ks = keyStates[k];
                const isDown = !!ks?.downSince;
                const color = ks?.color || "";
                const gesture = ks?.gesture;
                const isWide = WIDE_KEYS.has(k);
                return (
                  <div
                    key={k}
                    className="relative flex flex-col items-center justify-center rounded-lg border border-zinc-700 transition-all duration-100"
                    style={{
                      width: isWide ? 80 : 48,
                      height: 48,
                      backgroundColor: color || "#27272a",
                      transform: isDown ? "scale(1.05)" : "scale(1)",
                      boxShadow: isDown
                        ? `0 0 12px ${color}`
                        : color
                          ? `0 0 6px ${color}40`
                          : "none",
                    }}
                  >
                    <span
                      className="text-xs font-mono font-medium"
                      style={{
                        color: isDown || color ? "#fff" : "#a1a1aa",
                      }}
                    >
                      {k}
                    </span>
                    {gesture && (
                      <span className="absolute -bottom-0.5 text-[9px] font-medium text-white/80">
                        {gesture}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* SECTION 2: EVENT STREAM */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
            Event Stream
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
        <div className="h-64 overflow-y-auto rounded-lg bg-zinc-950 p-3 font-mono text-xs">
          {stream.length === 0 ? (
            <p className="py-8 text-center text-zinc-600">
              Waiting for key events…
            </p>
          ) : (
            stream.map((evt) => {
              const isDown = evt.type === "down";
              const gestureStyle = evt.gesture
                ? (GESTURE_BG[evt.gesture] ?? "")
                : "";
              return (
                <div
                  key={evt.id}
                  className={`flex items-center gap-3 py-0.5 ${
                    isDown ? "text-zinc-400" : "text-zinc-100"
                  }`}
                >
                  <span className="w-16 shrink-0 text-zinc-600">
                    {formatTs(evt.ts)}
                  </span>
                  <span className="w-4 shrink-0">{isDown ? "▼" : "▲"}</span>
                  <span className="w-14 shrink-0">{evt.key}</span>
                  <span className="w-10 shrink-0">
                    {isDown ? "DOWN" : "UP"}
                  </span>
                  <span className="w-14 shrink-0 text-zinc-500">
                    {evt.holdMs != null ? `${evt.holdMs}ms` : ""}
                  </span>
                  {evt.gesture && (
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${gestureStyle}`}
                    >
                      {evt.gesture}
                    </span>
                  )}
                </div>
              );
            })
          )}
          <div ref={logEndRef} />
        </div>
      </div>

      {/* SECTION 3: HOLD DURATION HISTOGRAM */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
        <p className="mb-4 text-xs font-medium uppercase tracking-wider text-zinc-500">
          Hold Duration Distribution
        </p>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart
            data={histogramData}
            margin={{ top: 5, right: 20, bottom: 5, left: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" />
            <XAxis
              dataKey="range"
              tick={{ fill: "#a1a1aa", fontSize: 11 }}
              axisLine={{ stroke: "#52525b" }}
              tickLine={{ stroke: "#52525b" }}
              label={{
                value: "ms",
                position: "insideBottomRight",
                offset: -5,
                fill: "#71717a",
                fontSize: 10,
              }}
            />
            <YAxis
              tick={{ fill: "#a1a1aa", fontSize: 11 }}
              axisLine={{ stroke: "#52525b" }}
              tickLine={{ stroke: "#52525b" }}
            />
            <Tooltip
              contentStyle={{
                background: "#18181b",
                border: "1px solid #3f3f46",
                borderRadius: 8,
                fontSize: 12,
              }}
              labelStyle={{ color: "#a1a1aa" }}
              itemStyle={{ color: "#e4e4e7" }}
            />
            <ReferenceLine
              x="50-100"
              stroke="#34d399"
              strokeDasharray="6 3"
              label={{ value: "quick", fill: "#34d399", fontSize: 10 }}
            />
            <ReferenceLine
              x="200-400"
              stroke="#f59e0b"
              strokeDasharray="6 3"
              label={{ value: "long", fill: "#f59e0b", fontSize: 10 }}
            />
            <Bar dataKey="count" radius={[4, 4, 0, 0]}>
              {histogramData.map((entry, i) => (
                <Cell key={i} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
