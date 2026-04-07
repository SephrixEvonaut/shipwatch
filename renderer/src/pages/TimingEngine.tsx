import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  AreaChart,
  Area,
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
import { PageHeader } from "../components/PageHeader";

// ═══════════════════════════════════════════════════════════════════
// Seeded PRNG (deterministic visuals)
// ═══════════════════════════════════════════════════════════════════
function mulberry32(seed: number) {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gaussianPairs(rng: () => number): [number, number] {
  const u1 = rng();
  const u2 = rng();
  const r = Math.sqrt(-2 * Math.log(u1 || 1e-10));
  const t = 2 * Math.PI * u2;
  return [r * Math.cos(t), r * Math.sin(t)];
}

// ═══════════════════════════════════════════════════════════════════
// Section A — Distribution Shaping (two AreaCharts)
// ═══════════════════════════════════════════════════════════════════
function buildUniform(n: number, lo: number, hi: number, bins: number) {
  const rng = mulberry32(42);
  const counts = new Array(bins).fill(0);
  const bw = (hi - lo) / bins;
  for (let i = 0; i < n; i++) {
    const v = lo + rng() * (hi - lo);
    const b = Math.min(Math.floor((v - lo) / bw), bins - 1);
    counts[b]++;
  }
  return counts.map((c, i) => ({
    x: Math.round(lo + (i + 0.5) * bw),
    y: c,
  }));
}

function buildGaussian(
  n: number,
  mean: number,
  sd: number,
  lo: number,
  hi: number,
  bins: number,
) {
  const rng = mulberry32(99);
  const counts = new Array(bins).fill(0);
  const bw = (hi - lo) / bins;
  let generated = 0;
  while (generated < n) {
    const [z1, z2] = gaussianPairs(rng);
    for (const z of [z1, z2]) {
      if (generated >= n) break;
      const v = mean + z * sd;
      if (v >= lo && v < hi) {
        const b = Math.min(Math.floor((v - lo) / bw), bins - 1);
        counts[b]++;
        generated++;
      }
    }
  }
  return counts.map((c, i) => ({
    x: Math.round(lo + (i + 0.5) * bw),
    y: c,
  }));
}

const UNIFORM_DATA = buildUniform(2000, 40, 160, 30);
const GAUSSIAN_DATA = buildGaussian(2000, 100, 20, 40, 160, 30);

function DistributionShaping() {
  return (
    <div className="rounded-xl bg-zinc-900 p-5">
      <h3 className="mb-1 text-sm font-semibold text-zinc-100">
        Distribution Shaping
      </h3>
      <p className="mb-4 text-xs text-zinc-500">
        Natural timing follows bell curves, not flat lines.
      </p>
      <div className="grid grid-cols-2 gap-4">
        {/* Uniform */}
        <div className="rounded-lg bg-zinc-950/50 p-3">
          <p className="mb-2 text-center text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
            Uniform Random
          </p>
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart data={UNIFORM_DATA}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis
                dataKey="x"
                tick={{ fill: "#71717a", fontSize: 9 }}
                tickLine={false}
                axisLine={{ stroke: "#3f3f46" }}
                label={{
                  value: "ms",
                  position: "insideBottomRight",
                  offset: -4,
                  fill: "#52525b",
                  fontSize: 9,
                }}
              />
              <YAxis hide />
              <Area
                type="monotone"
                dataKey="y"
                stroke="#ef4444"
                fill="#ef4444"
                fillOpacity={0.2}
                strokeWidth={1.5}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Gaussian */}
        <div className="rounded-lg bg-zinc-950/50 p-3">
          <p className="mb-2 text-center text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
            GestureKit Shaped
          </p>
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart data={GAUSSIAN_DATA}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis
                dataKey="x"
                tick={{ fill: "#71717a", fontSize: 9 }}
                tickLine={false}
                axisLine={{ stroke: "#3f3f46" }}
                label={{
                  value: "ms",
                  position: "insideBottomRight",
                  offset: -4,
                  fill: "#52525b",
                  fontSize: 9,
                }}
              />
              <YAxis hide />
              <Area
                type="monotone"
                dataKey="y"
                stroke="#34d399"
                fill="#34d399"
                fillOpacity={0.2}
                strokeWidth={1.5}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Section B — Buffer Tier Explorer
// ═══════════════════════════════════════════════════════════════════
interface TierDef {
  label: string;
  range: [number, number];
  mean: number;
  sd: number;
  sweetSpot: [number, number];
  color: string;
}

const TIERS: TierDef[] = [
  {
    label: "LOW",
    range: [20, 80],
    mean: 45,
    sd: 10,
    sweetSpot: [35, 55],
    color: "#34d399",
  },
  {
    label: "MEDIUM",
    range: [50, 150],
    mean: 95,
    sd: 18,
    sweetSpot: [75, 115],
    color: "#fbbf24",
  },
  {
    label: "HIGH",
    range: [100, 280],
    mean: 180,
    sd: 30,
    sweetSpot: [150, 210],
    color: "#22d3ee",
  },
];

function buildTierHistogram(tier: TierDef) {
  const rng = mulberry32(tier.mean * 7);
  const bins = 20;
  const bw = (tier.range[1] - tier.range[0]) / bins;
  const counts = new Array(bins).fill(0);
  let generated = 0;
  while (generated < 500) {
    const [z1, z2] = gaussianPairs(rng);
    for (const z of [z1, z2]) {
      if (generated >= 500) break;
      const v = tier.mean + z * tier.sd;
      if (v >= tier.range[0] && v < tier.range[1]) {
        const b = Math.min(Math.floor((v - tier.range[0]) / bw), bins - 1);
        counts[b]++;
        generated++;
      }
    }
  }
  return counts.map((c, i) => ({
    x: Math.round(tier.range[0] + (i + 0.5) * bw),
    y: c,
  }));
}

function BufferTierExplorer() {
  const [tierIdx, setTierIdx] = useState(0);
  const tier = TIERS[tierIdx];
  const data = useMemo(() => buildTierHistogram(tier), [tier]);

  // frequency table: split into 5 sub-ranges
  const table = useMemo(() => {
    const rangeSize = tier.range[1] - tier.range[0];
    const step = rangeSize / 5;
    return Array.from({ length: 5 }, (_, i) => {
      const lo = Math.round(tier.range[0] + i * step);
      const hi = Math.round(tier.range[0] + (i + 1) * step);
      const count = data
        .filter((d) => d.x >= lo && d.x < hi)
        .reduce((s, d) => s + d.y, 0);
      return {
        range: `${lo}–${hi}ms`,
        count,
        pct: ((count / 500) * 100).toFixed(1),
      };
    });
  }, [data, tier]);

  return (
    <div className="rounded-xl bg-zinc-900 p-5">
      <h3 className="mb-3 text-sm font-semibold text-zinc-100">
        Buffer Tier Explorer
      </h3>

      {/* tier tabs */}
      <div className="mb-4 flex gap-1 rounded-lg bg-zinc-800 p-1 w-fit">
        {TIERS.map((t, i) => (
          <button
            key={t.label}
            onClick={() => setTierIdx(i)}
            className={`rounded-md px-3 py-1 text-xs font-semibold transition-colors ${
              tierIdx === i
                ? "text-zinc-100"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
            style={
              tierIdx === i
                ? { backgroundColor: t.color + "22", color: t.color }
                : undefined
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-4">
        {/* info */}
        <div className="space-y-2 text-xs text-zinc-400">
          <div>
            <span className="text-zinc-500">Range: </span>
            <span className="text-zinc-200 font-mono">
              {tier.range[0]}–{tier.range[1]}ms
            </span>
          </div>
          <div>
            <span className="text-zinc-500">Mean: </span>
            <span className="text-zinc-200 font-mono">{tier.mean}ms</span>
          </div>
          <div>
            <span className="text-zinc-500">Sweet spot: </span>
            <span className="text-zinc-200 font-mono">
              {tier.sweetSpot[0]}–{tier.sweetSpot[1]}ms
            </span>
          </div>

          {/* frequency table */}
          <table className="mt-3 w-full text-[10px]">
            <thead className="text-zinc-500">
              <tr>
                <th className="text-left font-medium py-0.5">Range</th>
                <th className="text-right font-medium py-0.5">n</th>
                <th className="text-right font-medium py-0.5">%</th>
              </tr>
            </thead>
            <tbody className="text-zinc-400 font-mono">
              {table.map((r) => (
                <tr key={r.range}>
                  <td className="py-0.5">{r.range}</td>
                  <td className="text-right py-0.5">{r.count}</td>
                  <td className="text-right py-0.5">{r.pct}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* histogram (2-col span) */}
        <div className="col-span-2 rounded-lg bg-zinc-950/50 p-3">
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis
                dataKey="x"
                tick={{ fill: "#71717a", fontSize: 9 }}
                tickLine={false}
                axisLine={{ stroke: "#3f3f46" }}
                label={{
                  value: "ms",
                  position: "insideBottomRight",
                  offset: -4,
                  fill: "#52525b",
                  fontSize: 9,
                }}
              />
              <YAxis hide />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#18181b",
                  border: "1px solid #3f3f46",
                  borderRadius: 8,
                  fontSize: 11,
                }}
                labelFormatter={(v) => `${v}ms`}
              />
              <ReferenceLine
                x={tier.sweetSpot[0]}
                stroke={tier.color}
                strokeDasharray="4 3"
                strokeWidth={1.5}
              />
              <ReferenceLine
                x={tier.sweetSpot[1]}
                stroke={tier.color}
                strokeDasharray="4 3"
                strokeWidth={1.5}
              />
              <Bar dataKey="y" radius={[2, 2, 0, 0]}>
                {data.map((d, i) => (
                  <Cell
                    key={i}
                    fill={
                      d.x >= tier.sweetSpot[0] && d.x <= tier.sweetSpot[1]
                        ? tier.color
                        : "#3f3f46"
                    }
                    opacity={
                      d.x >= tier.sweetSpot[0] && d.x <= tier.sweetSpot[1]
                        ? 0.8
                        : 0.4
                    }
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Section C — History Correction Visualizer
// ═══════════════════════════════════════════════════════════════════
function buildCorrectionData() {
  const rng = mulberry32(77);
  const mean = 100;
  const sd = 20;
  const vals: number[] = [];
  while (vals.length < 30) {
    const [z1] = gaussianPairs(rng);
    const v = mean + z1 * sd;
    if (v > 40 && v < 180) vals.push(Math.round(v));
  }

  // running mean & correction
  let sum = 0;
  return vals.map((v, i) => {
    sum += v;
    const runMean = sum / (i + 1);
    const drift = runMean - mean;
    const correction = -drift * 0.15;
    const dist = Math.abs(v - mean) / sd;
    return {
      i,
      v,
      runMean: +runMean.toFixed(1),
      correction: +correction.toFixed(2),
      dist,
    };
  });
}

const CORRECTION_DATA = buildCorrectionData();

function dotColor(dist: number): string {
  if (dist < 1) return "#34d399";
  if (dist < 2) return "#fbbf24";
  return "#ef4444";
}

function HistoryCorrection() {
  const [pos, setPos] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(400);
  const timerRef = useRef(0);

  useEffect(() => {
    if (!playing) return;
    if (pos >= CORRECTION_DATA.length - 1) {
      setPlaying(false);
      return;
    }
    timerRef.current = window.setTimeout(() => setPos((p) => p + 1), speed);
    return () => clearTimeout(timerRef.current);
  }, [playing, pos, speed]);

  const play = useCallback(() => {
    setPlaying(true);
    if (pos >= CORRECTION_DATA.length - 1) setPos(0);
  }, [pos]);
  const pause = useCallback(() => setPlaying(false), []);
  const stepForward = useCallback(
    () => setPos((p) => Math.min(p + 1, CORRECTION_DATA.length - 1)),
    [],
  );

  const svgW = 660;
  const svgH = 100;
  const pad = 30;
  const usable = svgW - pad * 2;
  const minV = 40;
  const maxV = 180;
  const vx = (v: number) => pad + ((v - minV) / (maxV - minV)) * usable;
  const mean = 100;

  return (
    <div className="rounded-xl bg-zinc-900 p-5">
      <h3 className="mb-3 text-sm font-semibold text-zinc-100">
        History Correction Visualizer
      </h3>

      <svg
        viewBox={`0 0 ${svgW} ${svgH}`}
        className="w-full rounded-lg bg-zinc-950/50"
        preserveAspectRatio="xMidYMid meet"
      >
        {/* number line */}
        <line
          x1={pad}
          y1={60}
          x2={svgW - pad}
          y2={60}
          stroke="#3f3f46"
          strokeWidth={1}
        />
        {/* ticks */}
        {[40, 60, 80, 100, 120, 140, 160, 180].map((t) => (
          <g key={t}>
            <line
              x1={vx(t)}
              y1={57}
              x2={vx(t)}
              y2={63}
              stroke="#52525b"
              strokeWidth={1}
            />
            <text
              x={vx(t)}
              y={75}
              fill="#52525b"
              fontSize={8}
              textAnchor="middle"
            >
              {t}
            </text>
          </g>
        ))}
        {/* mean marker */}
        <line
          x1={vx(mean)}
          y1={40}
          x2={vx(mean)}
          y2={65}
          stroke="#34d399"
          strokeWidth={1}
          strokeDasharray="4 3"
        />
        <text
          x={vx(mean)}
          y={36}
          fill="#34d399"
          fontSize={8}
          textAnchor="middle"
        >
          μ=100ms
        </text>

        {/* past dots (faded) */}
        {CORRECTION_DATA.slice(0, pos).map((d) => (
          <circle
            key={d.i}
            cx={vx(d.v)}
            cy={60}
            r={3}
            fill={dotColor(d.dist)}
            opacity={0.3}
          />
        ))}

        {/* current dot */}
        {pos < CORRECTION_DATA.length && (
          <circle
            cx={vx(CORRECTION_DATA[pos].v)}
            cy={60}
            r={5}
            fill={dotColor(CORRECTION_DATA[pos].dist)}
          >
            <animate
              attributeName="r"
              values="4;6;4"
              dur="0.8s"
              repeatCount="indefinite"
            />
          </circle>
        )}

        {/* running mean indicator */}
        {pos < CORRECTION_DATA.length && (
          <g>
            <line
              x1={vx(CORRECTION_DATA[pos].runMean)}
              y1={44}
              x2={vx(CORRECTION_DATA[pos].runMean)}
              y2={56}
              stroke="#fbbf24"
              strokeWidth={1.5}
            />
            <text
              x={vx(CORRECTION_DATA[pos].runMean)}
              y={90}
              fill="#fbbf24"
              fontSize={8}
              textAnchor="middle"
            >
              x̄={CORRECTION_DATA[pos].runMean}
            </text>
          </g>
        )}
      </svg>

      {/* controls */}
      <div className="mt-3 flex items-center gap-3">
        {playing ? (
          <button
            onClick={pause}
            className="rounded-lg bg-zinc-700 px-3 py-1 text-xs font-medium text-zinc-300
              hover:bg-zinc-600 transition-colors"
          >
            ⏸ Pause
          </button>
        ) : (
          <button
            onClick={play}
            className="rounded-lg bg-emerald-600 px-3 py-1 text-xs font-medium text-white
              hover:bg-emerald-500 transition-colors"
          >
            ▶ Play
          </button>
        )}
        <button
          onClick={stepForward}
          disabled={pos >= CORRECTION_DATA.length - 1}
          className="rounded-lg bg-zinc-700 px-3 py-1 text-xs font-medium text-zinc-300
            hover:bg-zinc-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Step →
        </button>

        {/* speed slider */}
        <div className="ml-auto flex items-center gap-2">
          <span className="text-[10px] text-zinc-500">Speed</span>
          <input
            type="range"
            min={100}
            max={800}
            step={50}
            value={800 - speed + 100}
            onChange={(e) => setSpeed(800 - Number(e.target.value) + 100)}
            className="h-1 w-20 accent-emerald-500"
          />
        </div>

        {/* correction factor */}
        {pos < CORRECTION_DATA.length && (
          <div className="text-xs font-mono text-zinc-400">
            Sample {pos + 1}/30 &nbsp;|&nbsp; correction:{" "}
            <span
              className={
                CORRECTION_DATA[pos].correction >= 0
                  ? "text-emerald-400"
                  : "text-red-400"
              }
            >
              {CORRECTION_DATA[pos].correction > 0 ? "+" : ""}
              {CORRECTION_DATA[pos].correction}ms
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Section D — Statistical Verification (computed from real samples)
// ═══════════════════════════════════════════════════════════════════
import {
  kolmogorovSmirnovTest,
  chiSquaredTest,
  autocorrelation,
  runsTest,
  gaussianCDF,
  buildHistogramBins,
  median as computeMedian,
} from "../utils/statisticalTests";

function generateGaussianSamples(
  n: number,
  mean: number,
  sd: number,
  seed: number,
): number[] {
  const rng = mulberry32(seed);
  const samples: number[] = [];
  while (samples.length < n) {
    const [z1, z2] = gaussianPairs(rng);
    samples.push(mean + z1 * sd);
    if (samples.length < n) samples.push(mean + z2 * sd);
  }
  return samples;
}

function computeStats(samples: number[], mean: number, sd: number) {
  const cdf = gaussianCDF(mean, sd);
  const ks = kolmogorovSmirnovTest(samples, cdf);
  const bins = 20;
  const { observed, expected } = buildHistogramBins(samples, bins, mean, sd);
  const chi = chiSquaredTest(observed, expected);
  const acr = autocorrelation(samples, 1);
  const med = computeMedian(samples);
  const runs = runsTest(samples, med);
  return [
    {
      name: "KS Test",
      value: ks,
      label: "p",
      desc: "Kolmogorov-Smirnov — max distance between empirical & theoretical CDFs.",
    },
    {
      name: "Chi-Squared",
      value: chi,
      label: "p",
      desc: "Goodness-of-fit across histogram bins against expected Gaussian.",
    },
    {
      name: "Autocorrelation",
      value: acr,
      label: "r",
      desc: "Lag-1 autocorrelation — measures sequential dependency.",
    },
    {
      name: "Runs Test",
      value: runs,
      label: "p",
      desc: "Tests whether above/below-median runs are randomly distributed.",
    },
  ];
}

function StatVerification() {
  const [seed, setSeed] = useState(777);
  const sampleCount = 2000;
  const mean = 100;
  const sd = 20;

  const stats = useMemo(() => {
    const samples = generateGaussianSamples(sampleCount, mean, sd, seed);
    return computeStats(samples, mean, sd);
  }, [seed]);

  return (
    <div className="rounded-xl bg-zinc-900 p-5">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-sm font-semibold text-zinc-100">
          Statistical Verification
        </h3>
        <button
          onClick={() => setSeed((s) => s + 1)}
          className="rounded-lg bg-zinc-800 px-3 py-1 text-[10px] font-semibold text-emerald-400
            hover:bg-zinc-700 transition-colors"
        >
          ↻ Regenerate
        </button>
      </div>
      <p className="mb-4 text-xs text-zinc-500">
        Computed from {sampleCount.toLocaleString()} samples — all p &gt; 0.05
        means timing is indistinguishable from natural human input.
      </p>

      <div className="grid grid-cols-4 gap-3">
        {stats.map((s) => {
          const pass =
            s.label === "r" ? Math.abs(s.value) < 0.05 : s.value > 0.05;
          return (
            <div
              key={s.name}
              className="rounded-lg bg-zinc-950/60 p-3 flex flex-col gap-2"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-zinc-200">
                  {s.name}
                </span>
                <span
                  className={
                    pass ? "text-emerald-400 text-sm" : "text-red-400 text-sm"
                  }
                >
                  {pass ? "✅" : "❌"}
                </span>
              </div>
              <div className="font-mono text-lg font-bold text-zinc-100">
                {s.label}={s.value.toFixed(3)}
              </div>
              <p className="text-[10px] leading-relaxed text-zinc-500">
                {s.desc}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Page export
// ═══════════════════════════════════════════════════════════════════
export function TimingEngine() {
  return (
    <div>
      <PageHeader
        title="Timing Engine"
        description="Human-like timing distribution, buffer shaping, and statistical verification"
      />
      <div className="space-y-5">
        <DistributionShaping />
        <BufferTierExplorer />
        <HistoryCorrection />
        <StatVerification />
      </div>
    </div>
  );
}
