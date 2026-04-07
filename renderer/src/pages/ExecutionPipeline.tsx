import { useState, useEffect, useRef, useMemo } from "react";
import { PageHeader } from "../components/PageHeader";

// ═══════════════════════════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════════════════════════
const C = {
  emerald: "#34d399",
  amber: "#fbbf24",
  yellow: "#facc15",
  cyan: "#22d3ee",
  red: "#ef4444",
  zinc500: "#71717a",
  zinc600: "#52525b",
  zinc700: "#3f3f46",
  zinc800: "#27272a",
  white: "#f4f4f5",
};

// ═══════════════════════════════════════════════════════════════════
// Section 1 — Animated Pipeline
// ═══════════════════════════════════════════════════════════════════
const PIPELINE_NODES = [
  "Input Listener",
  "Gesture Detector",
  "Binding Lookup",
  "Cooldown Check",
  "Traffic Control",
  "Sequence Executor",
  "Executor Factory",
  "Key Output",
];

interface Scenario {
  label: string;
  colors: string[]; // per-node color
  pauseAt?: number; // index where dot pauses extra
}

const SCENARIOS: Scenario[] = [
  {
    label: "Simple Pass",
    colors: Array(8).fill(C.emerald),
  },
  {
    label: "Cooldown Queued",
    colors: [
      C.emerald,
      C.emerald,
      C.emerald,
      C.amber,
      C.amber,
      C.emerald,
      C.emerald,
      C.emerald,
    ],
    pauseAt: 3,
  },
  {
    label: "Traffic Wait",
    colors: [
      C.emerald,
      C.emerald,
      C.emerald,
      C.emerald,
      C.yellow,
      C.yellow,
      C.emerald,
      C.emerald,
    ],
    pauseAt: 4,
  },
];

// ═══════════════════════════════════════════════════════════════════
// Expandable detail: Sequence Executor
// ═══════════════════════════════════════════════════════════════════
const BUFFER_TIERS = [
  { name: "LOW", range: "129 – 163 ms", color: C.emerald, midMs: 146 },
  { name: "MEDIUM", range: "229 – 263 ms", color: C.amber, midMs: 246 },
  { name: "HIGH", range: "513 – 667 ms", color: C.red, midMs: 590 },
];

const EXAMPLE_STEPS = [
  { label: "keyDown(Ctrl)", tier: "LOW", ms: 142 },
  { label: "keyDown(1)", tier: "LOW", ms: 138 },
  { label: "keyUp(1), keyUp(Ctrl)", tier: "LOW", ms: 155 },
];

