import { useState, useEffect, useRef, useCallback } from "react";
import { PageHeader } from "../components/PageHeader";

// ═══════════════════════════════════════════════════════════════════
// Palette & layout constants
// ═══════════════════════════════════════════════════════════════════
const C = {
  green: "#34d399",
  amber: "#fbbf24",
  blue: "#60a5fa",
  red: "#ef4444",
  zinc600: "#52525b",
  zinc700: "#3f3f46",
  zinc800: "#27272a",
  white: "#f4f4f5",
};

// ═══════════════════════════════════════════════════════════════════
// Section A — Explanation Card
// ═══════════════════════════════════════════════════════════════════
function ExplanationCard() {
  return (
    <div className="rounded-xl bg-zinc-900 p-5">
      <h3 className="mb-3 text-sm font-semibold text-zinc-100">
        How Conflict Resolution Works
      </h3>
      <div className="space-y-2 text-xs leading-relaxed text-zinc-400">
        <p>
          The Traffic Controller detects when two gestures target the same
          physical key and decides who passes. It is{" "}
          <span className="text-emerald-400 font-medium">modifier-aware</span>:
          a bare <kbd className="rounded bg-zinc-800 px-1 text-zinc-300">N</kbd>{" "}
          press and{" "}
          <kbd className="rounded bg-zinc-800 px-1 text-zinc-300">SHIFT+N</kbd>{" "}
          are treated as separate bindings with independent queues.
        </p>
        <p>Resolution rules, in priority order:</p>
        <ol className="ml-4 list-decimal space-y-1">
          <li>
            <span className="text-blue-400">Priority bypass</span> — flagged
            keys (e.g. interrupt abilities) skip the queue entirely.
          </li>
          <li>
            <span className="text-amber-400">Modifier check</span> — if a
            conflict key fires but the required modifier is not held, it passes
            through (smart bypass).
          </li>
          <li>
            <span className="text-amber-400">Queue &amp; wait</span> — when a
            true conflict is detected the later gesture is queued until the
            modifier is released.
          </li>
          <li>
            <span className="text-emerald-400">No-conflict fast path</span> —
            safe keys never enter the conflict pipeline.
          </li>
        </ol>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Section B — Conflict Map (node graph)
// ═══════════════════════════════════════════════════════════════════
const CONFLICT_KEYS = ["N", "J", "K", "L", "R"];
const MODIFIER_VARIANTS = ["SHIFT+N", "ALT+J", "SHIFT+K", "ALT+L", "CTRL+R"];
const SAFE_KEYS = ["M", "O", "V", "X", "Z", "Q"];

function ConflictMap() {
  const svgW = 700;
  const svgH = 340;
  const cx = svgW / 2;
  const cy = 140;

  // positions
  const conflictPts = CONFLICT_KEYS.map((_, i) => ({
    x: cx - 40 + i * 20,
    y: cy - 50 + i * 25,
  }));
  const rawPts = CONFLICT_KEYS.map((_, i) => ({
    x: 80,
    y: 60 + i * 55,
  }));
  const modPts = MODIFIER_VARIANTS.map((_, i) => ({
    x: svgW - 80,
    y: 60 + i * 55,
  }));
  const safeY = svgH - 40;

  return (
    <div className="rounded-xl bg-zinc-900 p-5">
      <h3 className="mb-3 text-sm font-semibold text-zinc-100">Conflict Map</h3>
      <svg
        viewBox={`0 0 ${svgW} ${svgH}`}
        className="w-full"
        preserveAspectRatio="xMidYMid meet"
      >
        {/* lines: raw → conflict (green) */}
        {rawPts.map((rp, i) => (
          <line
            key={`raw-${i}`}
            x1={rp.x + 20}
            y1={rp.y}
            x2={conflictPts[i].x - 20}
            y2={conflictPts[i].y}
            stroke={C.green}
            strokeWidth={1.5}
            opacity={0.5}
          />
        ))}
        {/* lines: conflict → modifier (amber) */}
        {modPts.map((mp, i) => (
          <line
            key={`mod-${i}`}
            x1={conflictPts[i].x + 20}
            y1={conflictPts[i].y}
            x2={mp.x - 30}
            y2={mp.y}
            stroke={C.amber}
            strokeWidth={1.5}
            opacity={0.5}
          />
        ))}

        {/* raw usage nodes (left) */}
        {rawPts.map((p, i) => (
          <g key={`rn-${i}`}>
            <rect
              x={p.x - 20}
              y={p.y - 12}
              width={40}
              height={24}
              rx={6}
              fill="#064e3b"
              stroke={C.green}
              strokeWidth={1}
            />
            <text
              x={p.x}
              y={p.y + 1}
              fill={C.green}
              fontSize={10}
              fontWeight={600}
              textAnchor="middle"
              dominantBaseline="middle"
            >
              {CONFLICT_KEYS[i]}
            </text>
          </g>
        ))}

        {/* conflict centre nodes */}
        {conflictPts.map((p, i) => (
          <g key={`cn-${i}`}>
            <circle
              cx={p.x}
              cy={p.y}
              r={18}
              fill="#422006"
              stroke={C.amber}
              strokeWidth={1.5}
            />
            <text
              x={p.x}
              y={p.y + 1}
              fill={C.amber}
              fontSize={10}
              fontWeight={700}
              textAnchor="middle"
              dominantBaseline="middle"
            >
              {CONFLICT_KEYS[i]}
            </text>
          </g>
        ))}

        {/* modifier variant nodes (right) */}
        {modPts.map((p, i) => (
          <g key={`mn-${i}`}>
            <rect
              x={p.x - 30}
              y={p.y - 12}
              width={60}
              height={24}
              rx={6}
              fill="#451a03"
              stroke={C.amber}
              strokeWidth={1}
            />
            <text
              x={p.x}
              y={p.y + 1}
              fill={C.amber}
              fontSize={9}
              fontWeight={600}
              textAnchor="middle"
              dominantBaseline="middle"
            >
              {MODIFIER_VARIANTS[i]}
            </text>
          </g>
        ))}

        {/* safe keys bottom row (green badges) */}
        {SAFE_KEYS.map((k, i) => {
          const sx = 120 + i * 80;
          return (
            <g key={`safe-${i}`}>
              <rect
                x={sx - 16}
                y={safeY - 10}
                width={32}
                height={20}
                rx={10}
                fill="#064e3b"
                stroke={C.green}
                strokeWidth={1}
              />
              <text
                x={sx}
                y={safeY + 1}
                fill={C.green}
                fontSize={9}
                fontWeight={600}
                textAnchor="middle"
                dominantBaseline="middle"
              >
                {k}
              </text>
            </g>
          );
        })}
        <text
          x={60}
          y={safeY + 1}
          fill={C.zinc600}
          fontSize={8}
          textAnchor="end"
          dominantBaseline="middle"
        >
          SAFE
        </text>

        {/* labels */}
        <text x={80} y={22} fill={C.zinc600} fontSize={9} textAnchor="middle">
          Raw Usage
        </text>
        <text x={cx} y={22} fill={C.zinc600} fontSize={9} textAnchor="middle">
          Conflict Keys
        </text>
        <text
          x={svgW - 80}
          y={22}
          fill={C.zinc600}
          fontSize={9}
          textAnchor="middle"
        >
          Modifier Variants
        </text>
      </svg>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Section C — Live Simulation (animated 4-step flow)
// ═══════════════════════════════════════════════════════════════════
interface SimStep {
  label: string;
  key: string;
  desc: string;
  path: "green" | "yellow" | "blue";
  durationMs: number;
  nodes: string[];
  waitIndex?: number; // node index where dot pauses
}

const SIM_STEPS: SimStep[] = [
  {
    label: "Step 1",
    key: "M",
    desc: "M fires → no conflict → passes immediately",
    path: "green",
    durationMs: 2000,
    nodes: ["M fires", "Conflict check", "No conflict", "PASS"],
  },
  {
    label: "Step 2",
    key: "N",
    desc: "N fires, SHIFT not held → smart bypass → passes",
    path: "green",
    durationMs: 2000,
    nodes: [
      "N fires",
      "Conflict check",
      "SHIFT not held",
      "Smart bypass",
      "PASS",
    ],
  },
  {
    label: "Step 3",
    key: "N+SHIFT",
    desc: "N fires, SHIFT held → queued → SHIFT released → passes",
    path: "yellow",
    durationMs: 3000,
    nodes: [
      "N fires",
      "Conflict check",
      "SHIFT held",
      "QUEUE",
      "SHIFT released",
      "PASS",
    ],
    waitIndex: 3,
  },
  {
    label: "Step 4",
    key: "R",
    desc: "R fires → priority bypass → passes immediately",
    path: "blue",
    durationMs: 2000,
    nodes: ["R fires", "Priority flag", "BYPASS", "PASS"],
  },
];

const PATH_COLORS: Record<string, string> = {
  green: C.green,
  yellow: C.amber,
  blue: C.blue,
};

function LiveSimulation() {
  const [stepIdx, setStepIdx] = useState(0);
  const [dotPos, setDotPos] = useState(0); // 0..nodeCount-1
  const [playing, setPlaying] = useState(true);
  const timerRef = useRef(0);

  const step = SIM_STEPS[stepIdx];
  const nodeCount = step.nodes.length;
  const dotColor = PATH_COLORS[step.path];

  // auto-advance dot position
  useEffect(() => {
    if (!playing) return;

    const perNode = step.durationMs / nodeCount;
    let current = 0;
    setDotPos(0);

    const advance = () => {
      current++;
      if (current >= nodeCount) {
        // move to next step after brief pause
        timerRef.current = window.setTimeout(() => {
          setStepIdx((s) => (s + 1) % SIM_STEPS.length);
        }, 400);
        return;
      }
      setDotPos(current);

      // extra pause at waitIndex
      const extra =
        step.waitIndex !== undefined && current === step.waitIndex ? 800 : 0;
      timerRef.current = window.setTimeout(advance, perNode + extra);
    };

    timerRef.current = window.setTimeout(advance, perNode);
    return () => clearTimeout(timerRef.current);
  }, [stepIdx, playing, step, nodeCount]);

  const restart = useCallback(() => {
    clearTimeout(timerRef.current);
    setStepIdx(0);
    setDotPos(0);
    setPlaying(true);
  }, []);

  const svgW = 650;
  const svgH = 80;
  const pad = 30;
  const gap = (svgW - pad * 2) / (nodeCount - 1);

  return (
    <div className="rounded-xl bg-zinc-900 p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-zinc-100">Live Simulation</h3>
        <button
          onClick={restart}
          className="rounded-lg bg-zinc-800 px-3 py-1 text-xs font-medium text-zinc-300
            hover:bg-zinc-700 transition-colors"
        >
          ▶ Restart
        </button>
      </div>

      {/* step label + description */}
      <div className="mb-3 flex items-center gap-3">
        <span
          className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase"
          style={{
            backgroundColor: dotColor + "22",
            color: dotColor,
          }}
        >
          {step.label}
        </span>
        <span className="text-xs text-zinc-400">{step.desc}</span>
      </div>

      <svg
        viewBox={`0 0 ${svgW} ${svgH}`}
        className="w-full"
        preserveAspectRatio="xMidYMid meet"
      >
        {/* connection lines */}
        {step.nodes.map((_, i) => {
          if (i === 0) return null;
          const x1 = pad + (i - 1) * gap;
          const x2 = pad + i * gap;
          return (
            <line
              key={i}
              x1={x1}
              y1={40}
              x2={x2}
              y2={40}
              stroke={i <= dotPos ? dotColor : C.zinc700}
              strokeWidth={2}
              opacity={i <= dotPos ? 0.7 : 0.3}
            />
          );
        })}

        {/* nodes */}
        {step.nodes.map((n, i) => {
          const nx = pad + i * gap;
          const lit = i <= dotPos;
          return (
            <g key={i}>
              <circle
                cx={nx}
                cy={40}
                r={14}
                fill={lit ? dotColor + "33" : C.zinc800}
                stroke={lit ? dotColor : C.zinc700}
                strokeWidth={1.5}
              />
              <text
                x={nx}
                y={66}
                fill={lit ? C.white : C.zinc600}
                fontSize={8}
                textAnchor="middle"
                fontWeight={500}
              >
                {n}
              </text>
            </g>
          );
        })}

        {/* animated dot */}
        <circle cx={pad + dotPos * gap} cy={40} r={5} fill={dotColor}>
          <animate
            attributeName="r"
            values="4;6;4"
            dur="0.6s"
            repeatCount="indefinite"
          />
        </circle>
      </svg>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Section D — Queue Monitor (mock event log)
// ═══════════════════════════════════════════════════════════════════
interface QueueEvent {
  id: number;
  ts: string;
  key: string;
  result: "pass" | "queued" | "bypass" | "blocked";
  detail: string;
}

const RESULT_STYLE: Record<string, string> = {
  pass: "text-emerald-400",
  queued: "text-amber-400",
  bypass: "text-blue-400",
  blocked: "text-red-400",
};

const MOCK_QUEUE: QueueEvent[] = [
  {
    id: 1,
    ts: "00:12.341",
    key: "M",
    result: "pass",
    detail: "No conflict — fast path",
  },
  {
    id: 2,
    ts: "00:12.588",
    key: "A",
    result: "pass",
    detail: "No conflict — fast path",
  },
  {
    id: 3,
    ts: "00:13.012",
    key: "N",
    result: "queued",
    detail: "SHIFT held — queued 48ms",
  },
  {
    id: 4,
    ts: "00:13.060",
    key: "N",
    result: "pass",
    detail: "SHIFT released — dequeued",
  },
  {
    id: 5,
    ts: "00:13.201",
    key: "R",
    result: "bypass",
    detail: "Priority key — instant bypass",
  },
  {
    id: 6,
    ts: "00:13.456",
    key: "J",
    result: "pass",
    detail: "ALT not held — smart bypass",
  },
  {
    id: 7,
    ts: "00:14.012",
    key: "K",
    result: "queued",
    detail: "SHIFT held — queued 112ms",
  },
  {
    id: 8,
    ts: "00:14.124",
    key: "K",
    result: "pass",
    detail: "SHIFT released — dequeued",
  },
  {
    id: 9,
    ts: "00:14.301",
    key: "O",
    result: "pass",
    detail: "No conflict — fast path",
  },
  {
    id: 10,
    ts: "00:14.589",
    key: "L",
    result: "queued",
    detail: "ALT held — queued 67ms",
  },
  {
    id: 11,
    ts: "00:14.656",
    key: "L",
    result: "pass",
    detail: "ALT released — dequeued",
  },
  {
    id: 12,
    ts: "00:15.010",
    key: "V",
    result: "pass",
    detail: "No conflict — fast path",
  },
  {
    id: 13,
    ts: "00:15.234",
    key: "R",
    result: "bypass",
    detail: "Priority key — instant bypass",
  },
  {
    id: 14,
    ts: "00:15.501",
    key: "N",
    result: "pass",
    detail: "SHIFT not held — smart bypass",
  },
  {
    id: 15,
    ts: "00:15.789",
    key: "Z",
    result: "pass",
    detail: "No conflict — fast path",
  },
];

function QueueMonitor() {
  return (
    <div className="rounded-xl bg-zinc-900 p-5">
      <h3 className="mb-3 text-sm font-semibold text-zinc-100">
        Queue Monitor
      </h3>
      <div className="max-h-64 overflow-y-auto rounded-lg bg-zinc-950/60 scrollbar-thin">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-zinc-900/95 text-zinc-500">
            <tr>
              <th className="px-3 py-1.5 text-left font-medium">Time</th>
              <th className="px-3 py-1.5 text-left font-medium">Key</th>
              <th className="px-3 py-1.5 text-left font-medium">Result</th>
              <th className="px-3 py-1.5 text-left font-medium">Detail</th>
            </tr>
          </thead>
          <tbody className="font-mono">
            {MOCK_QUEUE.map((e) => (
              <tr key={e.id} className="border-t border-zinc-800/50">
                <td className="px-3 py-1.5 text-zinc-500">{e.ts}</td>
                <td className="px-3 py-1.5 text-zinc-300 font-semibold">
                  {e.key}
                </td>
                <td
                  className={`px-3 py-1.5 font-semibold uppercase ${RESULT_STYLE[e.result]}`}
                >
                  {e.result}
                </td>
                <td className="px-3 py-1.5 text-zinc-400">{e.detail}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Page export
// ═══════════════════════════════════════════════════════════════════
export function TrafficController() {
  return (
    <div>
      <PageHeader
        title="Traffic Controller"
        description="Modifier-aware conflict resolution and queue management"
      />
      <div className="space-y-5">
        <ExplanationCard />
        <ConflictMap />
        <LiveSimulation />
        <QueueMonitor />
      </div>
    </div>
  );
}
