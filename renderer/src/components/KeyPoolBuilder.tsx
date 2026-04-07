import { useState, useCallback, DragEvent } from "react";

// ═══════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════
export interface KeyAssignment {
  inputKeys: string[];
  outputKeys: string[];
}

type Zone = "input" | "center" | "output";

interface KeyRow {
  label: string;
  keys: string[];
}

// ═══════════════════════════════════════════════════════════════════
// Full key inventory (grouped by row)
// ═══════════════════════════════════════════════════════════════════
const KEY_ROWS: KeyRow[] = [
  {
    label: "Numbers",
    keys: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"],
  },
  { label: "QWERTY", keys: ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"] },
  { label: "ASDF", keys: ["A", "S", "D", "F", "G", "H", "J", "K", "L"] },
  { label: "ZXCV", keys: ["Z", "X", "C", "V", "B", "N", "M"] },
  {
    label: "Function",
    keys: [
      "F1",
      "F2",
      "F3",
      "F4",
      "F5",
      "F6",
      "F7",
      "F8",
      "F9",
      "F10",
      "F11",
      "F12",
    ],
  },
  {
    label: "Numpad",
    keys: [
      "NP0",
      "NP1",
      "NP2",
      "NP3",
      "NP4",
      "NP5",
      "NP6",
      "NP7",
      "NP8",
      "NP9",
      "NP+",
      "NP-",
      "NP*",
      "NP/",
      "NP.",
    ],
  },
  {
    label: "Special",
    keys: ["Space", "Tab", "Enter", "Escape", "Backspace", "Delete", "Insert"],
  },
  {
    label: "Navigation",
    keys: ["Up", "Down", "Left", "Right", "Home", "End", "PageUp", "PageDown"],
  },
  {
    label: "Punctuation",
    keys: [";", ",", ".", "/", "'", "[", "]", "\\", "-", "="],
  },
  {
    label: "Other",
    keys: ["CapsLock", "PrintScreen", "ScrollLock", "Pause", "MiddleClick"],
  },
];

const ALL_KEYS = KEY_ROWS.flatMap((r) => r.keys);

// ═══════════════════════════════════════════════════════════════════
// Chip styling per zone
// ═══════════════════════════════════════════════════════════════════
const CHIP_STYLE: Record<Zone, string> = {
  center: "bg-zinc-700 text-zinc-300",
  input: "bg-emerald-800 text-emerald-200",
  output: "bg-amber-800 text-amber-200",
};

// ═══════════════════════════════════════════════════════════════════
// Single draggable key chip
// ═══════════════════════════════════════════════════════════════════
function KeyChip({ keyName, zone }: { keyName: string; zone: Zone }) {
  const onDragStart = (e: DragEvent<HTMLSpanElement>) => {
    e.dataTransfer.setData("text/plain", keyName);
    e.dataTransfer.effectAllowed = "move";
  };

  return (
    <span
      draggable
      onDragStart={onDragStart}
      className={`inline-block rounded-lg px-3 py-1.5 text-sm font-mono cursor-grab
        select-none transition-all duration-150 ease-out
        hover:brightness-125 active:cursor-grabbing active:shadow-lg active:shadow-black/40
        ${CHIP_STYLE[zone]}`}
    >
      {keyName}
    </span>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Drop zone wrapper
// ═══════════════════════════════════════════════════════════════════
function DropZone({
  zone,
  dragTarget,
  onDragEnter,
  onDragLeave,
  onDrop,
  children,
  borderColor,
  bgColor,
  header,
  subtext,
  footer,
}: {
  zone: Zone;
  dragTarget: Zone | null;
  onDragEnter: (z: Zone) => void;
  onDragLeave: () => void;
  onDrop: (z: Zone) => void;
  children: React.ReactNode;
  borderColor: string;
  bgColor: string;
  header: string;
  subtext: string;
  footer?: React.ReactNode;
}) {
  const isOver = dragTarget === zone;

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragEnter={(e) => {
        e.preventDefault();
        onDragEnter(zone);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
          onDragLeave();
        }
      }}
      onDrop={(e) => {
        e.preventDefault();
        onDrop(zone);
      }}
      className={`flex-1 rounded-xl border-2 p-4 flex flex-col transition-all duration-150 ease-out
        ${isOver ? `${borderColor} brightness-125 ring-2 ring-white/10` : borderColor}
        ${bgColor}`}
    >
      <div className="mb-3">
        <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-200">
          {header}
        </h4>
        <p className="mt-0.5 text-[10px] text-zinc-500">{subtext}</p>
      </div>
      <div className="flex-1 min-h-[120px]">{children}</div>
      {footer && <div className="mt-3">{footer}</div>}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Main component
// ═══════════════════════════════════════════════════════════════════
export function KeyPoolBuilder({
  onKeysAssigned,
  initialAssignment,
}: {
  onKeysAssigned: (assignment: KeyAssignment) => void;
  initialAssignment?: KeyAssignment;
}) {
  // Build initial zone map
  const buildInitialMap = useCallback((): Record<string, Zone> => {
    const map: Record<string, Zone> = {};
    for (const k of ALL_KEYS) map[k] = "center";
    if (initialAssignment) {
      for (const k of initialAssignment.inputKeys) {
        if (k in map) map[k] = "input";
      }
      for (const k of initialAssignment.outputKeys) {
        if (k in map) map[k] = "output";
      }
    }
    return map;
  }, [initialAssignment]);

  const [zoneMap, setZoneMap] = useState<Record<string, Zone>>(buildInitialMap);
  const [dragKey, setDragKey] = useState<string | null>(null);
  const [dragTarget, setDragTarget] = useState<Zone | null>(null);

  // Derived counts
  const inputKeys = ALL_KEYS.filter((k) => zoneMap[k] === "input");
  const outputKeys = ALL_KEYS.filter((k) => zoneMap[k] === "output");
  const centerKeys = ALL_KEYS.filter((k) => zoneMap[k] === "center");

  // Notify parent on changes
  const fireAssignment = useCallback(
    (map: Record<string, Zone>) => {
      onKeysAssigned({
        inputKeys: ALL_KEYS.filter((k) => map[k] === "input"),
        outputKeys: ALL_KEYS.filter((k) => map[k] === "output"),
      });
    },
    [onKeysAssigned],
  );

  // Drop handler
  const handleDrop = useCallback(
    (targetZone: Zone) => {
      const key = dragKey;
      setDragTarget(null);
      setDragKey(null);
      if (!key || zoneMap[key] === targetZone) return;
      setZoneMap((prev) => {
        const next = { ...prev, [key]: targetZone };
        fireAssignment(next);
        return next;
      });
    },
    [dragKey, zoneMap, fireAssignment],
  );

  // Global drag start listener (capture key from dataTransfer)
  const handleDragEnterZone = useCallback(
    (zone: Zone) => setDragTarget(zone),
    [],
  );
  const handleDragLeaveZone = useCallback(() => setDragTarget(null), []);

  // We capture the dragged key via a wrapper around onDrop since dataTransfer
  // is only readable in onDrop. Instead, we'll use a module-level ref.
  const handleGlobalDragStart = useCallback((key: string) => {
    setDragKey(key);
  }, []);

  // Wrap chips to capture drag start
  const renderChip = (key: string, zone: Zone) => (
    <span key={key} onDragStart={() => handleGlobalDragStart(key)}>
      <KeyChip keyName={key} zone={zone} />
    </span>
  );

  // Bulk actions
  const shoveToInput = useCallback(() => {
    setZoneMap((prev) => {
      const next = { ...prev };
      for (const k of ALL_KEYS) {
        if (next[k] === "center") next[k] = "input";
      }
      fireAssignment(next);
      return next;
    });
  }, [fireAssignment]);

  const shoveToOutput = useCallback(() => {
    setZoneMap((prev) => {
      const next = { ...prev };
      for (const k of ALL_KEYS) {
        if (next[k] === "center") next[k] = "output";
      }
      fireAssignment(next);
      return next;
    });
  }, [fireAssignment]);

  const resetAll = useCallback(() => {
    const map: Record<string, Zone> = {};
    for (const k of ALL_KEYS) map[k] = "center";
    setZoneMap(map);
    fireAssignment(map);
  }, [fireAssignment]);

  return (
    <div className="space-y-4">
      {/* Modifier note + Reset */}
      <div className="flex items-start justify-between">
        <p className="rounded-lg bg-zinc-800/60 px-3 py-2 text-[11px] text-zinc-400 leading-relaxed max-w-2xl">
          <span className="font-semibold text-zinc-300">Note:</span> Shift,
          Ctrl, and Alt are automatic modifiers — they work with any key on
          either side and don&apos;t need to be assigned.
        </p>
        <button
          onClick={resetAll}
          className="shrink-0 rounded-lg border border-zinc-700 px-3 py-1.5 text-[11px]
            font-medium text-zinc-400 hover:border-zinc-500 hover:text-zinc-200 transition-colors"
        >
          Reset All
        </button>
      </div>

      {/* Three zones */}
      <div className="flex gap-4">
        {/* INPUT */}
        <DropZone
          zone="input"
          dragTarget={dragTarget}
          onDragEnter={handleDragEnterZone}
          onDragLeave={handleDragLeaveZone}
          onDrop={handleDrop}
          borderColor="border-emerald-500/60"
          bgColor="bg-emerald-950/30"
          header="INPUT KEYS — Gesture Triggers"
          subtext="Keys you press. GestureKit detects tap patterns on these."
          footer={
            <button
              onClick={shoveToInput}
              className="w-full rounded-lg border border-emerald-500/40 px-3 py-1.5 text-[11px]
                font-medium text-emerald-400 hover:bg-emerald-500/10 transition-colors"
            >
              ⬅ Shove remaining keys here
            </button>
          }
        >
          <div className="flex flex-wrap gap-1.5">
            {inputKeys.map((k) => renderChip(k, "input"))}
            {inputKeys.length === 0 && (
              <p className="text-[10px] text-zinc-600 italic">
                Drag keys here to assign as input triggers
              </p>
            )}
          </div>
        </DropZone>

        {/* CENTER (available) */}
        <DropZone
          zone="center"
          dragTarget={dragTarget}
          onDragEnter={handleDragEnterZone}
          onDragLeave={handleDragLeaveZone}
          onDrop={handleDrop}
          borderColor="border-zinc-700"
          bgColor="bg-zinc-800/40"
          header="ALL KEYS"
          subtext="Drag keys to Input or Output"
        >
          <div className="space-y-2.5">
            {KEY_ROWS.map((row) => {
              const rowKeys = row.keys.filter((k) => zoneMap[k] === "center");
              if (rowKeys.length === 0) return null;
              return (
                <div key={row.label}>
                  <span className="mb-1 block text-[9px] font-medium uppercase tracking-wider text-zinc-600">
                    {row.label}
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {rowKeys.map((k) => renderChip(k, "center"))}
                  </div>
                </div>
              );
            })}
            {centerKeys.length === 0 && (
              <p className="text-[10px] text-zinc-600 italic text-center py-4">
                All keys assigned
              </p>
            )}
          </div>
        </DropZone>

        {/* OUTPUT */}
        <DropZone
          zone="output"
          dragTarget={dragTarget}
          onDragEnter={handleDragEnterZone}
          onDragLeave={handleDragLeaveZone}
          onDrop={handleDrop}
          borderColor="border-amber-500/60"
          bgColor="bg-amber-950/30"
          header="OUTPUT KEYS — Emitted Actions"
          subtext="Keys the app sends. These fire when a gesture triggers."
          footer={
            <button
              onClick={shoveToOutput}
              className="w-full rounded-lg border border-amber-500/40 px-3 py-1.5 text-[11px]
                font-medium text-amber-400 hover:bg-amber-500/10 transition-colors"
            >
              Shove remaining keys here ➡
            </button>
          }
        >
          <div className="flex flex-wrap gap-1.5">
            {outputKeys.map((k) => renderChip(k, "output"))}
            {outputKeys.length === 0 && (
              <p className="text-[10px] text-zinc-600 italic">
                Drag keys here to assign as output actions
              </p>
            )}
          </div>
        </DropZone>
      </div>

      {/* Summary bar */}
      <div className="rounded-lg bg-zinc-800/60 px-4 py-2 flex items-center justify-center gap-4 text-xs">
        <span className="text-emerald-400 font-medium">
          Input: {inputKeys.length} keys
        </span>
        <span className="text-zinc-600">|</span>
        <span className="text-amber-400 font-medium">
          Output: {outputKeys.length} keys
        </span>
        <span className="text-zinc-600">|</span>
        <span className="text-zinc-500">
          Unassigned: {centerKeys.length} keys
        </span>
      </div>
    </div>
  );
}
