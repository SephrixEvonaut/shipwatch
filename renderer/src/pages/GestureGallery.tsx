import { useState, useEffect, useCallback } from "react";
import { PageHeader } from "../components/PageHeader";
import type { GestureDefinition, CalibrationStep } from "../types";

const api = (window as any).electronAPI;

// ── Category metadata ───────────────────────────────────────────
const CATEGORY_LABELS: Record<string, string> = {
  tap: "Tap",
  hold: "Hold",
  toggle: "Toggle",
  "multi-tap": "Multi-Tap",
};

const CATEGORY_COLORS: Record<string, string> = {
  tap: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  hold: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  toggle: "bg-purple-500/15 text-purple-400 border-purple-500/30",
  "multi-tap": "bg-blue-500/15 text-blue-400 border-blue-500/30",
};

const STEP_LABELS: Record<string, string> = {
  single_tap: "Quick Tap",
  long_hold: "Long Hold",
  super_long_hold: "Super Long Hold",
  double_tap: "Double Tap",
  triple_tap: "Triple Tap",
  quadruple_tap: "Quadruple Tap",
};

const ALL_CALIBRATION_STEPS: CalibrationStep[] = [
  "single_tap",
  "long_hold",
  "super_long_hold",
  "double_tap",
  "triple_tap",
  "quadruple_tap",
];

const ALL_CATEGORIES = ["tap", "hold", "toggle", "multi-tap"] as const;

