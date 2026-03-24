// ============================================================================
// OMEGA MAPPINGS - Complete Inputâ†’Output Ability Mapping
// ============================================================================
//
// This module defines all gestureâ†’output mappings for the Omega system.
// Uses 4 gesture types: quick, long, quick_toggle, long_toggle
//
// BUFFER TIER REFERENCE:
// - low:    129-163ms (same-category abilities, rapid fire)
// - medium: 229-263ms (after targeting, before abilities)
// - high:   513-667ms (major transitions, cooldowns)
// - cog:    262-348ms (targetingâ†’cog icon, 75ms faster than standard medium)
//
// ICON SEQUENCING RULES:
// - ðŸŽ¯ Cog (ALT+F9): AFTER targeting abilities
// - ðŸ›¡ï¸ Shield (\): AFTER guard (dual-key with L)
// - ðŸ”« Gun (/): BEFORE focus target
//
// ============================================================================

import {
  MacroBinding,
  SequenceStep,
  InputKey,
  ActionIdentifier,
} from "./types.js";
import { OmegaGestureType } from "./omegaTypes.js";

// ============================================================================
// TYPES
// ============================================================================

export type BufferTier = "low" | "medium" | "high";

export interface OmegaSequenceStep {
  /** Output key (e.g., "N", "SHIFT+J", "7") */
  key?: string;

  /** Buffer tier for delay before next step */
  bufferTier?: BufferTier;

  /** Custom delay range (overrides bufferTier) */
  minDelay?: number;
  maxDelay?: number;

  /** Echo hits for ability confirmation */
  echoHits?: { count: 1 | 2 | 3 | 4; windowMs: number };

  /** Hold through next step (for modifiers like focus target key "7") */
  holdThroughNext?: boolean;
  releaseDelayMin?: number;
  releaseDelayMax?: number;

  /** Timer action */
  timer?: {
    id: string;
    durationSeconds: number;
    message: string;
  };

  /** Scroll action */
  scrollDirection?: "up" | "down";
  scrollMagnitude?: number;

  /** Step name for logging */
  name?: string;
}

export interface OmegaBinding {
  name: string;
  inputKey: InputKey;
  gesture: OmegaGestureType;
  sequence: OmegaSequenceStep[];
  enabled: boolean;
  actionId?: ActionIdentifier;
}

export type OmegaBindingLookup = Map<
  InputKey,
  Map<OmegaGestureType, OmegaBinding>
>;

// ============================================================================
// HELPER FUNCTIONS (exported for use in omegaProfiles.ts)
// ============================================================================

export function step(
  key: string,
  bufferTier: BufferTier = "low",
  opts: Partial<OmegaSequenceStep> = {},
): OmegaSequenceStep {
  return { key, bufferTier, ...opts };
}

export function targetWithCog(targetKey: string): OmegaSequenceStep[] {
  // Targeting key uses reduced medium buffer (75ms earlier than standard medium)
  // Custom echo hit with tighter timing (35-46ms) to ensure cog icon targets correctly
  return [
    {
      key: targetKey,
      minDelay: 262,
      maxDelay: 348,
      echoHits: { count: 1, windowMs: 46 },
    },
    step("ALT+F9", "low"),
  ];
}

export function timerStep(
  id: string,
  durationSeconds: number,
  message: string,
): OmegaSequenceStep {
  return {
    timer: { id, durationSeconds, message },
    bufferTier: "low",
  };
}

export function holdModifier(
  key: string,
  releaseDelayMin = 7,
  releaseDelayMax = 18,
): OmegaSequenceStep {
  return {
    key,
    bufferTier: "medium",
    holdThroughNext: true,
    releaseDelayMin,
    releaseDelayMax,
  };
}

export function scrollStep(
  direction: "up" | "down",
  magnitude: number,
): OmegaSequenceStep {
  return {
    scrollDirection: direction,
    scrollMagnitude: magnitude,
    bufferTier: "low",
  };
}

// ============================================================================
// OMEGA BINDING DEFINITIONS
// ============================================================================