function SequenceExecutorDetail() {
  const [activeStep, setActiveStep] = useState(-1);
  const timerRef = useRef(0);

  // Auto-animate the 3 example steps
  useEffect(() => {
    let step = -1;
    const advance = () => {
      step++;
      if (step > EXAMPLE_STEPS.length) {
        step = -1;
        setActiveStep(-1);
        timerRef.current = window.setTimeout(advance, 800);
        return;
      }
      setActiveStep(step);
      timerRef.current = window.setTimeout(advance, 700);
    };
    timerRef.current = window.setTimeout(advance, 400);
    return () => clearTimeout(timerRef.current);
  }, []);

  return (
    <div className="mt-3 rounded-lg bg-zinc-950/60 p-4 space-y-4">
      {/* Buffer Tiers */}
      <div>
        <h4 className="text-xs font-semibold text-zinc-200 mb-2">
          Buffer Tiers
        </h4>
        <div className="grid grid-cols-3 gap-2">
          {BUFFER_TIERS.map((t) => (
            <div key={t.name} className="rounded-md bg-zinc-900/80 p-3">
              <div className="flex items-center justify-between mb-1">
                <span
                  className="text-[10px] font-bold"
                  style={{ color: t.color }}
                >
                  {t.name}
                </span>
                <span className="text-[10px] font-mono text-zinc-400">
                  {t.range}
                </span>
              </div>
              {/* mini bar */}
              <div className="h-1.5 w-full rounded-full bg-zinc-800 overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${(t.midMs / 700) * 100}%`,
                    backgroundColor: t.color,
                    opacity: 0.7,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Features row */}
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-md bg-zinc-900/80 p-3">
          <span className="text-[10px] font-bold text-cyan-400">Echo Hits</span>
          <p className="mt-1 text-[10px] text-zinc-500">
            Repeats keypress N times within a window.
            <br />
            <span className="font-mono text-cyan-400/70">
              count: 3, windowMs: 250
            </span>
          </p>
          <div className="mt-2 flex gap-1">
            {[1, 2, 3].map((n) => (
              <span
                key={n}
                className="rounded bg-cyan-500/15 px-1.5 py-0.5 text-[9px] font-mono text-cyan-400"
              >
                tap {n}
              </span>
            ))}
          </div>
        </div>
        <div className="rounded-md bg-zinc-900/80 p-3">
          <span className="text-[10px] font-bold text-amber-400">
            Hold-Through-Next
          </span>
          <p className="mt-1 text-[10px] text-zinc-500">
            Modifier stays held across the next step's execution, then releases.
          </p>
          <div className="mt-2 flex items-center gap-1 text-[9px] font-mono">
            <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-amber-400">
              Ctrl ↓
            </span>
            <span className="text-zinc-600">→</span>
            <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-zinc-400">
              step exec
            </span>
            <span className="text-zinc-600">→</span>
            <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-amber-400">
              Ctrl ↑
            </span>
          </div>
        </div>
        <div className="rounded-md bg-zinc-900/80 p-3">
          <span className="text-[10px] font-bold text-emerald-400">
            Dual-Key Timing
          </span>
          <p className="mt-1 text-[10px] text-zinc-500">
            Two keys pressed with human-like stagger (5-25ms offset).
          </p>
          <div className="mt-2 flex items-center gap-1 text-[9px] font-mono">
            <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-emerald-400">
              Key A ↓
            </span>
            <span className="text-zinc-600 text-[8px]">+12ms</span>
            <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-emerald-400">
              Key B ↓
            </span>
          </div>
        </div>
      </div>

      {/* Animated 3-step walkthrough */}
      <div>
        <h4 className="text-xs font-semibold text-zinc-200 mb-2">
          Animated Sequence Walkthrough
        </h4>
        <div className="flex items-center gap-2">
          {EXAMPLE_STEPS.map((s, i) => {
            const active = activeStep === i;
            const done = activeStep > i;
            return (
              <div key={i} className="flex items-center gap-2">
                <div
                  className={`rounded-md px-3 py-2 transition-all duration-300 ${
                    active
                      ? "bg-emerald-500/20 border border-emerald-500/50 scale-105"
                      : done
                        ? "bg-zinc-800 border border-zinc-700"
                        : "bg-zinc-900 border border-zinc-800"
                  }`}
                >
                  <div className="text-[10px] font-mono font-semibold text-zinc-200">
                    Step {i + 1}
                  </div>
                  <div
                    className={`text-[9px] font-mono ${active ? "text-emerald-400" : "text-zinc-500"}`}
                  >
                    {s.label}
                  </div>
                  <div className="text-[9px] text-zinc-600">
                    {s.tier} {s.ms}ms
                  </div>
                </div>
                {i < EXAMPLE_STEPS.length - 1 && (
                  <span
                    className={`text-[10px] ${done ? "text-emerald-500" : "text-zinc-700"}`}
                  >
                    →
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Expandable detail: Executor Factory
// ═══════════════════════════════════════════════════════════════════
const FACTORY_CASCADE = [
  {
    name: "Interception",
    check: "Driver installed?",
    icon: "🔒",
    color: C.emerald,
  },
  { name: "Teensy", check: "USB HID connected?", icon: "🔌", color: C.cyan },
  {
    name: "RobotJS",
    check: "Native binding loaded?",
    icon: "🤖",
    color: C.amber,
  },
  { name: "Mock", check: "Always available", icon: "🧪", color: C.zinc500 },
];

function ExecutorFactoryDetail() {
  const [selected, setSelected] = useState(-1);
  const timerRef = useRef(0);

  // Auto-cycle through the cascade
  useEffect(() => {
    let step = -1;
    const advance = () => {
      step++;
      if (step >= FACTORY_CASCADE.length) {
        step = -1;
        setSelected(-1);
        timerRef.current = window.setTimeout(advance, 1200);
        return;
      }
      setSelected(step);
      // First backend "selected" — stop (simulate Interception found)
      if (step === 0) {
        timerRef.current = window.setTimeout(() => {
          // after "found", pause then restart
          timerRef.current = window.setTimeout(() => {
            step = -1;
            setSelected(-1);
            timerRef.current = window.setTimeout(advance, 600);
          }, 1500);
        }, 800);
        return;
      }
      timerRef.current = window.setTimeout(advance, 600);
    };
    timerRef.current = window.setTimeout(advance, 500);
    return () => clearTimeout(timerRef.current);
  }, []);

  return (
    <div className="mt-3 rounded-lg bg-zinc-950/60 p-4 space-y-3">
      <h4 className="text-xs font-semibold text-zinc-200">
        Backend Selection Cascade
      </h4>
      <p className="text-[10px] text-zinc-500">
        The factory tries each backend in priority order, selecting the first
        available.
      </p>

      <div className="flex items-center gap-2">
        {FACTORY_CASCADE.map((b, i) => {
          const active = selected === i;
          const checked = selected > i;
          const chosen = selected === 0 && i === 0; // Interception is the selected winner
          return (
            <div key={b.name} className="flex items-center gap-2">
              <div
                className={`rounded-lg px-3 py-2.5 transition-all duration-300 min-w-[110px] ${
                  chosen
                    ? "bg-emerald-500/20 border-2 border-emerald-500/60 scale-105"
                    : active
                      ? "bg-zinc-800 border-2 border-cyan-500/40"
                      : checked
                        ? "bg-zinc-900 border border-zinc-800 opacity-50"
                        : "bg-zinc-900 border border-zinc-800"
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <span className="text-sm">{b.icon}</span>
                  <span
                    className="text-[10px] font-bold"
                    style={{ color: chosen ? C.emerald : b.color }}
                  >
                    {b.name}
                  </span>
                </div>
                <div className="mt-1 text-[9px] text-zinc-500">{b.check}</div>
                {chosen && (
                  <div className="mt-1 text-[9px] font-bold text-emerald-400">
                    ✓ SELECTED
                  </div>
                )}
                {checked && !chosen && (
                  <div className="mt-1 text-[9px] text-zinc-600">skipped</div>
                )}
              </div>
              {i < FACTORY_CASCADE.length - 1 && (
                <span
                  className={`text-[10px] ${checked ? "text-zinc-700" : "text-zinc-600"}`}
                >
                  →
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Section 1 — Animated Pipeline (with expandable nodes)
// ═══════════════════════════════════════════════════════════════════
const EXPANDABLE_NODES = new Set([5, 6]); // indices: Sequence Executor, Executor Factory

function AnimatedPipeline() {
  const [scenarioIdx, setScenarioIdx] = useState(0);
  const [litCount, setLitCount] = useState(0);
  const [expandedNode, setExpandedNode] = useState<number | null>(null);
  const timerRef = useRef(0);
  const scenario = SCENARIOS[scenarioIdx];

  useEffect(() => {
    let cur = 0;
    setLitCount(0);

    const advance = () => {
      cur++;
      if (cur > PIPELINE_NODES.length) {
        // next scenario after pause
        timerRef.current = window.setTimeout(() => {
          setScenarioIdx((s) => (s + 1) % SCENARIOS.length);
        }, 600);
        return;
      }
      setLitCount(cur);
      const extra =
        scenario.pauseAt !== undefined && cur - 1 === scenario.pauseAt
          ? 600
          : 0;
      timerRef.current = window.setTimeout(advance, 400 + extra);
    };

    timerRef.current = window.setTimeout(advance, 400);
    return () => clearTimeout(timerRef.current);
  }, [scenarioIdx, scenario.pauseAt]);

  const svgW = 850;
  const svgH = 80;
  const pad = 20;
  const gap = (svgW - pad * 2) / (PIPELINE_NODES.length - 1);

  return (
    <div className="rounded-xl bg-zinc-900 p-5">
      <div className="mb-3 flex items-center gap-3">
        <h3 className="text-sm font-semibold text-zinc-100">
          Execution Pipeline
        </h3>
        <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] font-medium text-zinc-400">
          {scenario.label}
        </span>
        {expandedNode !== null && (
          <span className="rounded-full bg-cyan-500/15 px-2 py-0.5 text-[9px] font-medium text-cyan-400">
            {PIPELINE_NODES[expandedNode]} expanded — click to collapse
          </span>
        )}
      </div>

      <svg
        viewBox={`0 0 ${svgW} ${svgH}`}
        className="w-full"
        preserveAspectRatio="xMidYMid meet"
      >
        {/* connections */}
        {PIPELINE_NODES.map((_, i) => {
          if (i === 0) return null;
          const x1 = pad + (i - 1) * gap;
          const x2 = pad + i * gap;
          const lit = i < litCount;
          return (
            <line
              key={i}
              x1={x1 + 15}
              y1={30}
              x2={x2 - 15}
              y2={30}
              stroke={lit ? scenario.colors[i] : C.zinc700}
              strokeWidth={2}
              opacity={lit ? 0.7 : 0.3}
            />
          );
        })}

        {/* nodes */}
        {PIPELINE_NODES.map((n, i) => {
          const nx = pad + i * gap;
          const lit = i < litCount;
          const color = lit ? scenario.colors[i] : C.zinc700;
          const expandable = EXPANDABLE_NODES.has(i);
          const isExpanded = expandedNode === i;
          return (
            <g
              key={i}
              className={expandable ? "cursor-pointer" : ""}
              onClick={
                expandable
                  ? () => setExpandedNode(isExpanded ? null : i)
                  : undefined
              }
            >
              <circle
                cx={nx}
                cy={30}
                r={14}
                fill={
                  isExpanded ? color + "44" : lit ? color + "33" : C.zinc800
                }
                stroke={isExpanded ? C.cyan : color}
                strokeWidth={isExpanded ? 2.5 : 1.5}
              />
              <text
                x={nx}
                y={30}
                fill={lit ? C.white : C.zinc600}
                fontSize={8}
                fontWeight={600}
                textAnchor="middle"
                dominantBaseline="middle"
              >
                {i + 1}
              </text>
              <text
                x={nx}
                y={58}
                fill={isExpanded ? C.cyan : lit ? color : C.zinc600}
                fontSize={7}
                fontWeight={expandable ? 700 : 400}
                textAnchor="middle"
              >
                {n}
              </text>
              {expandable && (
                <text
                  x={nx}
                  y={70}
                  fill={C.cyan}
                  fontSize={6}
                  textAnchor="middle"
                  opacity={0.6}
                >
                  {isExpanded ? "▲ collapse" : "▼ expand"}
                </text>
              )}
            </g>
          );
        })}

        {/* animated dot */}
        {litCount > 0 && litCount <= PIPELINE_NODES.length && (
          <circle
            cx={pad + (litCount - 1) * gap}
            cy={30}
            r={4}
            fill={scenario.colors[litCount - 1]}
          >
            <animate
              attributeName="r"
              values="3;5;3"
              dur="0.5s"
              repeatCount="indefinite"
            />
          </circle>
        )}
      </svg>

      {/* Expandable detail panels */}
      {expandedNode === 5 && <SequenceExecutorDetail />}
      {expandedNode === 6 && <ExecutorFactoryDetail />}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Section 2 — Live Execution Log
// ═══════════════════════════════════════════════════════════════════
interface LogEntry {
  id: number;
  ts: string;
  type: "started" | "step" | "buffer" | "completed" | "error";
  msg: string;
}

const LOG_COLORS: Record<string, string> = {
  started: "text-cyan-400",
  step: "text-zinc-400",
  buffer: "text-amber-400",
  completed: "text-emerald-400",
  error: "text-red-400",
};

const MOCK_LOG: LogEntry[] = [
  {
    id: 1,
    ts: "00:12.341",
    type: "started",
    msg: "Sequence started: Key A quick → Ctrl+C",
  },
  {
    id: 2,
    ts: "00:12.343",
    type: "step",
    msg: "  step 1/3: keyDown(Ctrl) — buffer LOW 42ms",
  },
  {
    id: 3,
    ts: "00:12.385",
    type: "step",
    msg: "  step 2/3: keyDown(C) — buffer LOW 38ms",
  },
  {
    id: 4,
    ts: "00:12.423",
    type: "step",
    msg: "  step 3/3: keyUp(C), keyUp(Ctrl)",
  },
  {
    id: 5,
    ts: "00:12.425",
    type: "completed",
    msg: "Sequence completed: 84ms total",
  },
  {
    id: 6,
    ts: "00:13.102",
    type: "started",
    msg: "Sequence started: Key S quick → Ctrl+S",
  },
  {
    id: 7,
    ts: "00:13.105",
    type: "step",
    msg: "  step 1/3: keyDown(Ctrl) — buffer LOW 45ms",
  },
  {
    id: 8,
    ts: "00:13.150",
    type: "buffer",
    msg: "  buffer wait: 45ms (shaped Gaussian)",
  },
  {
    id: 9,
    ts: "00:13.152",
    type: "step",
    msg: "  step 2/3: keyDown(S) — buffer LOW 41ms",
  },
  {
    id: 10,
    ts: "00:13.193",
    type: "step",
    msg: "  step 3/3: keyUp(S), keyUp(Ctrl)",
  },
  {
    id: 11,
    ts: "00:13.195",
    type: "completed",
    msg: "Sequence completed: 93ms total",
  },
  {
    id: 12,
    ts: "00:14.501",
    type: "started",
    msg: "Sequence started: Key D long → Ctrl+H",
  },
  {
    id: 13,
    ts: "00:14.504",
    type: "step",
    msg: "  step 1/4: keyDown(Ctrl) — buffer MED 92ms",
  },
  {
    id: 14,
    ts: "00:14.596",
    type: "buffer",
    msg: "  buffer wait: 92ms (shaped Gaussian)",
  },
  {
    id: 15,
    ts: "00:14.598",
    type: "step",
    msg: "  step 2/4: keyDown(H) — buffer LOW 38ms",
  },
  {
    id: 16,
    ts: "00:14.636",
    type: "step",
    msg: "  step 3/4: keyUp(H) — buffer LOW 44ms",
  },
  { id: 17, ts: "00:14.680", type: "step", msg: "  step 4/4: keyUp(Ctrl)" },
  {
    id: 18,
    ts: "00:14.682",
    type: "completed",
    msg: "Sequence completed: 178ms total",
  },
  {
    id: 19,
    ts: "00:15.200",
    type: "started",
    msg: "Sequence started: Key 1 quick → Ctrl+1",
  },
  {
    id: 20,
    ts: "00:15.201",
    type: "error",
    msg: "  ERROR: Cooldown active — queued 340ms",
  },
  { id: 21, ts: "00:15.541", type: "step", msg: "  dequeued — executing now" },
  {
    id: 22,
    ts: "00:15.543",
    type: "step",
    msg: "  step 1/3: keyDown(Ctrl) — buffer LOW 40ms",
  },
  {
    id: 23,
    ts: "00:15.583",
    type: "step",
    msg: "  step 2/3: keyDown(1) — buffer LOW 36ms",
  },
  {
    id: 24,
    ts: "00:15.619",
    type: "step",
    msg: "  step 3/3: keyUp(1), keyUp(Ctrl)",
  },
  {
    id: 25,
    ts: "00:15.621",
    type: "completed",
    msg: "Sequence completed: 421ms total (inc. queue)",
  },
];

function ExecutionLog() {
  return (
    <div className="rounded-xl bg-zinc-900 p-5">
      <h3 className="mb-3 text-sm font-semibold text-zinc-100">
        Execution Log
      </h3>
      <div className="max-h-56 overflow-y-auto rounded-lg bg-zinc-950/60 p-3 font-mono text-[11px] leading-relaxed scrollbar-thin">
        {MOCK_LOG.map((e) => (
          <div key={e.id} className="flex gap-2">
            <span className="shrink-0 text-zinc-600">{e.ts}</span>
            <span className={LOG_COLORS[e.type]}>{e.msg}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Section 3 — Backend Comparison
// ═══════════════════════════════════════════════════════════════════
interface BackendDef {
  name: string;
  type: string;
  latency: string;
  pacing: string;
  desc: string;
  active: boolean;
}

const BACKENDS: BackendDef[] = [
  {
    name: "RobotJS",
    type: "Software",
    latency: "~2ms",
    pacing: "100ms+ recommended",
    desc: "User-space keystroke injection via OS APIs. Widest compatibility, higher detection surface.",
    active: false,
  },
  {
    name: "Interception",
    type: "Kernel",
    latency: "~0.5ms",
    pacing: "100ms+ recommended",
    desc: "Kernel-level driver intercepts and re-injects keystrokes. Lower latency, requires driver install.",
    active: true,
  },
  {
    name: "Teensy",
    type: "Hardware",
    latency: "~3ms",
    pacing: "20ms+ achievable",
    desc: "USB HID device sends keystrokes at the hardware level. Indistinguishable from a real keyboard.",
    active: false,
  },
];

function BackendComparison() {
  return (
    <div className="rounded-xl bg-zinc-900 p-5">
      <h3 className="mb-3 text-sm font-semibold text-zinc-100">
        Backend Comparison
      </h3>
      <div className="grid grid-cols-3 gap-3">
        {BACKENDS.map((b) => (
          <div
            key={b.name}
            className={`rounded-lg bg-zinc-950/60 p-4 ${
              b.active ? "border-l-2 border-emerald-500" : ""
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-zinc-100">{b.name}</span>
              {b.active && (
                <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[9px] font-bold text-emerald-400">
                  ACTIVE
                </span>
              )}
            </div>
            <div className="mt-2 space-y-1 text-[10px]">
              <div className="flex justify-between">
                <span className="text-zinc-500">Type</span>
                <span className="text-zinc-300 font-medium">{b.type}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Latency</span>
                <span className="text-cyan-400 font-mono">{b.latency}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Pacing</span>
                <span className="text-zinc-300 font-mono">{b.pacing}</span>
              </div>
            </div>
            <p className="mt-2 text-[10px] leading-relaxed text-zinc-500">
              {b.desc}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Section 4 — Concurrent Execution Monitor
// ═══════════════════════════════════════════════════════════════════
interface RunningSeq {
  id: number;
  label: string;
  progress: number; // 0..1
  color: string;
  stepsText: string;
}

const MOCK_RUNNING: RunningSeq[] = [
  {
    id: 1,
    label: "Key A → Ctrl+C",
    progress: 0.85,
    color: C.emerald,
    stepsText: "Step 3/3",
  },
  {
    id: 2,
    label: "Key S → Ctrl+S",
    progress: 0.45,
    color: C.emerald,
    stepsText: "Step 2/3",
  },
  {
    id: 3,
    label: "Key D → Ctrl+H",
    progress: 0.2,
    color: C.amber,
    stepsText: "Step 1/4 (buffering)",
  },
  {
    id: 4,
    label: "Key 1 → Ctrl+1",
    progress: 0.0,
    color: C.yellow,
    stepsText: "Queued (cooldown)",
  },
];

function ConcurrentMonitor() {
  const [seqs] = useState(MOCK_RUNNING);

  return (
    <div className="rounded-xl bg-zinc-900 p-5">
      <div className="mb-3 flex items-center gap-3">
        <h3 className="text-sm font-semibold text-zinc-100">
          Concurrent Execution
        </h3>
        <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] font-medium text-zinc-400">
          {seqs.length} active
        </span>
      </div>

      <div className="space-y-2">
        {seqs.map((s) => (
          <div key={s.id} className="flex items-center gap-3">
            <span className="w-32 shrink-0 truncate text-xs font-mono text-zinc-300">
              {s.label}
            </span>
            <div className="flex-1 h-4 rounded-full bg-zinc-800 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${Math.max(s.progress * 100, 2)}%`,
                  backgroundColor: s.color,
                  opacity: 0.75,
                }}
              />
            </div>
            <span className="w-28 shrink-0 text-right text-[10px] text-zinc-500">
              {s.stepsText}
            </span>
            <span className="w-10 text-right text-[10px] font-mono text-zinc-400">
              {Math.round(s.progress * 100)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Page export
// ═══════════════════════════════════════════════════════════════════
export function ExecutionPipeline() {
  return (
    <div>
      <PageHeader
        title="Execution Pipeline"
        description="Gesture-to-keystroke flow visualization and backend comparison"
      />
      <div className="space-y-5">
        <AnimatedPipeline />
        <ExecutionLog />
        <BackendComparison />
        <ConcurrentMonitor />
      </div>
    </div>
  );
}
