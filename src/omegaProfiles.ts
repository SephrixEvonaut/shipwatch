// ============================================================================
// OMEGA PROFILES - Multi-Character Profile Definitions
// ============================================================================
//
// Each character profile provides:
// - Unique ability bindings for keys 1-6, A, S, I, U, H, B
// - Shared bindings (targeting, timers, zoom) inherited by all
// - D key mode: continuous_stream | burst_stream_slow | burst_stream_fast | single_press
// - S key quick ability (varies per profile)
//
// PROFILE KEYS:
//   T = Vengeance Juggernaut (Tank)     — D: continuous_stream
//   R = Rage Juggernaut                 — D: burst_stream_slow
//   S = Sorcerer Healer                 — D: single_press
//   M = Madness Sorcerer                — D: single_press
//   E = Engineering Sniper              — D: single_press
//   C = Combat Medic (Merc Heals)       — D: burst_stream_fast
//   A = Arsenal Mercenary               — D: burst_stream_fast
//
// ============================================================================

import {
  OmegaBinding,
  OmegaSequenceStep,
  step,
  targetWithCog,
  timerStep,
  holdModifier,
  scrollStep,
  OMEGA_BINDINGS,
} from "./omegaMappings.js";
import { InputKey } from "./types.js";

// ============================================================================
// TYPES
// ============================================================================

/** Profile selection key */
export type ProfileKey = "T" | "R" | "S" | "M" | "E" | "C" | "A";

/** D key behavior mode */
export type DKeyMode =
  | "continuous_stream"
  | "burst_stream_slow"
  | "burst_stream_fast"
  | "single_press";

/** Profile configuration */
export interface ProfileConfig {
  key: ProfileKey;
  name: string;
  shortName: string;
  dKeyMode: DKeyMode;
  sQuickAbility: string;
  /** For single_press D mode: the output key sent on D quick */
  dKeyOutput?: string;
  /** For profiles where S quick sends a direct key (not Guard dual-key) */
  sKeyQuickOutput?: string;
  bindings: OmegaBinding[];
}

// ============================================================================
// SHARED BINDINGS — Inherited by ALL profiles
// ============================================================================
// These bindings are identical across all 7 profiles: targeting (W/Y/T),
// S-toggle targeting (5/6), C timers, SPACEBAR, MIDDLE_CLICK