export const OMEGA_BINDINGS: OmegaBinding[] = [
  // ==========================================================================
  // KEY: SPACEBAR
  // ==========================================================================
  {
    name: "Endure Pain Drop Timer",
    inputKey: "SPACEBAR",
    gesture: "quick",
    sequence: [timerStep("drop", 15.5, "drop drop drop drop")],
    enabled: true,
  },
  {
    name: "Endure Pain Drop Timer (Long)",
    inputKey: "SPACEBAR",
    gesture: "long",
    sequence: [timerStep("drop", 15.5, "drop drop drop drop")],
    enabled: true,
  },
  // SPACEBAR long: covered above
  // SPACEBAR quick_toggle: none
  // SPACEBAR long_toggle: none

  // ==========================================================================
  // KEY: 1
  // ==========================================================================
  {
    name: "Crushing Blow",
    inputKey: "1",
    gesture: "quick",
    sequence: [step("N", "low", { echoHits: { count: 2, windowMs: 170 } })],
    enabled: true,
    actionId: "CRUSHING_BLOW",
  },
  {
    name: "Center Target + Cog",
    inputKey: "1",
    gesture: "long",
    sequence: targetWithCog("SHIFT+O"),
    enabled: true,
  },
  {
    name: "Crushing Blow (toggled)",
    inputKey: "1",
    gesture: "quick_toggle",
    sequence: [step("N", "low", { echoHits: { count: 2, windowMs: 170 } })],
    enabled: true,
    actionId: "CRUSHING_BLOW",
  },
  {
    name: "Center Target + Cog (toggled)",
    inputKey: "1",
    gesture: "long_toggle",
    sequence: targetWithCog("SHIFT+O"),
    enabled: true,
  },

  // ==========================================================================
  // KEY: 2
  // ==========================================================================
  {
    name: "Force Scream",
    inputKey: "2",
    gesture: "quick",
    sequence: [step("O", "low", { echoHits: { count: 2, windowMs: 170 } })],
    enabled: true,
    actionId: "FORCE_SCREAM",
  },
  {
    name: "Sweeping Slash",
    inputKey: "2",
    gesture: "long",
    sequence: [
      step("SHIFT+J", "low", { echoHits: { count: 2, windowMs: 170 } }),
    ],
    enabled: true,
    actionId: "SWEEPING_SLASH",
  },
  // 2 quick_toggle: none
  // 2 long_toggle: none

  // ==========================================================================
  // KEY: 3
  // ==========================================================================
  {
    name: "Aegis Assault",
    inputKey: "3",
    gesture: "quick",
    sequence: [step("Z", "low", { echoHits: { count: 2, windowMs: 170 } })],
    enabled: true,
    actionId: "AEGIS_ASSAULT",
  },
  {
    name: "Smash",
    inputKey: "3",
    gesture: "long",
    sequence: [step("]", "low", { echoHits: { count: 3, windowMs: 170 } })],
    enabled: true,
    actionId: "SMASH",
  },
  {
    name: "Vicious Slash",
    inputKey: "3",
    gesture: "quick_toggle",
    sequence: [step("ALT+[", "low")],
    enabled: true,
    actionId: "VICIOUS_SLASH",
  },
  {
    name: "Basic Attack",
    inputKey: "3",
    gesture: "quick_f2",
    sequence: [step("X", "low", { echoHits: { count: 2, windowMs: 170 } })],
    enabled: true,
  },
  // 3 long_toggle: none

  // ==========================================================================
  // KEY: 4
  // ==========================================================================
  {
    name: "Interrupt",
    inputKey: "4",
    gesture: "quick",
    sequence: [step("K", "low", { echoHits: { count: 2, windowMs: 170 } })],
    enabled: true,
  },
  // 4 long: removed (Close Enemy+Cog+Interrupt removed; use 4+7 combo for Close Enemy+Interrupt)
  {
    name: "Force Choke",
    inputKey: "4",
    gesture: "quick_toggle",
    sequence: [step("DELETE", "low")],
    enabled: true,
    actionId: "FORCE_CHOKE",
  },
  // 4 long_toggle: removed (Electro Stun Grenade moved to 4 F2)
  {
    name: "Electro Stun Grenade",
    inputKey: "4",
    gesture: "quick_f2",
    sequence: [step("ALT+-", "low")],
    enabled: true,
    actionId: "ELECTRO_STUN",
  },

  // ==========================================================================
  // KEY: 5
  // ==========================================================================
  {
    name: "Vicious Throw",
    inputKey: "5",
    gesture: "quick",
    sequence: [step("[", "low", { echoHits: { count: 2, windowMs: 170 } })],
    enabled: true,
    actionId: "VICIOUS_THROW",
  },
  // 5 long: removed (Basic Attack removed from Tank 5)
  {
    name: "Backhand",
    inputKey: "5",
    gesture: "quick_toggle",
    sequence: [step("BACKSPACE", "low")],
    enabled: true,
    actionId: "BACKHAND",
  },
  // 5 q_toggle: removed (Smash moved to 3 long)
  // 5 long_toggle: removed (Seismic Grenade moved to 6 F2)
  {
    name: "Saber Throw",
    inputKey: "5",
    gesture: "quick_f2",
    sequence: [
      step("SHIFT+M", "low", { echoHits: { count: 2, windowMs: 170 } }),
    ],
    enabled: true,
    actionId: "SABER_THROW",
  },
  {
    name: "Gun + Focus Mod + Saber Throw",
    inputKey: "5",
    gesture: "long_f2",
    sequence: [
      step("/", "low", { name: "Gun icon" }),
      holdModifier("7", 107, 128),
      step("SHIFT+M", "low", { echoHits: { count: 3, windowMs: 170 } }),
    ],
    enabled: true,
    actionId: "SABER_THROW",
  },

  // ==========================================================================
  // KEY: 6 (Custom toggle thresholds: 415ms normal, 320ms toggled)
  // ==========================================================================
  {
    name: "Ravage",
    inputKey: "6",
    gesture: "quick",
    sequence: [step("ALT+J", "low", { echoHits: { count: 4, windowMs: 170 } })],
    enabled: true,
    actionId: "RAVAGE",
  },
  // 6 long: removed (Endure Pain moved to SPACEBAR)
  {
    name: "Force Push",
    inputKey: "6",
    gesture: "quick_toggle",
    sequence: [step("ALT+8", "low", { echoHits: { count: 2, windowMs: 170 } })],
    enabled: true,
    actionId: "FORCE_PUSH",
  },
  // 6 long_toggle: removed (Stun Break removed)
  {
    name: "Seismic Grenade",
    inputKey: "6",
    gesture: "quick_f2",
    sequence: [step("ALT+/", "low")],
    enabled: true,
    actionId: "SEISMIC_GRENADE",
  },
  // 6 q_toggle: removed (Seismic Grenade moved to 6 F2)

  // ==========================================================================
  // KEY: W (Toggle activator at 260ms)
  // ==========================================================================
  {
    name: "Close Enemy + Cog",
    inputKey: "W",
    gesture: "quick",
    sequence: [
      {
        key: "8",
        minDelay: 262,
        maxDelay: 348,
        echoHits: { count: 1, windowMs: 46 },
      },
      step("ALT+F9", "low"),
    ],
    enabled: true,
  },
  {
    name: "Next Friend + Cog",
    inputKey: "W",
    gesture: "quick_toggle",
    sequence: [
      { key: ".", minDelay: 262, maxDelay: 348 },
      step("ALT+F9", "low"),
    ],
    enabled: true,
  },
  // W long/long_toggle: none (becomes toggle activator)

  // ==========================================================================
  // KEY: Y (Toggle activator at 308ms)
  // ==========================================================================
  {
    name: "Next Target + Cog",
    inputKey: "Y",
    gesture: "quick",
    sequence: [
      { key: "V", minDelay: 262, maxDelay: 348 },
      step("ALT+F9", "low"),
    ],
    enabled: true,
  },
  {
    name: "Close Friend + Cog",
    inputKey: "Y",
    gesture: "quick_toggle",
    sequence: [
      { key: "'", minDelay: 262, maxDelay: 348 },
      step("ALT+F9", "low"),
    ],
    enabled: true,
  },
  // Y long/long_toggle: none (becomes toggle activator)

  // ==========================================================================
  // KEY: A
  // ==========================================================================
  {
    name: "Leap",
    inputKey: "A",
    gesture: "quick",
    sequence: [step("F9", "low", { echoHits: { count: 2, windowMs: 170 } })],
    enabled: true,
    actionId: "FORCE_LEAP",
  },
  // A long: removed (Single Taunt moved to quick_toggle)
  {
    name: "Single Taunt",
    inputKey: "A",
    gesture: "quick_toggle",
    sequence: [step("F6", "low", { echoHits: { count: 2, windowMs: 170 } })],
    enabled: true,
  },
  {
    name: "Gun + Focus Mod + Single Taunt",
    inputKey: "A",
    gesture: "long_toggle",
    sequence: [
      step("/", "low", { name: "Gun icon" }),
      holdModifier("7", 107, 128),
      step("F6", "low", { echoHits: { count: 3, windowMs: 170 } }),
    ],
    enabled: true,
  },

  // ==========================================================================
  // KEY: S (Dual-purpose: quick=Guard, long=Group Member Toggle)
  // Group member toggle intercepts handled by detector
  // ==========================================================================
  {
    name: "Guard + Shield",
    inputKey: "S",
    gesture: "quick",
    sequence: [
      { key: "L", bufferTier: "low", name: "Guard" },
      step("\\", "low", { name: "Shield icon" }),
    ],
    enabled: true,
    actionId: "GUARD",
  },
  // S long: Group Member Toggle (handled by detector, not a binding)
  // S quick_toggle / long_toggle: S ignores W/Y toggle system

  // ==========================================================================
  // KEY: D (Retaliate Accumulator - handled by detector)
  // No bindings needed - D key behavior is fully in omegaGestureDetector.ts
  // ==========================================================================

  // ==========================================================================
  // KEY: B - ALL BINDINGS REMOVED
  // ==========================================================================
  // B quick: removed (Medpack)
  // B long: removed (Endure Pain + Drop + Medpack)
  // B quick_toggle: removed (Adrenal)
  // B long_toggle: none

  // ==========================================================================
  // KEY: I
  // ==========================================================================
  {
    name: "Relic",
    inputKey: "I",
    gesture: "quick",
    sequence: [step("SHIFT+X", "low")],
    enabled: true,
  },
  // I long: removed (Relic is now quick only)
  {
    name: "Gun + Focus Mod + Single Taunt",
    inputKey: "I",
    gesture: "quick_toggle",
    sequence: [
      step("/", "low", { name: "Gun icon" }),
      holdModifier("7"),
      step("F6", "low"),
    ],
    enabled: true,
  },
  {
    name: "Mass Taunt + Gun + Focus Mod + Single Taunt + Enrage",
    inputKey: "I",
    gesture: "quick_f2",
    sequence: [
      step("F7", "low", { name: "Mass Taunt" }),
      step("/", "low", { name: "Gun icon" }),
      holdModifier("7"),
      step("F6", "medium", { name: "Single Taunt (to focus)" }),
      // 2 extra mass taunts right before enrage (35-52ms holds, 80-120ms gaps)
      {
        key: "F7",
        minDelay: 1080,
        maxDelay: 1140,
        name: "Mass Taunt repeat 1 (pre-enrage)",
      },
      {
        key: "F7",
        minDelay: 80,
        maxDelay: 120,
        name: "Mass Taunt repeat 2 (pre-enrage)",
      },
      {
        key: "F8",
        minDelay: 80,
        maxDelay: 120,
        name: "Enrage",
        echoHits: { count: 2, windowMs: 170 },
      },
    ],
    enabled: true,
  },
  {
    name: "Mass Taunt + Gun + Focus Mod + Single Taunt + Enrage",
    inputKey: "I",
    gesture: "long_toggle",
    sequence: [
      step("F7", "low", { name: "Mass Taunt" }),
      step("/", "low", { name: "Gun icon" }),
      holdModifier("7"),
      step("F6", "medium", { name: "Single Taunt (to focus)" }),
      // 2 extra mass taunts right before enrage (35-52ms holds, 80-120ms gaps)
      {
        key: "F7",
        minDelay: 1080,
        maxDelay: 1140,
        name: "Mass Taunt repeat 1 (pre-enrage)",
      },
      {
        key: "F7",
        minDelay: 80,
        maxDelay: 120,
        name: "Mass Taunt repeat 2 (pre-enrage)",
      },
      {
        key: "F8",
        minDelay: 80,
        maxDelay: 120,
        name: "Enrage",
        echoHits: { count: 2, windowMs: 170 },
      },
    ],
    enabled: true,
  },

  // ==========================================================================
  // KEY: T
  // ==========================================================================
  {
    name: "Previous Target + Cog",
    inputKey: "T",
    gesture: "quick",
    sequence: [
      { key: "ALT+]", minDelay: 262, maxDelay: 348 },
      step("ALT+F9", "low"),
    ],
    enabled: true,
  },
  {
    name: "Previous Friend + Cog",
    inputKey: "T",
    gesture: "long",
    sequence: [
      { key: "ALT+.", minDelay: 262, maxDelay: 348 },
      step("ALT+F9", "low"),
    ],
    enabled: true,
  },
  {
    name: "Target of Target + Cog",
    inputKey: "T",
    gesture: "quick_toggle",
    sequence: [
      { key: "M", minDelay: 262, maxDelay: 348 },
      step("ALT+F9", "low"),
    ],
    enabled: true,
  },
  {
    name: "Focus Target's Target of Target + Cog",
    inputKey: "T",
    gesture: "long_toggle",
    sequence: [
      { key: "J", minDelay: 262, maxDelay: 348 },
      step("ALT+F9", "low"),
    ],
    enabled: true,
  },

  // ==========================================================================
  // KEY: U
  // ==========================================================================
  {
    name: "Enraged Defense",
    inputKey: "U",
    gesture: "quick",
    sequence: [step("SHIFT+.", "low")],
    enabled: true,
  },
  // U long: removed (Invincible removed)
  {
    name: "Saber Ward",
    inputKey: "U",
    gesture: "quick_toggle",
    sequence: [step(",", "low")],
    enabled: true,
  },
  // U long_toggle: none

  // ==========================================================================
  // KEY: H (Intercede handled in-game, app sends Focus Mod + Single Taunt)
  // ==========================================================================
  {
    name: "Gun + Focus Mod + Single Taunt + Relic Two",
    inputKey: "H",
    gesture: "quick",
    sequence: [
      step("/", "low", { name: "Gun icon" }),
      holdModifier("7"),
      step("F6", "low"),
      step("ALT+X", "low"),
    ],
    enabled: true,
  },
  // H long, quick_toggle, long_toggle: none

  // ==========================================================================
  // KEY: C (Quick/Long + Double-tap ESCAPE)
  // Double-tap handled by detector's special output callback
  // ==========================================================================
  {
    name: "Burst Timer (13s)",
    inputKey: "C",
    gesture: "quick",
    sequence: [timerStep("burst", 13, "burst")],
    enabled: true,
  },
  {
    name: "Laze Timer (31s)",
    inputKey: "C",
    gesture: "long",
    sequence: [timerStep("laze", 31, "laze")],
    enabled: true,
  },
  {
    name: "Yield Timer (45s)",
    inputKey: "C",
    gesture: "quick_toggle",
    sequence: [timerStep("yield", 45, "yield")],
    enabled: true,
  },
  {
    name: "Fuel Timer (103s)",
    inputKey: "C",
    gesture: "long_toggle",
    sequence: [timerStep("fuel", 103, "fuel")],
    enabled: true,
  },
  // C double-tap: ESCAPE (handled by detector special key callback)

  // ==========================================================================
  // KEY: = (Gap-based only) - NO BINDINGS
  // ==========================================================================
  // = double-tap Smash: removed

  // ==========================================================================
  // KEY: F2 (Gap-based only)
  // ==========================================================================
  // F2 single: none
  // F2 double: none (no binding assigned yet)

  // ==========================================================================
  // KEY: MIDDLE_CLICK
  // ==========================================================================
  {
    name: "Max Zoom In + Delay + Scroll Out",
    inputKey: "MIDDLE_CLICK",
    gesture: "quick",
    sequence: [
      step("CTRL+V", "low", { name: "Max Zoom In" }),
      { minDelay: 420, maxDelay: 480, name: "Zoom delay" },
      scrollStep("down", 20),
    ],
    enabled: true,
  },
  {
    name: "Scroll In (20 ticks)",
    inputKey: "MIDDLE_CLICK",
    gesture: "long",
    sequence: [scrollStep("up", 20)],
    enabled: true,
  },
  // MIDDLE_CLICK quick_toggle / long_toggle: none
  // MIDDLE_CLICK double-tap: Max Zoom Out (would need detector support)

  // ==========================================================================
  // S TOGGLE BINDINGS (intercepted by detector, documented here for lookup)
  // ==========================================================================
  {
    name: "Target of Target + Cog (S Toggle)",
    inputKey: "5",
    gesture: "quick_s_toggle",
    sequence: [
      { key: "M", minDelay: 262, maxDelay: 348 },
      step("ALT+F9", "low"),
    ],
    enabled: true,
  },
  {
    name: "Focus ToT + Cog (S Toggle)",
    inputKey: "6",
    gesture: "quick_s_toggle",
    sequence: [
      { key: "J", minDelay: 262, maxDelay: 348 },
      step("ALT+F9", "low"),
    ],
    enabled: true,
  },
];