// ── Gesture card ────────────────────────────────────────────────
function GestureCard({
  def,
  onToggle,
  onEdit,
  onDelete,
}: {
  def: GestureDefinition;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const catColors =
    CATEGORY_COLORS[def.category] ?? "bg-zinc-500/15 text-zinc-400 border-zinc-500/30";
  return (
    <div
      className={`rounded-xl border p-4 transition-all ${
        def.enabled
          ? "bg-zinc-800/80 border-zinc-700"
          : "bg-zinc-900/50 border-zinc-800/50 opacity-60"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-semibold text-sm text-zinc-100">{def.name}</span>
            <span
              className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${catColors}`}
            >
              {CATEGORY_LABELS[def.category] ?? def.category}
            </span>
          </div>
          <p className="text-xs text-zinc-500 leading-relaxed">{def.description}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {def.calibrationSteps.map((s) => (
              <span
                key={s}
                className="rounded bg-zinc-700/50 px-1.5 py-0.5 text-[10px] text-zinc-400 font-mono"
              >
                {STEP_LABELS[s] ?? s}
              </span>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onEdit}
            className="rounded p-1 text-zinc-500 hover:text-zinc-300 transition-colors"
            title="Edit"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          <button
            onClick={onDelete}
            className="rounded p-1 text-zinc-600 hover:text-red-400 transition-colors"
            title="Delete"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
          <button
            onClick={onToggle}
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
              def.enabled ? "bg-emerald-500" : "bg-zinc-700"
            }`}
            title={def.enabled ? "Disable" : "Enable"}
          >
            <span
              className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                def.enabled ? "translate-x-4" : "translate-x-0.5"
              }`}
            />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Editor modal ────────────────────────────────────────────────
function GestureEditor({
  initial,
  mode,
  onSave,
  onCancel,
}: {
  initial: GestureDefinition;
  mode: "create" | "edit";
  onSave: (def: GestureDefinition) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState<GestureDefinition>({ ...initial });

  const toggleStep = (step: CalibrationStep) => {
    setDraft((d) => ({
      ...d,
      calibrationSteps: d.calibrationSteps.includes(step)
        ? d.calibrationSteps.filter((s) => s !== step)
        : [...d.calibrationSteps, step],
    }));
  };

  const valid = draft.id.trim() && draft.name.trim() && draft.calibrationSteps.length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-zinc-700 bg-zinc-900 p-6 shadow-2xl">
        <h3 className="text-lg font-bold text-zinc-100 mb-4">
          {mode === "create" ? "New Gesture" : `Edit: ${initial.name}`}
        </h3>

        {/* ID */}
        <label className="block mb-3">
          <span className="text-xs text-zinc-400 font-medium">ID (unique)</span>
          <input
            value={draft.id}
            onChange={(e) => setDraft((d) => ({ ...d, id: e.target.value.replace(/\s/g, "_").toLowerCase() }))}
            disabled={mode === "edit"}
            className="mt-1 w-full rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-1.5 text-sm text-zinc-200 outline-none focus:border-emerald-500 disabled:opacity-50"
            placeholder="e.g. quick, double_tap"
          />
        </label>

        {/* Name */}
        <label className="block mb-3">
          <span className="text-xs text-zinc-400 font-medium">Display Name</span>
          <input
            value={draft.name}
            onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
            className="mt-1 w-full rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-1.5 text-sm text-zinc-200 outline-none focus:border-emerald-500"
            placeholder="e.g. Quick, Double Tap"
          />
        </label>

        {/* Description */}
        <label className="block mb-3">
          <span className="text-xs text-zinc-400 font-medium">Description</span>
          <input
            value={draft.description}
            onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
            className="mt-1 w-full rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-1.5 text-sm text-zinc-200 outline-none focus:border-emerald-500"
            placeholder="Brief description of this gesture"
          />
        </label>

        {/* Category */}
        <label className="block mb-3">
          <span className="text-xs text-zinc-400 font-medium">Category</span>
          <div className="mt-1 flex flex-wrap gap-2">
            {ALL_CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setDraft((d) => ({ ...d, category: cat }))}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                  draft.category === cat
                    ? CATEGORY_COLORS[cat]
                    : "border-zinc-700 text-zinc-500 hover:text-zinc-300"
                }`}
              >
                {CATEGORY_LABELS[cat]}
              </button>
            ))}
          </div>
        </label>

        {/* Calibration steps */}
        <div className="mb-4">
          <span className="text-xs text-zinc-400 font-medium block mb-1.5">
            Required Calibration Steps
          </span>
          <div className="flex flex-wrap gap-2">
            {ALL_CALIBRATION_STEPS.map((step) => (
              <button
                key={step}
                onClick={() => toggleStep(step)}
                className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors ${
                  draft.calibrationSteps.includes(step)
                    ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-400"
                    : "border-zinc-700 text-zinc-500 hover:text-zinc-300"
                }`}
              >
                {STEP_LABELS[step]}
              </button>
            ))}
          </div>
        </div>

        {/* Enabled */}
        <label className="flex items-center gap-2 mb-5 cursor-pointer">
          <input
            type="checkbox"
            checked={draft.enabled}
            onChange={(e) => setDraft((d) => ({ ...d, enabled: e.target.checked }))}
            className="rounded border-zinc-600 bg-zinc-800 text-emerald-500 focus:ring-emerald-500"
          />
          <span className="text-sm text-zinc-300">Enabled</span>
        </label>

        {/* Actions */}
        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="rounded-lg px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => valid && onSave(draft)}
            disabled={!valid}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {mode === "create" ? "Create" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Page export
// ═══════════════════════════════════════════════════════════════════
export function GestureGallery() {
  const [gestures, setGestures] = useState<GestureDefinition[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const [editing, setEditing] = useState<{
    def: GestureDefinition;
    mode: "create" | "edit";
  } | null>(null);

  // ── Load on mount ─────────────────────────────────────────────
  useEffect(() => {
    if (!api?.listGestureDefinitions) return;
    api.listGestureDefinitions().then((defs: GestureDefinition[]) => {
      setGestures(defs);
    });
  }, []);

  // ── Persist helper ────────────────────────────────────────────
  const persist = useCallback(async (updated: GestureDefinition[]) => {
    setGestures(updated);
    if (api?.saveGestureDefinitions) {
      await api.saveGestureDefinitions(updated);
    }
  }, []);

  // ── Actions ───────────────────────────────────────────────────
  const toggleGesture = useCallback(
    (id: string) => {
      persist(gestures.map((g) => (g.id === id ? { ...g, enabled: !g.enabled } : g)));
    },
    [gestures, persist],
  );

  const deleteGesture = useCallback(
    (id: string) => {
      persist(gestures.filter((g) => g.id !== id));
    },
    [gestures, persist],
  );

  const saveGesture = useCallback(
    (def: GestureDefinition) => {
      const exists = gestures.some((g) => g.id === def.id);
      const updated = exists
        ? gestures.map((g) => (g.id === def.id ? def : g))
        : [...gestures, def];
      persist(updated);
      setEditing(null);
    },
    [gestures, persist],
  );

  const startCreate = () => {
    setEditing({
      def: {
        id: "",
        name: "",
        description: "",
        enabled: true,
        category: "tap",
        calibrationSteps: ["single_tap"],
      },
      mode: "create",
    });
  };

  // ── Derived data ──────────────────────────────────────────────
  const filtered =
    filter === "all"
      ? gestures
      : filter === "enabled"
        ? gestures.filter((g) => g.enabled)
        : gestures.filter((g) => g.category === filter);

  const enabledCount = gestures.filter((g) => g.enabled).length;

  // Unique calibration steps needed across all enabled gestures
  const requiredSteps = [
    ...new Set(
      gestures
        .filter((g) => g.enabled)
        .flatMap((g) => g.calibrationSteps),
    ),
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Gestures"
        description={`${enabledCount} enabled · ${gestures.length} total`}
        actions={
          <button
            onClick={startCreate}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 transition-colors"
          >
            + New Gesture
          </button>
        }
      />

      {/* FILTER BAR */}
      <div className="flex flex-wrap gap-2">
        {[
          { key: "all", label: "All" },
          { key: "enabled", label: "Enabled" },
          { key: "tap", label: "Tap" },
          { key: "hold", label: "Hold" },
          { key: "toggle", label: "Toggle" },
          { key: "multi-tap", label: "Multi-Tap" },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              filter === tab.key
                ? "bg-zinc-700 text-zinc-100"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* CALIBRATION SUMMARY */}
      {requiredSteps.length > 0 && (
        <div className="rounded-lg border border-zinc-700/50 bg-zinc-800/40 p-3">
          <h3 className="text-xs font-medium text-zinc-400 mb-2">
            Calibration steps required by enabled gestures
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {requiredSteps.map((s) => (
              <span
                key={s}
                className="rounded bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-[11px] font-mono text-emerald-400"
              >
                {STEP_LABELS[s] ?? s}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* GESTURE GRID */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((g) => (
          <GestureCard
            key={g.id}
            def={g}
            onToggle={() => toggleGesture(g.id)}
            onEdit={() => setEditing({ def: g, mode: "edit" })}
            onDelete={() => deleteGesture(g.id)}
          />
        ))}
        {filtered.length === 0 && (
          <div className="col-span-full py-12 text-center text-zinc-600">
            No gestures match this filter
          </div>
        )}
      </div>

      {/* EDITOR MODAL */}
      {editing && (
        <GestureEditor
          initial={editing.def}
          mode={editing.mode}
          onSave={saveGesture}
          onCancel={() => setEditing(null)}
        />
      )}
    </div>
  );
}

export default GestureGallery;
