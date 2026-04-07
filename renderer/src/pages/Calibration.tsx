import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { PageHeader } from "../components/PageHeader";
import type {
  ProfileDef,
  KeyCalibration,
  CalibrationSampleEvent,
  GestureDefinition,
  CalibrationStep,
} from "../types";

// ═══════════════════════════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════════════════════════

// Master ordering for calibration steps (used to sort derived steps)
const STEP_ORDER: CalibrationStep[] = [
  "single_tap",
  "long_hold",
  "super_long_hold",
  "double_tap",
  "triple_tap",
  "quadruple_tap",
];

const STEP_LABELS: Record<string, string> = {
  single_tap: "Quick Tap",
  long_hold: "Long Hold",
  super_long_hold: "Super Long Hold",
  double_tap: "Double Tap",
  triple_tap: "Triple Tap",
  quadruple_tap: "Quadruple Tap",
};

const STEP_INSTRUCTIONS: Record<string, string> = {
  single_tap: "Tap the key quickly and release — like a normal keypress.",
  long_hold: "Hold the key for about half a second, then release.",
  super_long_hold: "Hold the key for about 1 second, then release.",
  double_tap: "Double-tap the key at your natural speed.",
  triple_tap: "Triple-tap the key at your natural speed.",
  quadruple_tap: "Quadruple-tap the key at your natural speed.",
};

const SAMPLES_PER_STEP = 7;

type Phase = "select" | "calibrating" | "results";

const api = (window as any).electronAPI;

// ═══════════════════════════════════════════════════════════════════
// Component
// ═══════════════════════════════════════════════════════════════════