// ============================================================================
// BINDING LOOKUP BUILDER
// ============================================================================

/**
 * Build a lookup map for fast gestureâ†’binding resolution
 */
export function buildOmegaBindingLookup(
  bindings: OmegaBinding[] = OMEGA_BINDINGS,
): OmegaBindingLookup {
  const lookup: OmegaBindingLookup = new Map();

  for (const binding of bindings) {
    if (!binding.enabled) continue;

    let keyMap = lookup.get(binding.inputKey);
    if (!keyMap) {
      keyMap = new Map();
      lookup.set(binding.inputKey, keyMap);
    }

    keyMap.set(binding.gesture, binding);
  }

  return lookup;
}

/**
 * Get a binding for a specific key and gesture
 */
export function getOmegaBinding(
  lookup: OmegaBindingLookup,
  inputKey: InputKey,
  gesture: OmegaGestureType,
): OmegaBinding | null {
  const keyMap = lookup.get(inputKey);
  if (!keyMap) return null;
  return keyMap.get(gesture) ?? null;
}

/**
 * Convert OmegaBinding to MacroBinding for executor compatibility
 */
export function omegaBindingToMacro(binding: OmegaBinding): MacroBinding {
  const sequence: SequenceStep[] = binding.sequence.map((step) => {
    const result: SequenceStep = {
      key: step.key || "",
      minDelay: step.minDelay ?? 0,
      maxDelay: step.maxDelay ?? 0,
    };

    if (step.bufferTier) {
      result.bufferTier = step.bufferTier;
    }

    if (step.echoHits) {
      result.echoHits = step.echoHits;
    }

    if (step.holdThroughNext) {
      result.holdThroughNext = step.holdThroughNext;
      result.releaseDelayMin = step.releaseDelayMin;
      result.releaseDelayMax = step.releaseDelayMax;
    }

    if (step.timer) {
      // Timer steps use the timer field
      result.timer = step.timer;
    }

    if (step.scrollDirection) {
      result.scrollDirection = step.scrollDirection;
      result.scrollMagnitude = step.scrollMagnitude;
    }

    if (step.name) {
      result.name = step.name;
    }

    return result;
  });

  return {
    name: binding.name,
    sequence,
    enabled: binding.enabled,
    actionId: binding.actionId,
  };
}