export const SHARED_BINDINGS: OmegaBinding[] = [
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
  // KEY: C (Quick/Long + Double-tap ESCAPE)
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

  // ==========================================================================
  // S TOGGLE BINDINGS (intercepted by detector, documented for lookup)
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
// T — VENGEANCE JUGGERNAUT (TANK)
// ============================================================================
// D key mode: continuous_stream (toggle on/off)
// S quick: Guard + Shield (L + \)
// Uses OMEGA_BINDINGS from omegaMappings.ts as the canonical Tank bindings

export const TANK_BINDINGS: OmegaBinding[] = OMEGA_BINDINGS;

// ============================================================================
// R — RAGE JUGGERNAUT
// ============================================================================
// D key mode: burst_stream_slow (3 Rs, 100-127ms gap, 5.6-6.8s cycle)
// S quick: SpaceJamProtection (ALT+V)

export const RAGE_BINDINGS: OmegaBinding[] = [
  ...SHARED_BINDINGS,

  // ==========================================================================
  // KEY: SPACEBAR — Endure Pain Drop Timer (Tank & Rage only)
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

  // KEY 1
  {
    name: "Furious Strike",
    inputKey: "1",
    gesture: "quick",
    sequence: [step("N", "low", { echoHits: { count: 2, windowMs: 170 } })],
    enabled: true,
  },
  {
    name: "Center Target + Cog",
    inputKey: "1",
    gesture: "long",
    sequence: targetWithCog("SHIFT+O"),
    enabled: true,
  },
  // 1 toggle: Furious Strike — instant-fire handles this (no long_toggle = instant on toggle quick)

  // KEY 2
  {
    name: "Force Scream",
    inputKey: "2",
    gesture: "quick",
    sequence: [step("O", "low", { echoHits: { count: 2, windowMs: 170 } })],
    enabled: true,
  },
  {
    name: "Sweeping Slash",
    inputKey: "2",
    gesture: "long",
    sequence: [
      step("SHIFT+J", "low", { echoHits: { count: 2, windowMs: 170 } }),
    ],
    enabled: true,
  },
  {
    name: "Raging Burst",
    inputKey: "2",
    gesture: "quick_toggle",
    sequence: [step("ALT+O", "low", { echoHits: { count: 3, windowMs: 170 } })],
    enabled: true,
  },

  // KEY 3
  {
    name: "Sundering Strike",
    inputKey: "3",
    gesture: "quick",
    sequence: [step("Z", "low", { echoHits: { count: 2, windowMs: 170 } })],
    enabled: true,
  },
  {
    name: "Smash",
    inputKey: "3",
    gesture: "long",
    sequence: [step("]", "low", { echoHits: { count: 2, windowMs: 170 } })],
    enabled: true,
  },
  {
    name: "Vicious Slash",
    inputKey: "3",
    gesture: "quick_toggle",
    sequence: [step("ALT+[", "low")],
    enabled: true,
  },
  {
    name: "Ravage",
    inputKey: "3",
    gesture: "quick_f2",
    sequence: [
      step("SHIFT+K", "low", { echoHits: { count: 4, windowMs: 170 } }),
    ],
    enabled: true,
  },

  // KEY 4
  {
    name: "Interrupt",
    inputKey: "4",
    gesture: "quick",
    sequence: [step("K", "low", { echoHits: { count: 2, windowMs: 170 } })],
    enabled: true,
  },
  {
    name: "Force Choke",
    inputKey: "4",
    gesture: "quick_toggle",
    sequence: [step("DELETE", "low")],
    enabled: true,
  },
  {
    name: "Electro Stun Grenade",
    inputKey: "4",
    gesture: "quick_f2",
    sequence: [step("ALT+-", "low")],
    enabled: true,
  },

  // KEY 5
  {
    name: "Vicious Throw",
    inputKey: "5",
    gesture: "quick",
    sequence: [step("[", "low", { echoHits: { count: 2, windowMs: 170 } })],
    enabled: true,
  },
  {
    name: "Force Crush",
    inputKey: "5",
    gesture: "long",
    sequence: [step("SHIFT+Z", "low")],
    enabled: true,
  },
  {
    name: "Obliterate",
    inputKey: "5",
    gesture: "quick_toggle",
    sequence: [step("ALT+N", "low")],
    enabled: true,
  },
  {
    name: "Seismic Grenade",
    inputKey: "5",
    gesture: "long_toggle",
    sequence: [step("ALT+/", "low")],
    enabled: true,
  },
  {
    name: "Saber Throw",
    inputKey: "5",
    gesture: "quick_f2",
    sequence: [
      step("SHIFT+N", "low", { echoHits: { count: 2, windowMs: 170 } }),
    ],
    enabled: true,
  },
  {
    name: "Focus Mod + Saber Throw",
    inputKey: "5",
    gesture: "long_f2",
    sequence: [holdModifier("7"), step("SHIFT+N", "low")],
    enabled: true,
  },

  // KEY 6
  {
    name: "Retaliation",
    inputKey: "6",
    gesture: "quick",
    sequence: [step("R", "low", { echoHits: { count: 2, windowMs: 170 } })],
    enabled: true,
  },
  {
    name: "Force Push",
    inputKey: "6",
    gesture: "quick_toggle",
    sequence: [step("ALT+L", "low", { echoHits: { count: 2, windowMs: 170 } })],
    enabled: true,
  },
  {
    name: "Seismic Grenade (6F2)",
    inputKey: "6",
    gesture: "quick_f2",
    sequence: [step("ALT+/", "low")],
    enabled: true,
  },

  // KEY A
  {
    name: "Leap",
    inputKey: "A",
    gesture: "quick",
    sequence: [step("F9", "low", { echoHits: { count: 2, windowMs: 170 } })],
    enabled: true,
  },
  {
    name: "Single Taunt",
    inputKey: "A",
    gesture: "quick_toggle",
    sequence: [step("F6", "low", { echoHits: { count: 2, windowMs: 170 } })],
    enabled: true,
  },
  {
    name: "Focus Mod + Single Taunt",
    inputKey: "A",
    gesture: "long_toggle",
    sequence: [holdModifier("7"), step("F6", "low")],
    enabled: true,
  },

  // KEY S
  {
    name: "SpaceJamProtection",
    inputKey: "S",
    gesture: "quick",
    sequence: [step("ALT+V", "low")],
    enabled: true,
  },

  // KEY U
  {
    name: "Enraged Defense",
    inputKey: "U",
    gesture: "quick",
    sequence: [step("SHIFT+.", "low")],
    enabled: true,
  },
  {
    name: "Saber Ward",
    inputKey: "U",
    gesture: "quick_toggle",
    sequence: [step(",", "low")],
    enabled: true,
  },

  // KEY I
  {
    name: "Relic",
    inputKey: "I",
    gesture: "quick",
    sequence: [step("SHIFT+X", "low")],
    enabled: true,
  },
  {
    name: "Enrage",
    inputKey: "I",
    gesture: "quick_toggle",
    sequence: [step("F8", "low", { echoHits: { count: 3, windowMs: 170 } })],
    enabled: true,
  },
  // I long_toggle: removed (Enrage moved to quick_toggle)

  // KEY H
  {
    name: "Focus Mod + Taunt + Relic 2",
    inputKey: "H",
    gesture: "quick",
    sequence: [holdModifier("7"), step("F6", "low"), step("ALT+X", "low")],
    enabled: true,
  },
];

// ============================================================================
// S — SORCERER HEALER
// ============================================================================
// D key mode: single_press (D quick = Self Heal → ALT+O)
// S quick: Cleanse (ALT+Z) — via sKeyQuickOutput or S binding

export const SORC_HEAL_BINDINGS: OmegaBinding[] = [
  ...SHARED_BINDINGS,

  // KEY 1
  {
    name: "Resurgence",
    inputKey: "1",
    gesture: "quick",
    sequence: [step("N", "low", { echoHits: { count: 2, windowMs: 170 } })],
    enabled: true,
  },
  {
    name: "Close Friend + Cog",
    inputKey: "1",
    gesture: "long",
    sequence: targetWithCog("'"),
    enabled: true,
  },
  {
    name: "Innervate",
    inputKey: "1",
    gesture: "quick_toggle",
    sequence: [step("ALT+N", "low", { echoHits: { count: 2, windowMs: 170 } })],
    enabled: true,
  },
  {
    name: "Affliction",
    inputKey: "1",
    gesture: "quick_f2",
    sequence: [step("F1", "low", { echoHits: { count: 2, windowMs: 170 } })],
    enabled: true,
  },

  // KEY 2
  {
    name: "Revivification",
    inputKey: "2",
    gesture: "quick",
    sequence: [step("O", "low", { echoHits: { count: 2, windowMs: 170 } })],
    enabled: true,
  },
  {
    name: "Roaming Mend",
    inputKey: "2",
    gesture: "quick_toggle",
    sequence: [step("F3", "low", { echoHits: { count: 2, windowMs: 170 } })],
    enabled: true,
  },
  {
    name: "Knockback",
    inputKey: "2",
    gesture: "quick_f2",
    sequence: [step("SHIFT+F3", "low")],
    enabled: true,
  },

  // KEY 3
  {
    name: "Rally",
    inputKey: "3",
    gesture: "quick",
    sequence: [step("Z", "low", { echoHits: { count: 2, windowMs: 170 } })],
    enabled: true,
  },
  {
    name: "Consume Darkness",
    inputKey: "3",
    gesture: "quick_toggle",
    sequence: [
      step("BACKSPACE", "low"),
      timerStep("drink", 8, "Drink"),
    ],
    enabled: true,
  },
  {
    name: "Crushing Darkness",
    inputKey: "3",
    gesture: "quick_f2",
    sequence: [step("F5", "low")],
    enabled: true,
  },

  // KEY 4
  {
    name: "Interrupt",
    inputKey: "4",
    gesture: "quick",
    sequence: [step("K", "low", { echoHits: { count: 2, windowMs: 170 } })],
    enabled: true,
  },
  {
    name: "Electrocute",
    inputKey: "4",
    gesture: "quick_toggle",
    sequence: [step("DELETE", "low")],
    enabled: true,
  },
  {
    name: "Electro Grenade",
    inputKey: "4",
    gesture: "quick_f2",
    sequence: [step("ALT+-", "low")],
    enabled: true,
  },
  {
    name: "Shock",
    inputKey: "4",
    gesture: "quick_q_toggle",
    sequence: [step("ALT+K", "low")],
    enabled: true,
  },

  // KEY 5
  {
    name: "Roaming Mend",
    inputKey: "5",
    gesture: "quick",
    sequence: [step("F3", "low", { echoHits: { count: 2, windowMs: 170 } })],
    enabled: true,
  },
  {
    name: "Dark Heal",
    inputKey: "5",
    gesture: "quick_toggle",
    sequence: [
      step("SHIFT+J", "low", { echoHits: { count: 2, windowMs: 170 } }),
    ],
    enabled: true,
  },
  {
    name: "Force Lightning",
    inputKey: "5",
    gesture: "quick_f2",
    sequence: [step("SHIFT+L", "low")],
    enabled: true,
  },
  // Q+5 = Target DPS 1 (dynamic — handled in gesture dispatch)

  // KEY 6
  {
    name: "Static Barrier",
    inputKey: "6",
    gesture: "quick",
    sequence: [
      step("SHIFT+K", "low", { echoHits: { count: 2, windowMs: 170 } }),
    ],
    enabled: true,
  },
  {
    name: "Sorcerer Pull",
    inputKey: "6",
    gesture: "quick_toggle",
    sequence: [step("ALT+L", "low")],
    enabled: true,
  },
  {
    name: "Seismic Grenade",
    inputKey: "6",
    gesture: "quick_f2",
    sequence: [step("ALT+/", "low")],
    enabled: true,
  },
  // Q+6 = Target DPS 2 (dynamic)

  // KEY A
  {
    name: "Force Speed",
    inputKey: "A",
    gesture: "quick",
    sequence: [step("F6", "low", { echoHits: { count: 2, windowMs: 170 } })],
    enabled: true,
  },

  // KEY S — Cleanse
  {
    name: "Cleanse",
    inputKey: "S",
    gesture: "quick",
    sequence: [step("ALT+Z", "low")],
    enabled: true,
  },

  // KEY D — single press
  {
    name: "Self Heal",
    inputKey: "D",
    gesture: "quick",
    sequence: [step("ALT+O", "low")],
    enabled: true,
  },

  // KEY U
  {
    name: "Cloud Mind (U)",
    inputKey: "U",
    gesture: "quick",
    sequence: [step("[", "low")],
    enabled: true,
  },
  {
    name: "Barrier",
    inputKey: "U",
    gesture: "quick_toggle",
    sequence: [step(",", "low")],
    enabled: true,
  },

  // KEY I
  {
    name: "Polarity Shift",
    inputKey: "I",
    gesture: "quick",
    sequence: [step("SHIFT+X", "low")],
    enabled: true,
  },
  {
    name: "Relic",
    inputKey: "I",
    gesture: "quick_toggle",
    sequence: [step("SHIFT+V", "low")],
    enabled: true,
  },
];

// ============================================================================
// M — MADNESS SORCERER
// ============================================================================
// D key mode: single_press (D quick = Self Heal → ALT+O)
// S quick: Cleanse (ALT+Z) — via sKeyQuickOutput or S binding

export const SORC_MAD_BINDINGS: OmegaBinding[] = [
  ...SHARED_BINDINGS,

  // KEY 1
  {
    name: "Affliction",
    inputKey: "1",
    gesture: "quick",
    sequence: [step("N", "low", { echoHits: { count: 2, windowMs: 170 } })],
    enabled: true,
  },
  {
    name: "Close Friend + Cog",
    inputKey: "1",
    gesture: "long",
    sequence: targetWithCog("'"),
    enabled: true,
  },
  {
    name: "Force Lightning (1 toggle)",
    inputKey: "1",
    gesture: "quick_toggle",
    sequence: [
      step("SHIFT+L", "low", { echoHits: { count: 2, windowMs: 170 } }),
    ],
    enabled: true,
  },
  {
    name: "Resurgence",
    inputKey: "1",
    gesture: "quick_f2",
    sequence: [step("F1", "low", { echoHits: { count: 2, windowMs: 170 } })],
    enabled: true,
  },

  // KEY 2
  {
    name: "Creeping Terror",
    inputKey: "2",
    gesture: "quick",
    sequence: [step("O", "low", { echoHits: { count: 2, windowMs: 170 } })],
    enabled: true,
  },
  {
    name: "Force Storm",
    inputKey: "2",
    gesture: "quick_toggle",
    sequence: [step("F3", "low", { echoHits: { count: 2, windowMs: 170 } })],
    enabled: true,
  },
  {
    name: "Knockback",
    inputKey: "2",
    gesture: "quick_f2",
    sequence: [step("SHIFT+F3", "low")],
    enabled: true,
  },

  // KEY 3
  {
    name: "Death Field",
    inputKey: "3",
    gesture: "quick",
    sequence: [step("Z", "low", { echoHits: { count: 2, windowMs: 170 } })],
    enabled: true,
  },
  {
    name: "Force Leech",
    inputKey: "3",
    gesture: "quick_toggle",
    sequence: [
      step("SHIFT+J", "low", { echoHits: { count: 2, windowMs: 170 } }),
    ],
    enabled: true,
  },
  {
    name: "Consume Darkness",
    inputKey: "3",
    gesture: "quick_f2",
    sequence: [step("F5", "low")],
    enabled: true,
  },

  // KEY 4 — identical to Sorc Heals
  {
    name: "Interrupt",
    inputKey: "4",
    gesture: "quick",
    sequence: [step("K", "low", { echoHits: { count: 2, windowMs: 170 } })],
    enabled: true,
  },
  {
    name: "Electrocute",
    inputKey: "4",
    gesture: "quick_toggle",
    sequence: [step("DELETE", "low")],
    enabled: true,
  },
  {
    name: "Electro Grenade",
    inputKey: "4",
    gesture: "quick_f2",
    sequence: [step("ALT+-", "low")],
    enabled: true,
  },
  {
    name: "Shock",
    inputKey: "4",
    gesture: "quick_q_toggle",
    sequence: [step("ALT+K", "low")],
    enabled: true,
  },

  // KEY 5
  {
    name: "Cloud Mind",
    inputKey: "5",
    gesture: "quick",
    sequence: [step("[", "low", { echoHits: { count: 2, windowMs: 170 } })],
    enabled: true,
  },
  {
    name: "Demolish",
    inputKey: "5",
    gesture: "quick_toggle",
    sequence: [step("BACKSPACE", "low")],
    enabled: true,
  },
  {
    name: "Force Lightning (5 F2)",
    inputKey: "5",
    gesture: "quick_f2",
    sequence: [step("SHIFT+L", "low")],
    enabled: true,
  },

  // KEY 6
  {
    name: "Static Barrier",
    inputKey: "6",
    gesture: "quick",
    sequence: [
      step("SHIFT+K", "low", { echoHits: { count: 2, windowMs: 170 } }),
    ],
    enabled: true,
  },
  {
    name: "Sorcerer Pull",
    inputKey: "6",
    gesture: "quick_toggle",
    sequence: [step("ALT+L", "low")],
    enabled: true,
  },
  {
    name: "Seismic Grenade",
    inputKey: "6",
    gesture: "quick_f2",
    sequence: [step("ALT+/", "low")],
    enabled: true,
  },

  // KEY A
  {
    name: "Force Speed",
    inputKey: "A",
    gesture: "quick",
    sequence: [step("F9", "low", { echoHits: { count: 2, windowMs: 170 } })],
    enabled: true,
  },

  // KEY S — Cleanse
  {
    name: "Cleanse",
    inputKey: "S",
    gesture: "quick",
    sequence: [step("ALT+Z", "low")],
    enabled: true,
  },

  // KEY D
  {
    name: "Self Heal",
    inputKey: "D",
    gesture: "quick",
    sequence: [step("ALT+O", "low")],
    enabled: true,
  },

  // KEY U
  {
    name: "Force Speed (U)",
    inputKey: "U",
    gesture: "quick",
    sequence: [step("SHIFT+.", "low")],
    enabled: true,
  },
  {
    name: "Barrier",
    inputKey: "U",
    gesture: "quick_toggle",
    sequence: [step(",", "low")],
    enabled: true,
  },

  // KEY I
  {
    name: "Polarity Shift",
    inputKey: "I",
    gesture: "quick",
    sequence: [step("SHIFT+X", "low")],
    enabled: true,
  },
  {
    name: "Relic",
    inputKey: "I",
    gesture: "quick_toggle",
    sequence: [step("SHIFT+V", "low")],
    enabled: true,
  },

  // KEY H
  {
    name: "Recklessness",
    inputKey: "H",
    gesture: "quick",
    sequence: [step("SHIFT+R", "low")],
    enabled: true,
  },

  // KEY B
  {
    name: "Phase Walk / Voltaic Slash / Whirlwind",
    inputKey: "B",
    gesture: "quick",
    sequence: [step("]", "low")],
    enabled: true,
  },
];

// ============================================================================
// E — ENGINEERING SNIPER
// ============================================================================
// D key mode: single_press (D quick = Shield Probe → R)
// S quick: Met Prep (SHIFT+V)

export const ENGI_BINDINGS: OmegaBinding[] = [
  ...SHARED_BINDINGS,

  // KEY 1
  {
    name: "Snipe",
    inputKey: "1",
    gesture: "quick",
    sequence: [step("N", "low", { echoHits: { count: 2, windowMs: 170 } })],
    enabled: true,
  },
  {
    name: "Center Target + Cog",
    inputKey: "1",
    gesture: "long",
    sequence: targetWithCog("SHIFT+O"),
    enabled: true,
  },
  {
    name: "Series of Shots",
    inputKey: "1",
    gesture: "quick_toggle",
    sequence: [step("ALT+N", "low", { echoHits: { count: 2, windowMs: 170 } })],
    enabled: true,
  },
  {
    name: "Corrosive Dart",
    inputKey: "1",
    gesture: "quick_f2",
    sequence: [step("F1", "low", { echoHits: { count: 4, windowMs: 170 } })],
    enabled: true,
  },

  // KEY 2
  {
    name: "Crouch",
    inputKey: "2",
    gesture: "quick",
    sequence: [step("O", "low", { echoHits: { count: 3, windowMs: 170 } })],
    enabled: true,
  },
  {
    name: "Crouch 2",
    inputKey: "2",
    gesture: "quick_toggle",
    sequence: [step("F3", "low", { echoHits: { count: 2, windowMs: 170 } })],
    enabled: true,
  },
  {
    name: "Entrench",
    inputKey: "2",
    gesture: "quick_f2",
    sequence: [step("SHIFT+F3", "low")],
    enabled: true,
  },

  // KEY 3
  {
    name: "Interrogation Probe",
    inputKey: "3",
    gesture: "quick",
    sequence: [step("Z", "low", { echoHits: { count: 2, windowMs: 170 } })],
    enabled: true,
  },
  {
    name: "Basic Attack",
    inputKey: "3",
    gesture: "long",
    sequence: [step("8", "low", { echoHits: { count: 2, windowMs: 170 } })],
    enabled: true,
  },
  {
    name: "Plasma Probe",
    inputKey: "3",
    gesture: "quick_toggle",
    sequence: [
      step("SHIFT+J", "low", { echoHits: { count: 2, windowMs: 170 } }),
    ],
    enabled: true,
  },
  {
    name: "Laze Target",
    inputKey: "3",
    gesture: "quick_f2",
    sequence: [step("F5", "low")],
    enabled: true,
  },

  // KEY 4
  {
    name: "Interrupt",
    inputKey: "4",
    gesture: "quick",
    sequence: [step("K", "low", { echoHits: { count: 4, windowMs: 170 } })],
    enabled: true,
  },
  {
    name: "EMP Discharge",
    inputKey: "4",
    gesture: "quick_toggle",
    sequence: [step("DELETE", "low")],
    enabled: true,
  },
  {
    name: "Sabotage",
    inputKey: "4",
    gesture: "quick_f2",
    sequence: [step("ALT+-", "low")],
    enabled: true,
  },
  {
    name: "Electro Stun",
    inputKey: "4",
    gesture: "quick_q_toggle",
    sequence: [step("ALT+K", "low")],
    enabled: true,
  },

  // KEY 5
  {
    name: "Frag Grenade",
    inputKey: "5",
    gesture: "quick",
    sequence: [step("[", "low", { echoHits: { count: 2, windowMs: 170 } })],
    enabled: true,
  },
  {
    name: "Suppressive Fire",
    inputKey: "5",
    gesture: "quick_toggle",
    sequence: [step("]", "low")],
    enabled: true,
  },
  {
    name: "Orbital Strike",
    inputKey: "5",
    gesture: "quick_f2",
    sequence: [step("SHIFT+L", "low")],
    enabled: true,
  },

  // KEY 6
  {
    name: "Knockback",
    inputKey: "6",
    gesture: "quick",
    sequence: [step("F7", "low", { echoHits: { count: 2, windowMs: 170 } })],
    enabled: true,
  },
  {
    name: "Maim / Ballistic Shield",
    inputKey: "6",
    gesture: "quick_toggle",
    sequence: [step(",", "low", { echoHits: { count: 2, windowMs: 170 } })],
    enabled: true,
  },
  {
    name: "Diversion",
    inputKey: "6",
    gesture: "quick_f2",
    sequence: [step("ALT+Z", "low")],
    enabled: true,
  },

  // KEY A
  {
    name: "Roll",
    inputKey: "A",
    gesture: "quick",
    sequence: [step("F9", "low", { echoHits: { count: 2, windowMs: 170 } })],
    enabled: true,
  },
  {
    name: "Leg Shot",
    inputKey: "A",
    gesture: "quick_toggle",
    sequence: [step("BACKSPACE", "low")],
    enabled: true,
  },
  {
    name: "Focus Mod + Single Taunt",
    inputKey: "A",
    gesture: "long_toggle",
    sequence: [holdModifier("7"), step("F6", "low")],
    enabled: true,
  },

  // KEY S — Met Prep
  {
    name: "Met Prep",
    inputKey: "S",
    gesture: "quick",
    sequence: [
      step("SHIFT+V", "low", { echoHits: { count: 3, windowMs: 170 } }),
    ],
    enabled: true,
  },

  // KEY D — single press
  {
    name: "Shield Probe",
    inputKey: "D",
    gesture: "quick",
    sequence: [step("R", "low")],
    enabled: true,
  },

  // KEY U
  {
    name: "Evasion",
    inputKey: "U",
    gesture: "quick",
    sequence: [step("SHIFT+.", "low")],
    enabled: true,
  },

  // KEY I
  {
    name: "Relic",
    inputKey: "I",
    gesture: "quick",
    sequence: [step("F8", "low")],
    enabled: true,
  },

  // KEY H
  {
    name: "Reload Ammo",
    inputKey: "H",
    gesture: "quick",
    sequence: [step("ALT+X", "low")],
    enabled: true,
  },
];

// ============================================================================
// C — COMBAT MEDIC (MERC HEALS)
// ============================================================================
// D key mode: burst_stream_fast (3 Rs, 100-127ms gap, 3.6-4.2s cycle)
// S quick: Cleanse (ALT+Z)

export const COMBAT_MED_BINDINGS: OmegaBinding[] = [
  ...SHARED_BINDINGS,

  // KEY 1
  {
    name: "Kolto Shot",
    inputKey: "1",
    gesture: "quick",
    sequence: [step("N", "low", { echoHits: { count: 2, windowMs: 170 } })],
    enabled: true,
  },
  {
    name: "Successive Treatment",
    inputKey: "1",
    gesture: "quick_toggle",
    sequence: [step("ALT+N", "low", { echoHits: { count: 2, windowMs: 170 } })],
    enabled: true,
  },
  {
    name: "Sticky Grenade",
    inputKey: "1",
    gesture: "quick_f2",
    sequence: [step("F1", "low", { echoHits: { count: 2, windowMs: 170 } })],
    enabled: true,
  },

  // KEY 2
  {
    name: "Bacta Infusion",
    inputKey: "2",
    gesture: "quick",
    sequence: [step("O", "low", { echoHits: { count: 2, windowMs: 170 } })],
    enabled: true,
  },
  {
    name: "Plasma Grenade",
    inputKey: "2",
    gesture: "quick_toggle",
    sequence: [step("F3", "low", { echoHits: { count: 2, windowMs: 170 } })],
    enabled: true,
  },
  {
    name: "Full Auto",
    inputKey: "2",
    gesture: "quick_f2",
    sequence: [step("SHIFT+F3", "low")],
    enabled: true,
  },

  // KEY 3
  {
    name: "Advanced Medical Probe",
    inputKey: "3",
    gesture: "quick",
    sequence: [step("Z", "low", { echoHits: { count: 2, windowMs: 170 } })],
    enabled: true,
  },
  {
    name: "Medical Probe",
    inputKey: "3",
    gesture: "quick_toggle",
    sequence: [
      step("SHIFT+J", "low", { echoHits: { count: 2, windowMs: 170 } }),
    ],
    enabled: true,
  },
  {
    name: "Charge Bolts",
    inputKey: "3",
    gesture: "quick_f2",
    sequence: [step("F5", "low")],
    enabled: true,
  },
  {
    name: "High Impact Bolt",
    inputKey: "3",
    gesture: "quick_q_toggle",
    sequence: [step("ALT+J", "low")],
    enabled: true,
  },

  // KEY 4
  {
    name: "Interrupt",
    inputKey: "4",
    gesture: "quick",
    sequence: [step("K", "low", { echoHits: { count: 2, windowMs: 170 } })],
    enabled: true,
  },
  {
    name: "Knockback",
    inputKey: "4",
    gesture: "quick_toggle",
    sequence: [step("DELETE", "low")],
    enabled: true,
  },
  {
    name: "Electro Stun",
    inputKey: "4",
    gesture: "quick_f2",
    sequence: [step("ALT+-", "low")],
    enabled: true,
  },
  {
    name: "Explosive Round",
    inputKey: "4",
    gesture: "quick_q_toggle",
    sequence: [step("ALT+K", "low")],
    enabled: true,
  },

  // KEY 5
  {
    name: "Kolto Bomb",
    inputKey: "5",
    gesture: "quick",
    sequence: [step("[", "low", { echoHits: { count: 2, windowMs: 170 } })],
    enabled: true,
  },
  {
    name: "Mortar Volley",
    inputKey: "5",
    gesture: "quick_toggle",
    sequence: [step("BACKSPACE", "low")],
    enabled: true,
  },
  {
    name: "Net",
    inputKey: "5",
    gesture: "quick_f2",
    sequence: [step("SHIFT+L", "low")],
    enabled: true,
  },

  // KEY 6
  {
    name: "Trauma Probe",
    inputKey: "6",
    gesture: "quick",
    sequence: [
      step("SHIFT+K", "low", { echoHits: { count: 2, windowMs: 170 } }),
    ],
    enabled: true,
  },
  {
    name: "Hydroserums",
    inputKey: "6",
    gesture: "quick_toggle",
    sequence: [step("ALT+L", "low", { echoHits: { count: 2, windowMs: 170 } })],
    enabled: true,
  },
  {
    name: "Seismic Mine",
    inputKey: "6",
    gesture: "quick_f2",
    sequence: [step("ALT+/", "low")],
    enabled: true,
  },

  // KEY B
  {
    name: "Concussive Missile",
    inputKey: "B",
    gesture: "quick",
    sequence: [step("SHIFT+[", "low")],
    enabled: true,
  },

  // KEY A
  {
    name: "React Shield",
    inputKey: "A",
    gesture: "quick",
    sequence: [step("F9", "low", { echoHits: { count: 2, windowMs: 170 } })],
    enabled: true,
  },
  {
    name: "Reflecto Guard",
    inputKey: "A",
    gesture: "quick_toggle",
    sequence: [step("F6", "low", { echoHits: { count: 2, windowMs: 170 } })],
    enabled: true,
  },

  // KEY S — Cleanse
  {
    name: "Cleanse",
    inputKey: "S",
    gesture: "quick",
    sequence: [step("ALT+Z", "low")],
    enabled: true,
  },

  // KEY U
  {
    name: "Adrenaline Rush",
    inputKey: "U",
    gesture: "quick",
    sequence: [step("SHIFT+.", "low")],
    enabled: true,
  },

  // KEY I
  {
    name: "Relic",
    inputKey: "I",
    gesture: "quick",
    sequence: [step("SHIFT+X", "low")],
    enabled: true,
  },
  {
    name: "Tech Override",
    inputKey: "I",
    gesture: "quick_toggle",
    sequence: [step("ALT+M", "low")],
    enabled: true,
  },
  {
    name: "Reload",
    inputKey: "I",
    gesture: "quick_f2",
    sequence: [step("ALT+\\", "low")],
    enabled: true,
  },

  // KEY H
  {
    name: "Chaff Flare",
    inputKey: "H",
    gesture: "quick",
    sequence: [step("SHIFT+]", "low")],
    enabled: true,
  },
];

// ============================================================================
// A — ARSENAL MERCENARY
// ============================================================================
// D key mode: burst_stream_fast (3 Rs, 100-127ms gap, 3.6-4.2s cycle)
// S quick: Cleanse (ALT+Z)

export const ARSENAL_BINDINGS: OmegaBinding[] = [
  ...SHARED_BINDINGS,

  // KEY 1
  {
    name: "Tracer Missile",
    inputKey: "1",
    gesture: "quick",
    sequence: [step("N", "low", { echoHits: { count: 2, windowMs: 170 } })],
    enabled: true,
  },
  {
    name: "Bolstorm",
    inputKey: "1",
    gesture: "quick_toggle",
    sequence: [step("ALT+N", "low", { echoHits: { count: 2, windowMs: 170 } })],
    enabled: true,
  },
  {
    name: "Sticky Grenade / Stealth Scan",
    inputKey: "1",
    gesture: "quick_f2",
    sequence: [step("F1", "low", { echoHits: { count: 2, windowMs: 170 } })],
    enabled: true,
  },
  {
    name: "Basic Attack",
    inputKey: "1",
    gesture: "quick_q_toggle",
    sequence: [step("X", "low", { echoHits: { count: 2, windowMs: 170 } })],
    enabled: true,
  },

  // KEY 2
  {
    name: "Bacta Infusion",
    inputKey: "2",
    gesture: "quick",
    sequence: [step("O", "low", { echoHits: { count: 2, windowMs: 170 } })],
    enabled: true,
  },
  {
    name: "Plasma Grenade",
    inputKey: "2",
    gesture: "quick_toggle",
    sequence: [step("F3", "low", { echoHits: { count: 2, windowMs: 170 } })],
    enabled: true,
  },
  {
    name: "Full Auto",
    inputKey: "2",
    gesture: "quick_f2",
    sequence: [step("SHIFT+F3", "low")],
    enabled: true,
  },

  // KEY 3
  {
    name: "Heatseeker Missile",
    inputKey: "3",
    gesture: "quick",
    sequence: [step("Z", "low", { echoHits: { count: 2, windowMs: 170 } })],
    enabled: true,
  },
  {
    name: "Med Probe",
    inputKey: "3",
    gesture: "quick_toggle",
    sequence: [
      step("SHIFT+J", "low", { echoHits: { count: 2, windowMs: 170 } }),
    ],
    enabled: true,
  },
  {
    name: "Priming Shot",
    inputKey: "3",
    gesture: "quick_f2",
    sequence: [step("F5", "low")],
    enabled: true,
  },
  {
    name: "High Impact Bolt",
    inputKey: "3",
    gesture: "quick_q_toggle",
    sequence: [step("ALT+J", "low")],
    enabled: true,
  },

  // KEY 4
  {
    name: "Interrupt",
    inputKey: "4",
    gesture: "quick",
    sequence: [step("K", "low", { echoHits: { count: 2, windowMs: 170 } })],
    enabled: true,
  },
  {
    name: "Knockback",
    inputKey: "4",
    gesture: "quick_toggle",
    sequence: [step("DELETE", "low")],
    enabled: true,
  },
  {
    name: "Electro Stun",
    inputKey: "4",
    gesture: "quick_f2",
    sequence: [step("ALT+-", "low")],
    enabled: true,
  },
  {
    name: "Relic 2",
    inputKey: "4",
    gesture: "quick_q_toggle",
    sequence: [step("ALT+F6", "low")],
    enabled: true,
  },

  // KEY 5
  {
    name: "Sweeping Gunfire",
    inputKey: "5",
    gesture: "quick",
    sequence: [step("[", "low", { echoHits: { count: 2, windowMs: 170 } })],
    enabled: true,
  },
  {
    name: "Mortar Volley",
    inputKey: "5",
    gesture: "quick_toggle",
    sequence: [step("BACKSPACE", "low")],
    enabled: true,
  },
  {
    name: "Net",
    inputKey: "5",
    gesture: "quick_f2",
    sequence: [step("SHIFT+L", "low")],
    enabled: true,
  },

  // KEY 6
  {
    name: "Explosive Round",
    inputKey: "6",
    gesture: "quick",
    sequence: [
      step("SHIFT+K", "low", { echoHits: { count: 2, windowMs: 170 } }),
    ],
    enabled: true,
  },
  {
    name: "Hydroserums",
    inputKey: "6",
    gesture: "quick_toggle",
    sequence: [step("ALT+L", "low", { echoHits: { count: 2, windowMs: 170 } })],
    enabled: true,
  },
  {
    name: "Seismic Mine",
    inputKey: "6",
    gesture: "quick_f2",
    sequence: [step("ALT+/", "low")],
    enabled: true,
  },

  // KEY B
  {
    name: "Concussive Missile",
    inputKey: "B",
    gesture: "quick",
    sequence: [step("SHIFT+[", "low")],
    enabled: true,
  },

  // KEY A
  {
    name: "React Shield",
    inputKey: "A",
    gesture: "quick",
    sequence: [step("F9", "low", { echoHits: { count: 2, windowMs: 170 } })],
    enabled: true,
  },
  {
    name: "Reflecto Guard",
    inputKey: "A",
    gesture: "quick_toggle",
    sequence: [step("F6", "low", { echoHits: { count: 2, windowMs: 170 } })],
    enabled: true,
  },

  // KEY S — Cleanse
  {
    name: "Cleanse",
    inputKey: "S",
    gesture: "quick",
    sequence: [step("ALT+Z", "low")],
    enabled: true,
  },

  // KEY U
  {
    name: "Adrenaline Rush",
    inputKey: "U",
    gesture: "quick",
    sequence: [step("SHIFT+.", "low")],
    enabled: true,
  },

  // KEY I
  {
    name: "Relic",
    inputKey: "I",
    gesture: "quick",
    sequence: [step("SHIFT+X", "low")],
    enabled: true,
  },
  {
    name: "Tech Override",
    inputKey: "I",
    gesture: "quick_toggle",
    sequence: [step("ALT+M", "low")],
    enabled: true,
  },
  {
    name: "Reload",
    inputKey: "I",
    gesture: "quick_f2",
    sequence: [step("ALT+\\", "low")],
    enabled: true,
  },

  // KEY H
  {
    name: "Chaff Flare",
    inputKey: "H",
    gesture: "quick",
    sequence: [step("SHIFT+]", "low")],
    enabled: true,
  },
];

// ============================================================================
// PROFILE REGISTRY
// ============================================================================

export const PROFILE_REGISTRY: Record<ProfileKey, ProfileConfig> = {
  T: {
    key: "T",
    name: "Vengeance Juggernaut (Tank)",
    shortName: "Tank",
    dKeyMode: "continuous_stream",
    sQuickAbility: "Guard (L bypass TC)",
    bindings: TANK_BINDINGS,
  },
  R: {
    key: "R",
    name: "Rage Juggernaut",
    shortName: "Rage",
    dKeyMode: "burst_stream_slow",
    dKeyOutput: "F7",
    sQuickAbility: "SpaceJamProtection",
    bindings: RAGE_BINDINGS,
  },
  S: {
    key: "S",
    name: "Sorc Heals",
    shortName: "Sorc Heal",
    dKeyMode: "single_press",
    dKeyOutput: "ALT+O",
    sQuickAbility: "Cleanse",
    sKeyQuickOutput: "ALT+Z",
    bindings: SORC_HEAL_BINDINGS,
  },
  M: {
    key: "M",
    name: "Sorc Madness",
    shortName: "Madness",
    dKeyMode: "single_press",
    dKeyOutput: "ALT+O",
    sQuickAbility: "Cleanse",
    sKeyQuickOutput: "ALT+Z",
    bindings: SORC_MAD_BINDINGS,
  },
  E: {
    key: "E",
    name: "Engineering Sniper",
    shortName: "Engi",
    dKeyMode: "single_press",
    dKeyOutput: "R",
    sQuickAbility: "Met Prep",
    sKeyQuickOutput: "SHIFT+V",
    bindings: ENGI_BINDINGS,
  },
  C: {
    key: "C",
    name: "Combat Medic",
    shortName: "CMedic",
    dKeyMode: "burst_stream_fast",
    sQuickAbility: "Cleanse",
    sKeyQuickOutput: "ALT+Z",
    bindings: COMBAT_MED_BINDINGS,
  },
  A: {
    key: "A",
    name: "Arsenal Mercenary",
    shortName: "Arsenal",
    dKeyMode: "burst_stream_fast",
    sQuickAbility: "Cleanse",
    sKeyQuickOutput: "ALT+Z",
    bindings: ARSENAL_BINDINGS,
  },
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/** Get profile config by key */
export function getProfileConfig(key: ProfileKey): ProfileConfig {
  return PROFILE_REGISTRY[key];
}

/** Get valid profile keys */
export function getValidProfileKeys(): ProfileKey[] {
  return Object.keys(PROFILE_REGISTRY) as ProfileKey[];
}

/** Get bindings for a profile (already includes SHARED_BINDINGS via spread) */
export function getProfileBindings(key: ProfileKey): OmegaBinding[] {
  const config = PROFILE_REGISTRY[key];
  if (key === "T") {
    // Tank uses OMEGA_BINDINGS from omegaMappings.ts which doesn't spread SHARED_BINDINGS
    // Merge shared bindings that don't conflict
    const profileKeys = new Set<string>();
    for (const binding of config.bindings) {
      profileKeys.add(`${binding.inputKey}:${binding.gesture}`);
    }
    const nonConflictingShared = SHARED_BINDINGS.filter(
      (b) => !profileKeys.has(`${b.inputKey}:${b.gesture}`),
    );
    return [...config.bindings, ...nonConflictingShared];
  }
  // All other profiles already include SHARED_BINDINGS via spread
  return config.bindings;
}
