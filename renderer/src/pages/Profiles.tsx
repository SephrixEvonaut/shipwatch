import { useState, useEffect, useCallback } from "react";
import { PageHeader } from "../components/PageHeader";
import { KeyPoolBuilder, KeyAssignment } from "../components/KeyPoolBuilder";
import type { ProfileDef, Binding, GestureType, GestureDefinition } from "../types";

// ═══════════════════════════════════════════════════════════════════
// Constants — gesture options loaded from Gestures tab definitions
// ═══════════════════════════════════════════════════════════════════

function generateId(): string {
  return `p-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function createEmptyProfile(): ProfileDef {
  return {
    id: generateId(),
    name: "",
    description: "",
    active: false,
    inputKeys: [],
    outputKeys: [],
    bindings: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

// ═══════════════════════════════════════════════════════════════════
// IPC helpers — graceful fallback when running outside Electron
// ═══════════════════════════════════════════════════════════════════
const api = typeof window !== "undefined" ? window.electronAPI : undefined;

async function loadProfilesFromDisk(): Promise<ProfileDef[]> {
  if (!api?.listGuiProfiles) return [];
  try {
    return await api.listGuiProfiles();
  } catch {
    return [];
  }
}

async function persistProfile(profile: ProfileDef): Promise<void> {
  if (!api?.saveGuiProfile) return;
  try {
    await api.saveGuiProfile(profile);
  } catch {
    /* best-effort */
  }
}

async function removeProfileFromDisk(id: string): Promise<void> {
  if (!api?.deleteGuiProfile) return;
  try {
    await api.deleteGuiProfile(id);
  } catch {
    /* best-effort */
  }
}

// ═══════════════════════════════════════════════════════════════════
// Profile List Card
// ═══════════════════════════════════════════════════════════════════
function ProfileCard({
  profile,
  selected,
  onSelect,
}: {
  profile: ProfileDef;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className={`w-full rounded-xl p-3 text-left transition-colors ${
        selected
          ? "bg-zinc-800 ring-1 ring-emerald-500/40"
          : "bg-zinc-900 hover:bg-zinc-800/70"
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-zinc-100">
          {profile.name || "Unnamed"}
        </span>
        {profile.active && (
          <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
            ACTIVE
          </span>
        )}
      </div>
      {profile.description && (
        <p className="mt-1 text-xs text-zinc-500">{profile.description}</p>
      )}
      <div className="mt-2 flex items-center gap-3 text-[10px] text-zinc-500">
        <span>
          <span className="text-emerald-400 font-medium">
            {profile.inputKeys.length}
          </span>{" "}
          input
        </span>
        <span>
          <span className="text-amber-400 font-medium">
            {profile.outputKeys.length}
          </span>{" "}
          output
        </span>
        <span>
          <span className="text-zinc-300 font-medium">
            {profile.bindings.length}
          </span>{" "}
          bindings
        </span>
      </div>
    </button>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Binding Table
// ═══════════════════════════════════════════════════════════════════
function BindingTable({
  bindings,
  onUpdate,
  onRemove,
  inputKeys,
  outputKeys,
  gestureOptions,
  gestureLabels,
}: {
  bindings: Binding[];
  onUpdate: (idx: number, b: Binding) => void;
  onRemove: (idx: number) => void;
  inputKeys: string[];
  outputKeys: string[];
  gestureOptions: string[];
  gestureLabels: Record<string, string>;
}) {
  return (
    <div className="overflow-hidden rounded-lg bg-zinc-950/60">
      <table className="w-full text-xs">
        <thead className="bg-zinc-900/80 text-zinc-500">
          <tr>
            <th className="px-3 py-2 text-left font-medium">Input Key</th>
            <th className="px-3 py-2 text-left font-medium">Gesture</th>
            <th className="px-3 py-2 text-left font-medium">Output Key</th>
            <th className="px-3 py-2 text-left font-medium">Label</th>
            <th className="px-3 py-2 text-right font-medium w-12"></th>
          </tr>
        </thead>
        <tbody className="font-mono">
          {bindings.map((b, i) => (
            <tr key={i} className="border-t border-zinc-800/50">
              <td className="px-3 py-1.5">
                <select
                  value={b.key}
                  onChange={(e) => onUpdate(i, { ...b, key: e.target.value })}
                  className="w-20 rounded bg-zinc-800 px-1.5 py-0.5 text-xs text-zinc-200
                    border border-zinc-700 focus:border-emerald-500 outline-none"
                >
                  <option value="">Key…</option>
                  {inputKeys.map((k) => (
                    <option key={k} value={k}>
                      {k}
                    </option>
                  ))}
                </select>
              </td>
              <td className="px-3 py-1.5">
                <select
                  value={b.gesture}
                  onChange={(e) =>
                    onUpdate(i, {
                      ...b,
                      gesture: e.target.value as GestureType,
                    })
                  }
                  className="rounded bg-zinc-800 px-1.5 py-0.5 text-xs text-zinc-200
                    border border-zinc-700 focus:border-emerald-500 outline-none"
                >
                  {gestureOptions.map((g) => (
                    <option key={g} value={g}>
                      {gestureLabels[g] ?? g}
                    </option>
                  ))}
                </select>
              </td>
              <td className="px-3 py-1.5">
                <select
                  value={b.output}
                  onChange={(e) =>
                    onUpdate(i, { ...b, output: e.target.value })
                  }
                  className="w-24 rounded bg-zinc-800 px-1.5 py-0.5 text-xs text-zinc-200
                    border border-zinc-700 focus:border-emerald-500 outline-none"
                >
                  <option value="">Output…</option>
                  {outputKeys.map((k) => (
                    <option key={k} value={k}>
                      {k}
                    </option>
                  ))}
                </select>
              </td>
              <td className="px-3 py-1.5">
                <input
                  value={b.label}
                  onChange={(e) => onUpdate(i, { ...b, label: e.target.value })}
                  className="w-28 rounded bg-zinc-800 px-1.5 py-0.5 text-xs text-zinc-200
                    border border-zinc-700 focus:border-emerald-500 outline-none"
                  placeholder="Description…"
                />
              </td>
              <td className="px-3 py-1.5 text-right">
                <button
                  onClick={() => onRemove(i)}
                  className="text-red-400/60 hover:text-red-400 transition-colors"
                >
                  ✕
                </button>
              </td>
            </tr>
          ))}
          {bindings.length === 0 && (
            <tr>
              <td colSpan={5} className="px-3 py-6 text-center text-zinc-600">
                No bindings yet — assign input &amp; output keys above, then
                click &quot;Add Binding&quot;
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Profile Editor (right panel)
// ═══════════════════════════════════════════════════════════════════
function ProfileEditor({
  profile,
  onSave,
  onDelete,
  onSetActive,
  gestureOptions,
  gestureLabels,
}: {
  profile: ProfileDef;
  onSave: (p: ProfileDef) => void;
  onDelete: (id: string) => void;
  onSetActive: (id: string) => void;
  gestureOptions: string[];
  gestureLabels: Record<string, string>;
}) {
  const [draft, setDraft] = useState<ProfileDef>({ ...profile });
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showKeys, setShowKeys] = useState(true);

  // Reset draft when switching profiles
  useEffect(() => {
    setDraft({ ...profile });
    setDirty(false);
    setSaved(false);
  }, [profile]);

  const touch = useCallback((updater: (prev: ProfileDef) => ProfileDef) => {
    setDraft((prev) => {
      const next = updater(prev);
      return { ...next, updatedAt: Date.now() };
    });
    setDirty(true);
    setSaved(false);
  }, []);

  const handleKeyAssignment = useCallback(
    (assignment: KeyAssignment) => {
      touch((d) => ({
        ...d,
        inputKeys: assignment.inputKeys,
        outputKeys: assignment.outputKeys,
      }));
    },
    [touch],
  );

  const updateBinding = useCallback(
    (idx: number, b: Binding) =>
      touch((d) => {
        const bs = [...d.bindings];
        bs[idx] = b;
        return { ...d, bindings: bs };
      }),
    [touch],
  );

  const removeBinding = useCallback(
    (idx: number) =>
      touch((d) => ({
        ...d,
        bindings: d.bindings.filter((_, i) => i !== idx),
      })),
    [touch],
  );

  const addBinding = useCallback(
    () =>
      touch((d) => ({
        ...d,
        bindings: [
          ...d.bindings,
          {
            key: d.inputKeys[0] ?? "",
            gesture: "quick" as GestureType,
            output: d.outputKeys[0] ?? "",
            label: "",
          },
        ],
      })),
    [touch],
  );

  const handleSave = () => {
    onSave(draft);
    setDirty(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const canAddBinding =
    draft.inputKeys.length > 0 && draft.outputKeys.length > 0;

  return (
    <div className="flex-1 space-y-4 min-w-0">
      {/* Name & Description */}
      <div className="rounded-xl bg-zinc-900 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500">
            Profile Details
          </h3>
          <div className="flex items-center gap-2">
            {!draft.active && (
              <button
                onClick={() => onSetActive(draft.id)}
                className="rounded-lg bg-zinc-800 px-3 py-1 text-[10px] font-medium text-zinc-400
                  hover:bg-emerald-500/10 hover:text-emerald-400 transition-colors"
              >
                Set Active
              </button>
            )}
            {draft.active && (
              <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
                ACTIVE
              </span>
            )}
          </div>
        </div>
        <div>
          <label className="mb-1 block text-[10px] font-medium uppercase text-zinc-500">
            Name
          </label>
          <input
            value={draft.name}
            onChange={(e) => touch((d) => ({ ...d, name: e.target.value }))}
            className="w-full rounded-lg bg-zinc-800 px-3 py-1.5 text-sm text-zinc-100
              border border-zinc-700 focus:border-emerald-500 outline-none"
            placeholder="Profile name"
          />
        </div>
        <div>
          <label className="mb-1 block text-[10px] font-medium uppercase text-zinc-500">
            Description
          </label>
          <input
            value={draft.description}
            onChange={(e) =>
              touch((d) => ({ ...d, description: e.target.value }))
            }
            className="w-full rounded-lg bg-zinc-800 px-3 py-1.5 text-sm text-zinc-100
              border border-zinc-700 focus:border-emerald-500 outline-none"
            placeholder="What this profile is for"
          />
        </div>
      </div>

      {/* Key Assignment — collapsible */}
      <div className="rounded-xl bg-zinc-900 overflow-hidden">
        <button
          onClick={() => setShowKeys((v) => !v)}
          className="w-full flex items-center justify-between p-4 text-left hover:bg-zinc-800/50 transition-colors"
        >
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-300">
              Key Assignment
            </h3>
            <p className="mt-0.5 text-[10px] text-zinc-500">
              Drag keys between Input, Output, and Inactive zones
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[10px] text-emerald-400 font-medium">
              {draft.inputKeys.length} input
            </span>
            <span className="text-[10px] text-amber-400 font-medium">
              {draft.outputKeys.length} output
            </span>
            <span
              className={`text-zinc-500 transition-transform text-xs ${
                showKeys ? "rotate-180" : ""
              }`}
            >
              ▼
            </span>
          </div>
        </button>
        {showKeys && (
          <div className="border-t border-zinc-800 p-4">
            <KeyPoolBuilder
              onKeysAssigned={handleKeyAssignment}
              initialAssignment={{
                inputKeys: draft.inputKeys,
                outputKeys: draft.outputKeys,
              }}
            />
          </div>
        )}
      </div>

      {/* Bindings */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500">
            Bindings
            <span className="ml-2 text-zinc-600 font-normal normal-case">
              ({draft.bindings.length})
            </span>
          </h3>
          <button
            onClick={addBinding}
            disabled={!canAddBinding}
            className={`rounded-lg px-3 py-1 text-[11px] font-medium transition-colors ${
              canAddBinding
                ? "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                : "bg-zinc-900 text-zinc-600 cursor-not-allowed"
            }`}
          >
            + Add Binding
          </button>
        </div>

        {!canAddBinding && draft.bindings.length === 0 && (
          <p className="rounded-lg bg-zinc-900 px-4 py-3 text-xs text-zinc-500 text-center">
            Assign at least one input key and one output key above to create
            bindings
          </p>
        )}

        {(canAddBinding || draft.bindings.length > 0) && (
          <BindingTable
            bindings={draft.bindings}
            onUpdate={updateBinding}
            onRemove={removeBinding}
            inputKeys={draft.inputKeys}
            outputKeys={draft.outputKeys}
            gestureOptions={gestureOptions}
            gestureLabels={gestureLabels}
          />
        )}
      </div>

      {/* Action Bar */}
      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={handleSave}
          disabled={!dirty && !saved}
          className={`rounded-lg px-5 py-2 text-xs font-semibold transition-all ${
            saved
              ? "bg-emerald-600/80 text-white"
              : dirty
                ? "bg-emerald-600 text-white hover:bg-emerald-500 shadow-lg shadow-emerald-500/20"
                : "bg-zinc-800 text-zinc-600 cursor-not-allowed"
          }`}
        >
          {saved ? "✓ Saved" : "Save Profile"}
        </button>
        <button
          onClick={() => {
            setDraft({ ...profile });
            setDirty(false);
          }}
          disabled={!dirty}
          className={`rounded-lg px-4 py-2 text-xs font-medium transition-colors ${
            dirty
              ? "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
              : "bg-zinc-900 text-zinc-600 cursor-not-allowed"
          }`}
        >
          Discard Changes
        </button>
        <div className="flex-1" />
        <button
          onClick={() => onDelete(draft.id)}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-xs font-medium text-red-400/60
            hover:bg-red-500/10 hover:text-red-400 transition-colors"
        >
          Delete Profile
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Page export
// ═══════════════════════════════════════════════════════════════════
export function Profiles() {
  const [profiles, setProfiles] = useState<ProfileDef[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [gestureDefs, setGestureDefs] = useState<GestureDefinition[]>([]);

  // Load profiles + gesture definitions on mount
  useEffect(() => {
    loadProfilesFromDisk().then((loaded) => {
      setProfiles(loaded);
      if (loaded.length > 0) setSelectedId(loaded[0].id);
      setLoading(false);
    });
    if (api?.listGestureDefinitions) {
      api.listGestureDefinitions().then((defs: GestureDefinition[]) =>
        setGestureDefs(defs),
      );
    }
  }, []);

  const handleCreate = () => {
    const p = createEmptyProfile();
    p.name = `Profile ${profiles.length + 1}`;
    setProfiles((prev) => [...prev, p]);
    setSelectedId(p.id);
    persistProfile(p);
  };

  const handleSave = (updated: ProfileDef) => {
    setProfiles((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    persistProfile(updated);
  };

  const handleDelete = (id: string) => {
    setProfiles((prev) => {
      const next = prev.filter((p) => p.id !== id);
      if (selectedId === id) {
        setSelectedId(next.length > 0 ? next[0].id : null);
      }
      return next;
    });
    removeProfileFromDisk(id);
  };

  const handleSetActive = (id: string) => {
    setProfiles((prev) => {
      const next = prev.map((p) => ({ ...p, active: p.id === id }));
      for (const p of next) persistProfile(p);
      return next;
    });
  };

  const selected = profiles.find((p) => p.id === selectedId) ?? null;

  // Derive gesture options from definitions (only enabled ones)
  const enabledGestures = gestureDefs.filter((g) => g.enabled);
  const gestureOptions = enabledGestures.map((g) => g.id);
  const gestureLabels: Record<string, string> = {};
  for (const g of enabledGestures) gestureLabels[g.id] = g.name;

  return (
    <div>
      <PageHeader
        title="Profiles"
        description="Create and manage gesture binding profiles. Profiles are saved automatically to disk."
      />

      {loading ? (
        <div className="flex items-center justify-center py-20 text-sm text-zinc-500">
          Loading profiles…
        </div>
      ) : (
        <div className="flex gap-5">
          {/* Left panel — profile list */}
          <div className="w-[280px] shrink-0 space-y-2">
            {profiles.map((p) => (
              <ProfileCard
                key={p.id}
                profile={p}
                selected={selectedId === p.id}
                onSelect={() => setSelectedId(p.id)}
              />
            ))}

            {profiles.length === 0 && (
              <div className="rounded-xl bg-zinc-900 p-6 text-center">
                <p className="text-sm text-zinc-500 mb-3">No profiles yet</p>
                <p className="text-xs text-zinc-600">
                  Create your first profile to start mapping gestures
                </p>
              </div>
            )}

            <button
              onClick={handleCreate}
              className="w-full rounded-xl border border-dashed border-zinc-700 p-3 text-center
                text-xs font-medium text-zinc-500 hover:border-emerald-500/40 hover:text-emerald-400
                transition-colors"
            >
              + Create New Profile
            </button>
          </div>

          {/* Right panel — editor */}
          {selected ? (
            <ProfileEditor
              key={selected.id}
              profile={selected}
              onSave={handleSave}
              onDelete={handleDelete}
              onSetActive={handleSetActive}
              gestureOptions={gestureOptions}
              gestureLabels={gestureLabels}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center rounded-xl bg-zinc-900 py-20">
              <div className="text-center">
                <p className="text-sm text-zinc-500 mb-1">
                  No profile selected
                </p>
                <p className="text-xs text-zinc-600">
                  Create or select a profile from the left panel
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