// ============================================================================
// PROFILE EXPORT
// ============================================================================

/**
 * Export all bindings as a JSON profile
 */
export function exportOmegaProfile(): object {
  return {
    name: "SWTOR Vengeance Juggernaut - Omega Profile",
    description:
      "Omega gesture system with 4-gesture detection (quick/long/quick_toggle/long_toggle)",
    system: "omega",
    gestureSettings: {
      multiPressWindow: 355,
      debounceDelay: 10,
      cancelThreshold: 1500,
    },
    keyThresholds: {
      "1": 312,
      "2": 408,
      "3": 355,
      "4": 298,
      "5": 470,
      "6": { normal: 415, toggled: 320 },
      W: 260,
      A: 251,
      S: 512,
      B: 391,
      I: 597,
      Y: 308,
      U: 558,
      T: 238,
      C: 349,
      H: 452,
      MIDDLE_CLICK: 442,
    },
    specialKeys: {
      D: {
        type: "retaliate_accumulator",
        triggerKeys: ["E", "F", "G", ";", "1", "2", "3", "4", "5", "6"],
      },
      S: {
        type: "dual_purpose",
        quickThreshold: 512,
        longBehavior: "group_member_toggle",
      },
      C: { type: "hybrid", doubleWindow: 337, doubleOutput: "ESCAPE" },
      "=": { type: "gap_based", window: 419 },
      F2: { type: "gap_based", window: 307 },
    },
    toggleActivators: {
      W: { threshold: 260 },
      Y: { threshold: 308 },
    },
    bindings: [
      ...OMEGA_BINDINGS.map((b) => ({
        inputKey: b.inputKey,
        gesture: b.gesture,
        name: b.name,
        sequence: b.sequence,
        enabled: b.enabled,
        actionId: b.actionId,
      })),
      // Add 4+7 combo binding
      {
        inputKey: COMBO_7_4_BINDING.inputKey,
        gesture: COMBO_7_4_BINDING.gesture,
        name: COMBO_7_4_BINDING.name,
        sequence: COMBO_7_4_BINDING.sequence,
        enabled: COMBO_7_4_BINDING.enabled,
        actionId: COMBO_7_4_BINDING.actionId,
      },
    ],
  };
}