export default function Calibration() {
  // ── Profile state ──────────────────────────────────────────────
  const [profiles, setProfiles] = useState<ProfileDef[]>([]);
  const [activeProfile, setActiveProfile] = useState<ProfileDef | null>(null);
  const [existingCal, setExistingCal] = useState<Record<
    string,
    KeyCalibration
  > | null>(null);
  const [gestureDefs, setGestureDefs] = useState<GestureDefinition[]>([]);

  // ── Derive calibration steps from enabled gesture definitions ──
  const activeSteps: CalibrationStep[] = useMemo(() => {
    const enabled = gestureDefs.filter((g) => g.enabled);
    const needed = new Set<CalibrationStep>();
    for (const g of enabled) {
      for (const s of g.calibrationSteps) needed.add(s as CalibrationStep);
    }
    // Return in canonical order
    return STEP_ORDER.filter((s) => needed.has(s));
  }, [gestureDefs]);

  // ── Wizard state ───────────────────────────────────────────────
  const [phase, setPhase] = useState<Phase>("select");
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [currentKeyIdx, setCurrentKeyIdx] = useState(0);
  const [currentStepIdx, setCurrentStepIdx] = useState(0);
  const [collecting, setCollecting] = useState(false);
  const [liveSamples, setLiveSamples] = useState<number[]>([]);
  const [stepResults, setStepResults] = useState<
    Record<string, { mean: number; stdDev: number; min: number; max: number }>
  >({});

  // ── Results state ──────────────────────────────────────────────
  const [results, setResults] = useState<Record<string, KeyCalibration>>({});
  const [saving, setSaving] = useState(false);

  const cancelledRef = useRef(false);

  // ── Load profiles + gesture definitions on mount ───────────────
  useEffect(() => {
    if (!api?.listGuiProfiles) return;
    api.listGuiProfiles().then((p: ProfileDef[]) => {
      setProfiles(p);
      const active = p.find((pr: ProfileDef) => pr.active) ?? p[0] ?? null;
      setActiveProfile(active);
    });
    api
      .getProfileCalibration?.()
      .then((cal: Record<string, KeyCalibration> | null) => {
        setExistingCal(cal);
      });
    if (api?.listGestureDefinitions) {
      api.listGestureDefinitions().then((defs: GestureDefinition[]) =>
        setGestureDefs(defs),
      );
    }
  }, []);

  // ── Listen for live sample events ─────────────────────────────
  useEffect(() => {
    if (!api?.onCalibrationSample) return;
    const handler = (data: CalibrationSampleEvent) => {
      setLiveSamples((prev) => [...prev, data.value]);
    };
    const unsub = api.onCalibrationSample(handler);
    return () => unsub?.();
  }, []);

  // ── Key selection ─────────────────────────────────────────────
  const inputKeys = activeProfile?.inputKeys ?? [];

  const toggleKey = (k: string) => {
    setSelectedKeys((prev) =>
      prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k],
    );
  };
  const selectAll = () => setSelectedKeys([...inputKeys]);
  const selectNone = () => setSelectedKeys([]);

  // ── Start calibration ─────────────────────────────────────────
  const startCalibration = useCallback(async () => {
    if (!activeProfile || selectedKeys.length === 0) return;
    cancelledRef.current = false;
    setPhase("calibrating");
    setCurrentKeyIdx(0);
    setCurrentStepIdx(0);
    setResults({});
    setStepResults({});

    await api.calibrationSessionStart(selectedKeys, activeProfile.id);

    // Walk through each key → each step
    const allResults: Record<string, KeyCalibration> = {};

    for (let ki = 0; ki < selectedKeys.length; ki++) {
      if (cancelledRef.current) break;
      const key = selectedKeys[ki];
      setCurrentKeyIdx(ki);

      for (let si = 0; si < activeSteps.length; si++) {
        if (cancelledRef.current) break;
        const step = activeSteps[si];
        setCurrentStepIdx(si);
        setLiveSamples([]);
        setCollecting(true);

        const result = await api.calibrationCollect(
          key,
          step,
          SAMPLES_PER_STEP,
        );

        setCollecting(false);
        setStepResults((prev) => ({
          ...prev,
          [`${key}:${step}`]: result.stats,
        }));
      }

      // Analyze after all steps for this key
      if (!cancelledRef.current) {
        const cal = await api.calibrationAnalyze(key);
        if (cal) {
          allResults[key] = cal;
          setResults((prev) => ({ ...prev, [key]: cal }));
        }
      }
    }

    if (!cancelledRef.current) {
      setPhase("results");
    }
  }, [activeProfile, selectedKeys, activeSteps]);

  // ── Cancel ────────────────────────────────────────────────────
  const cancelCalibration = useCallback(async () => {
    cancelledRef.current = true;
    setCollecting(false);
    setPhase("select");
    await api.calibrationStop?.();
  }, []);

  // ── Save results ──────────────────────────────────────────────
  const saveResults = useCallback(async () => {
    if (!activeProfile || Object.keys(results).length === 0) return;
    setSaving(true);
    await api.calibrationSave(activeProfile.id, results);
    setSaving(false);
    setExistingCal((prev) => ({ ...(prev ?? {}), ...results }));
    setPhase("select");
  }, [activeProfile, results]);

  // ═══════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════

  const currentKey = selectedKeys[currentKeyIdx];
  const currentStep = activeSteps[currentStepIdx];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Calibration"
        subtitle={
          activeProfile ? `Profile: ${activeProfile.name}` : "No active profile"
        }
      />

      {!activeProfile && (
        <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-4 text-yellow-300">
          Create and activate a profile in the Profiles tab first.
        </div>
      )}

      {activeProfile && activeSteps.length === 0 && (
        <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-4 text-yellow-300">
          No gestures are enabled. Go to the Gestures tab and enable at least one gesture to calibrate.
        </div>
      )}

      {/* ── SELECT PHASE ──────────────────────────────────────── */}
      {phase === "select" && activeProfile && (
        <div className="space-y-4">
          {/* Existing calibration summary */}
          {existingCal && Object.keys(existingCal).length > 0 && (
            <div className="rounded-lg border border-zinc-700 bg-zinc-800/60 p-4">
              <h3 className="text-sm font-medium text-zinc-300 mb-2">
                Existing Calibration
              </h3>
              <div className="flex flex-wrap gap-2">
                {Object.entries(existingCal).map(([key, cal]) => (
                  <div
                    key={key}
                    className="flex items-center gap-1.5 rounded bg-zinc-700/50 px-2 py-1 text-xs"
                  >
                    <span className="font-mono font-bold text-zinc-200">
                      {key}
                    </span>
                    <span
                      className={
                        cal.confidence >= 80
                          ? "text-emerald-400"
                          : cal.confidence >= 60
                            ? "text-yellow-400"
                            : "text-red-400"
                      }
                    >
                      {cal.confidence}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Key selection */}
          <div className="rounded-lg border border-zinc-700 bg-zinc-800/60 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-zinc-300">
                Select keys to calibrate
              </h3>
              <div className="flex gap-2">
                <button
                  onClick={selectAll}
                  className="text-xs text-blue-400 hover:text-blue-300"
                >
                  Select all
                </button>
                <button
                  onClick={selectNone}
                  className="text-xs text-zinc-500 hover:text-zinc-400"
                >
                  Clear
                </button>
              </div>
            </div>

            {inputKeys.length === 0 ? (
              <p className="text-sm text-zinc-500">
                No input keys defined in this profile. Add input keys in the
                Profiles tab.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {inputKeys.map((k) => {
                  const selected = selectedKeys.includes(k);
                  const hasCal = !!existingCal?.[k];
                  return (
                    <button
                      key={k}
                      onClick={() => toggleKey(k)}
                      className={`
                        relative rounded px-3 py-2 font-mono text-sm font-bold transition
                        ${
                          selected
                            ? "bg-blue-600 text-white ring-2 ring-blue-400"
                            : "bg-zinc-700 text-zinc-300 hover:bg-zinc-600"
                        }
                      `}
                    >
                      {k}
                      {hasCal && (
                        <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-emerald-400" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Start button */}
          <button
            onClick={startCalibration}
            disabled={selectedKeys.length === 0}
            className={`
              w-full rounded-lg px-4 py-3 text-sm font-semibold transition
              ${
                selectedKeys.length > 0
                  ? "bg-blue-600 text-white hover:bg-blue-500"
                  : "bg-zinc-700 text-zinc-500 cursor-not-allowed"
              }
            `}
          >
            Calibrate {selectedKeys.length} key
            {selectedKeys.length !== 1 ? "s" : ""} (
            {selectedKeys.length * activeSteps.length * SAMPLES_PER_STEP} samples)
          </button>

          {/* How it works */}
          <div className="rounded-lg border border-zinc-700 bg-zinc-800/40 p-4 text-xs text-zinc-500 space-y-1">
            <p className="font-medium text-zinc-400">How it works</p>
            <p>
              For each key you'll perform {activeSteps.length} calibration steps
              based on your enabled gestures.
            </p>
            <p>
              The system measures your natural timing and calculates per-key
              thresholds so gesture detection matches your personal style.
            </p>
          </div>
        </div>
      )}

      {/* ── CALIBRATING PHASE ─────────────────────────────────── */}
      {phase === "calibrating" && (
        <div className="space-y-4">
          {/* Progress header */}
          <div className="rounded-lg border border-blue-500/30 bg-blue-500/10 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-blue-300">
                Key {currentKeyIdx + 1} of {selectedKeys.length}:{" "}
                <span className="font-mono font-bold text-white text-lg">
                  {currentKey}
                </span>
              </span>
              <button
                onClick={cancelCalibration}
                className="text-xs text-red-400 hover:text-red-300"
              >
                Cancel
              </button>
            </div>

            {/* Key progress bar */}
            <div className="h-1.5 rounded-full bg-zinc-700 mb-3">
              <div
                className="h-full rounded-full bg-blue-500 transition-all"
                style={{
                  width: `${((currentKeyIdx * activeSteps.length + currentStepIdx) / (selectedKeys.length * activeSteps.length)) * 100}%`,
                }}
              />
            </div>

            {/* Step info */}
            <div className="mb-2">
              <div className="text-xs text-zinc-400 mb-1">
                Step {currentStepIdx + 1}/{activeSteps.length}
              </div>
              <div className="text-sm font-semibold text-white">
                {STEP_LABELS[currentStep]}
              </div>
              <div className="text-xs text-zinc-400 mt-1">
                {STEP_INSTRUCTIONS[currentStep]}
              </div>
            </div>

            {/* Sample progress */}
            {collecting && (
              <div className="mt-3">
                <div className="flex items-center justify-between text-xs text-zinc-400 mb-1">
                  <span>Samples collected</span>
                  <span>
                    {liveSamples.length} / {SAMPLES_PER_STEP}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-zinc-700">
                  <div
                    className="h-full rounded-full bg-emerald-500 transition-all"
                    style={{
                      width: `${(liveSamples.length / SAMPLES_PER_STEP) * 100}%`,
                    }}
                  />
                </div>

                {/* Live sample chips */}
                <div className="flex flex-wrap gap-1 mt-2">
                  {liveSamples.map((v, i) => (
                    <span
                      key={i}
                      className="rounded bg-zinc-700 px-1.5 py-0.5 text-xs font-mono text-emerald-400"
                    >
                      {v}ms
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Completed step results for current key */}
          {Object.entries(stepResults)
            .filter(([k]) => k.startsWith(`${currentKey}:`))
            .map(([k, stats]) => {
              const stepName = k.split(":")[1];
              return (
                <div
                  key={k}
                  className="flex items-center justify-between rounded bg-zinc-800/60 px-3 py-2 text-xs border border-zinc-700/50"
                >
                  <span className="text-zinc-400">{STEP_LABELS[stepName]}</span>
                  <span className="font-mono text-zinc-300">
                    avg {stats.mean}ms · σ {stats.stdDev}ms · [{stats.min}–
                    {stats.max}]
                  </span>
                </div>
              );
            })}

          {/* All step indicator */}
          <div className="flex gap-1">
            {activeSteps.map((s, i) => (
              <div
                key={s}
                className={`h-1 flex-1 rounded-full ${
                  i < currentStepIdx
                    ? "bg-emerald-500"
                    : i === currentStepIdx
                      ? "bg-blue-500"
                      : "bg-zinc-700"
                }`}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── RESULTS PHASE ─────────────────────────────────────── */}
      {phase === "results" && (
        <div className="space-y-4">
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4">
            <h3 className="text-sm font-semibold text-emerald-300 mb-1">
              Calibration Complete
            </h3>
            <p className="text-xs text-zinc-400">
              {Object.keys(results).length} key
              {Object.keys(results).length !== 1 ? "s" : ""} calibrated. Review
              the thresholds below and save.
            </p>
          </div>

          {/* Results table */}
          <div className="rounded-lg border border-zinc-700 overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-zinc-800 text-zinc-400">
                  <th className="px-3 py-2 text-left">Key</th>
                  <th className="px-3 py-2 text-right">Quick Max</th>
                  <th className="px-3 py-2 text-right">Long</th>
                  <th className="px-3 py-2 text-right">Super Long</th>
                  <th className="px-3 py-2 text-right">Multi-Press</th>
                  <th className="px-3 py-2 text-right">Confidence</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(results).map(([key, cal]) => (
                  <tr
                    key={key}
                    className="border-t border-zinc-700/50 hover:bg-zinc-800/40"
                  >
                    <td className="px-3 py-2 font-mono font-bold text-zinc-200">
                      {key}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-zinc-300">
                      {cal.singleTapMax}ms
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-zinc-300">
                      {cal.longPressMin}–{cal.longPressMax}ms
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-zinc-300">
                      {cal.superLongMin}–{cal.superLongMax}ms
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-zinc-300">
                      {cal.multiPressWindow}ms
                    </td>
                    <td className="px-3 py-2 text-right">
                      <span
                        className={`font-semibold ${
                          cal.confidence >= 80
                            ? "text-emerald-400"
                            : cal.confidence >= 60
                              ? "text-yellow-400"
                              : "text-red-400"
                        }`}
                      >
                        {cal.confidence}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Threshold visualization */}
          {Object.entries(results).map(([key, cal]) => (
            <div
              key={key}
              className="rounded-lg border border-zinc-700 bg-zinc-800/60 p-3"
            >
              <div className="text-xs text-zinc-400 mb-2">
                <span className="font-mono font-bold text-zinc-200">{key}</span>{" "}
                — Timeline (ms)
              </div>
              <div className="relative h-6 rounded bg-zinc-900 overflow-hidden">
                {/* Quick zone */}
                <div
                  className="absolute inset-y-0 bg-blue-600/40 border-r border-blue-400"
                  style={{
                    left: 0,
                    width: `${(cal.singleTapMax / cal.cancelThreshold) * 100}%`,
                  }}
                />
                {/* Long zone */}
                <div
                  className="absolute inset-y-0 bg-amber-600/40 border-r border-amber-400"
                  style={{
                    left: `${(cal.longPressMin / cal.cancelThreshold) * 100}%`,
                    width: `${((cal.longPressMax - cal.longPressMin) / cal.cancelThreshold) * 100}%`,
                  }}
                />
                {/* Super long zone */}
                <div
                  className="absolute inset-y-0 bg-red-600/40 border-r border-red-400"
                  style={{
                    left: `${(cal.superLongMin / cal.cancelThreshold) * 100}%`,
                    width: `${((cal.superLongMax - cal.superLongMin) / cal.cancelThreshold) * 100}%`,
                  }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-zinc-500 mt-1">
                <span>0</span>
                <span className="text-blue-400">
                  Quick &lt;{cal.singleTapMax}
                </span>
                <span className="text-amber-400">
                  Long {cal.longPressMin}–{cal.longPressMax}
                </span>
                <span className="text-red-400">
                  Super {cal.superLongMin}–{cal.superLongMax}
                </span>
                <span>{cal.cancelThreshold}</span>
              </div>
            </div>
          ))}

          {/* Action buttons */}
          <div className="flex gap-3">
            <button
              onClick={saveResults}
              disabled={saving}
              className="flex-1 rounded-lg bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-500 transition disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save to Profile"}
            </button>
            <button
              onClick={() => {
                setPhase("select");
                api.calibrationStop?.();
              }}
              className="rounded-lg bg-zinc-700 px-4 py-3 text-sm text-zinc-300 hover:bg-zinc-600 transition"
            >
              Discard
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