// ============================================================================
// STATISTICS
// ============================================================================

export function getOmegaStats(): {
  totalBindings: number;
  byKey: Record<string, number>;
  byGesture: Record<string, number>;
  gcdAbilities: string[];
} {
  const byKey: Record<string, number> = {};
  const byGesture: Record<string, number> = {};
  const gcdAbilities: string[] = [];

  for (const binding of OMEGA_BINDINGS) {
    byKey[binding.inputKey] = (byKey[binding.inputKey] || 0) + 1;
    byGesture[binding.gesture] = (byGesture[binding.gesture] || 0) + 1;

    if (binding.actionId && !gcdAbilities.includes(binding.actionId)) {
      gcdAbilities.push(binding.actionId);
    }
  }

  return {
    totalBindings: OMEGA_BINDINGS.length,
    byKey,
    byGesture,
    gcdAbilities,
  };
}

// ============================================================================
// 4+7 COMBO BINDING
// ============================================================================

/**
 * 4+7 Combo: Close Enemy + Interrupt
 * Triggered when key 4 is pressed during key 7 hold or within 420ms of release
 */
export const COMBO_7_4_BINDING: OmegaBinding = {
  name: "4+7 Combo: Close Enemy + Interrupt",
  inputKey: "4",
  gesture: "combo_7_4",
  sequence: [
    step("8", "low", { echoHits: { count: 1, windowMs: 46 } }), // Close Enemy with targeting echo
    step("K", "low"), // Interrupt
  ],
  enabled: true,
};

export default OMEGA_BINDINGS;
