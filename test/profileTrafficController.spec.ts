import { describe, it, expect, beforeEach, vi } from "vitest";
import { compileProfile, isConflictKey } from "../src/profileCompiler.js";
import { TrafficController } from "../src/trafficController.js";
import {
  GestureSettings,
  MacroProfile,
  CompiledProfile,
} from "../src/types.js";

// Mock robotjs — testing conundrum/traffic logic, not HID output
vi.mock("robotjs", () => ({
  default: {
    keyTap: vi.fn(),
    keyToggle: vi.fn(),
    setKeyboardDelay: vi.fn(),
  },
}));

// ============================================================================
// PROFILE-SPECIFIC TRAFFIC CONTROLLER & CONUNDRUM TESTS
// ============================================================================
//
// How the TC works (verified from trafficController.ts):
// 1. Non-conundrum keys → return immediately (no queue)
// 2. R key → always return immediately (hard bypass)
// 3. Conundrum key + modifier NOT held → return immediately (smart bypass)
// 4. Conundrum key + modifier held → enter queue → serialize via crossingKey
//    - The shouldWait loop blocks while crossingKey is non-null or we're
//      not first in queue — it does NOT poll modifier state
//    - Actual modifier protection comes from ensureCleanModifierState()
//      in the executor
//
// So to test blocking: fire two requests (both enter queue because modifier
// is held), first passes through queue and sets crossingKey, second blocks
// until first releases.
// ============================================================================

const DEFAULT_SETTINGS: GestureSettings = {
  multiPressWindow: 90,
  debounceDelay: 15,
  longPressMin: 90,
  longPressMax: 155,
  superLongMin: 156,
  superLongMax: 275,
  cancelThreshold: 276,
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================================================
// SORC HEALS — Full MacroProfile (actual output keys)
// ============================================================================

const SORC_HEALS_PROFILE: MacroProfile = {
  name: "Sorc Heals Traffic Test",
  description: "All output keys from SORC_HEAL_BINDINGS for conundrum analysis",
  gestureSettings: DEFAULT_SETTINGS,
  macros: [
    // SHARED
    {
      name: "SH_Close_Enemy_Cog",
      trigger: { key: "W", gesture: "single" },
      sequence: [{ key: "8" }, { key: "ALT+F9" }],
      enabled: true,
    },
    {
      name: "SH_Next_Friend_Cog",
      trigger: { key: "W", gesture: "double" },
      sequence: [{ key: "." }, { key: "ALT+F9" }],
      enabled: true,
    },
    {
      name: "SH_Next_Target_Cog",
      trigger: { key: "Y", gesture: "single" },
      sequence: [{ key: "V" }, { key: "ALT+F9" }],
      enabled: true,
    },
    {
      name: "SH_Close_Friend_Cog",
      trigger: { key: "Y", gesture: "double" },
      sequence: [{ key: "'" }, { key: "ALT+F9" }],
      enabled: true,
    },
    {
      name: "SH_Prev_Target_Cog",
      trigger: { key: "T", gesture: "single" },
      sequence: [{ key: "ALT+]" }, { key: "ALT+F9" }],
      enabled: true,
    },
    {
      name: "SH_Prev_Friend_Cog",
      trigger: { key: "T", gesture: "double" },
      sequence: [{ key: "ALT+." }, { key: "ALT+F9" }],
      enabled: true,
    },
    {
      name: "SH_ToT_Cog",
      trigger: { key: "T", gesture: "triple" },
      sequence: [{ key: "M" }, { key: "ALT+F9" }],
      enabled: true,
    },
    {
      name: "SH_Focus_ToT_Cog",
      trigger: { key: "T", gesture: "single_long" },
      sequence: [{ key: "J" }, { key: "ALT+F9" }],
      enabled: true,
    },
    {
      name: "SH_Zoom",
      trigger: { key: "MIDDLE_CLICK", gesture: "single" },
      sequence: [{ key: "CTRL+V" }],
      enabled: true,
    },
    // KEY 1
    {
      name: "SH_Resurgence",
      trigger: { key: "1", gesture: "single" },
      sequence: [{ key: "N" }],
      enabled: true,
    },
    {
      name: "SH_Close_Friend_1L",
      trigger: { key: "1", gesture: "single_long" },
      sequence: [{ key: "'" }, { key: "ALT+F9" }],
      enabled: true,
    },
    {
      name: "SH_Innervate",
      trigger: { key: "1", gesture: "double" },
      sequence: [{ key: "ALT+N" }],
      enabled: true,
    },
    {
      name: "SH_Affliction",
      trigger: { key: "1", gesture: "triple" },
      sequence: [{ key: "F1" }],
      enabled: true,
    },
    // KEY 2
    {
      name: "SH_Revivification",
      trigger: { key: "2", gesture: "single" },
      sequence: [{ key: "O" }],
      enabled: true,
    },
    {
      name: "SH_Roaming_Mend",
      trigger: { key: "2", gesture: "double" },
      sequence: [{ key: "F3" }],
      enabled: true,
    },
    {
      name: "SH_Knockback",
      trigger: { key: "2", gesture: "triple" },
      sequence: [{ key: "SHIFT+F3" }],
      enabled: true,
    },
    // KEY 3
    {
      name: "SH_Rally",
      trigger: { key: "3", gesture: "single" },
      sequence: [{ key: "Z" }],
      enabled: true,
    },
    {
      name: "SH_Dark_Heal",
      trigger: { key: "3", gesture: "double" },
      sequence: [{ key: "SHIFT+J" }],
      enabled: true,
    },
    {
      name: "SH_Crushing_Darkness",
      trigger: { key: "3", gesture: "triple" },
      sequence: [{ key: "F5" }],
      enabled: true,
    },
    // KEY 4
    {
      name: "SH_Interrupt",
      trigger: { key: "4", gesture: "single" },
      sequence: [{ key: "K" }],
      enabled: true,
    },
    {
      name: "SH_Electrocute",
      trigger: { key: "4", gesture: "double" },
      sequence: [{ key: "DELETE" }],
      enabled: true,
    },
    {
      name: "SH_Electro_Grenade",
      trigger: { key: "4", gesture: "triple" },
      sequence: [{ key: "ALT+-" }],
      enabled: true,
    },
    {
      name: "SH_Shock",
      trigger: { key: "4", gesture: "single_long" },
      sequence: [{ key: "ALT+K" }],
      enabled: true,
    },
    // KEY 5
    {
      name: "SH_Cloud_Mind",
      trigger: { key: "5", gesture: "single" },
      sequence: [{ key: "[" }],
      enabled: true,
    },
    {
      name: "SH_Consume_Darkness",
      trigger: { key: "5", gesture: "double" },
      sequence: [{ key: "BACKSPACE" }],
      enabled: true,
    },
    {
      name: "SH_Force_Lightning",
      trigger: { key: "5", gesture: "triple" },
      sequence: [{ key: "SHIFT+L" }],
      enabled: true,
    },
    // KEY 6
    {
      name: "SH_Static_Barrier",
      trigger: { key: "6", gesture: "single" },
      sequence: [{ key: "SHIFT+K" }],
      enabled: true,
    },
    {
      name: "SH_Sorc_Pull",
      trigger: { key: "6", gesture: "double" },
      sequence: [{ key: "ALT+L" }],
      enabled: true,
    },
    {
      name: "SH_Seismic_Grenade",
      trigger: { key: "6", gesture: "triple" },
      sequence: [{ key: "ALT+/" }],
      enabled: true,
    },
    // KEY A
    {
      name: "SH_Force_Speed",
      trigger: { key: "A", gesture: "single" },
      sequence: [{ key: "F9" }],
      enabled: true,
    },
    // KEY S
    {
      name: "SH_Cleanse",
      trigger: { key: "S", gesture: "single" },
      sequence: [{ key: "ALT+Z" }],
      enabled: true,
    },
    // KEY D
    {
      name: "SH_Self_Heal",
      trigger: { key: "D", gesture: "single" },
      sequence: [{ key: "ALT+O" }],
      enabled: true,
    },
    // KEY U
    {
      name: "SH_Cloud_Mind_U",
      trigger: { key: "U", gesture: "single" },
      sequence: [{ key: "[" }],
      enabled: true,
    },
    {
      name: "SH_Barrier",
      trigger: { key: "U", gesture: "double" },
      sequence: [{ key: "," }],
      enabled: true,
    },
    // KEY I
    {
      name: "SH_Polarity_Shift",
      trigger: { key: "I", gesture: "single" },
      sequence: [{ key: "SHIFT+X" }],
      enabled: true,
    },
    {
      name: "SH_Relic",
      trigger: { key: "I", gesture: "double" },
      sequence: [{ key: "SHIFT+V" }],
      enabled: true,
    },
  ],
};

// ============================================================================
// ENGINEERING SNIPER — Full MacroProfile (actual output keys)
// ============================================================================

const ENGI_SNIPER_PROFILE: MacroProfile = {
  name: "Engi Sniper Traffic Test",
  description: "All output keys from ENGI_BINDINGS for conundrum analysis",
  gestureSettings: DEFAULT_SETTINGS,
  macros: [
    // SHARED
    {
      name: "ES_Close_Enemy_Cog",
      trigger: { key: "W", gesture: "single" },
      sequence: [{ key: "8" }, { key: "ALT+F9" }],
      enabled: true,
    },
    {
      name: "ES_Next_Friend_Cog",
      trigger: { key: "W", gesture: "double" },
      sequence: [{ key: "." }, { key: "ALT+F9" }],
      enabled: true,
    },
    {
      name: "ES_Next_Target_Cog",
      trigger: { key: "Y", gesture: "single" },
      sequence: [{ key: "V" }, { key: "ALT+F9" }],
      enabled: true,
    },
    {
      name: "ES_Close_Friend_Cog",
      trigger: { key: "Y", gesture: "double" },
      sequence: [{ key: "'" }, { key: "ALT+F9" }],
      enabled: true,
    },
    {
      name: "ES_Prev_Target_Cog",
      trigger: { key: "T", gesture: "single" },
      sequence: [{ key: "ALT+]" }, { key: "ALT+F9" }],
      enabled: true,
    },
    {
      name: "ES_Prev_Friend_Cog",
      trigger: { key: "T", gesture: "double" },
      sequence: [{ key: "ALT+." }, { key: "ALT+F9" }],
      enabled: true,
    },
    {
      name: "ES_ToT_Cog",
      trigger: { key: "T", gesture: "triple" },
      sequence: [{ key: "M" }, { key: "ALT+F9" }],
      enabled: true,
    },
    {
      name: "ES_Focus_ToT_Cog",
      trigger: { key: "T", gesture: "single_long" },
      sequence: [{ key: "J" }, { key: "ALT+F9" }],
      enabled: true,
    },
    {
      name: "ES_Zoom",
      trigger: { key: "MIDDLE_CLICK", gesture: "single" },
      sequence: [{ key: "CTRL+V" }],
      enabled: true,
    },
    // KEY 1
    {
      name: "ES_Snipe",
      trigger: { key: "1", gesture: "single" },
      sequence: [{ key: "N" }],
      enabled: true,
    },
    {
      name: "ES_Center_Target_Cog",
      trigger: { key: "1", gesture: "single_long" },
      sequence: [{ key: "SHIFT+O" }, { key: "ALT+F9" }],
      enabled: true,
    },
    {
      name: "ES_Series_of_Shots",
      trigger: { key: "1", gesture: "double" },
      sequence: [{ key: "ALT+N" }],
      enabled: true,
    },
    {
      name: "ES_Corrosive_Dart",
      trigger: { key: "1", gesture: "triple" },
      sequence: [{ key: "F1" }],
      enabled: true,
    },
    // KEY 2
    {
      name: "ES_Crouch",
      trigger: { key: "2", gesture: "single" },
      sequence: [{ key: "O" }],
      enabled: true,
    },
    {
      name: "ES_Crouch_2",
      trigger: { key: "2", gesture: "double" },
      sequence: [{ key: "F3" }],
      enabled: true,
    },
    {
      name: "ES_Entrench",
      trigger: { key: "2", gesture: "triple" },
      sequence: [{ key: "SHIFT+F3" }],
      enabled: true,
    },
    // KEY 3
    {
      name: "ES_Interrogation_Probe",
      trigger: { key: "3", gesture: "single" },
      sequence: [{ key: "Z" }],
      enabled: true,
    },
    {
      name: "ES_Basic_Attack",
      trigger: { key: "3", gesture: "single_long" },
      sequence: [{ key: "8" }],
      enabled: true,
    },
    {
      name: "ES_Plasma_Probe",
      trigger: { key: "3", gesture: "double" },
      sequence: [{ key: "SHIFT+J" }],
      enabled: true,
    },
    {
      name: "ES_Laze_Target",
      trigger: { key: "3", gesture: "triple" },
      sequence: [{ key: "F5" }],
      enabled: true,
    },
    // KEY 4
    {
      name: "ES_Interrupt",
      trigger: { key: "4", gesture: "single" },
      sequence: [{ key: "K" }],
      enabled: true,
    },
    {
      name: "ES_EMP_Discharge",
      trigger: { key: "4", gesture: "double" },
      sequence: [{ key: "DELETE" }],
      enabled: true,
    },
    {
      name: "ES_Sabotage",
      trigger: { key: "4", gesture: "triple" },
      sequence: [{ key: "ALT+-" }],
      enabled: true,
    },
    {
      name: "ES_Electro_Stun",
      trigger: { key: "4", gesture: "single_long" },
      sequence: [{ key: "ALT+K" }],
      enabled: true,
    },
    // KEY 5
    {
      name: "ES_Frag_Grenade",
      trigger: { key: "5", gesture: "single" },
      sequence: [{ key: "[" }],
      enabled: true,
    },
    {
      name: "ES_Suppressive_Fire",
      trigger: { key: "5", gesture: "double" },
      sequence: [{ key: "]" }],
      enabled: true,
    },
    {
      name: "ES_Orbital_Strike",
      trigger: { key: "5", gesture: "triple" },
      sequence: [{ key: "SHIFT+L" }],
      enabled: true,
    },
    // KEY 6
    {
      name: "ES_Knockback",
      trigger: { key: "6", gesture: "single" },
      sequence: [{ key: "F7" }],
      enabled: true,
    },
    {
      name: "ES_Maim_Ballistic",
      trigger: { key: "6", gesture: "double" },
      sequence: [{ key: "," }],
      enabled: true,
    },
    {
      name: "ES_Diversion",
      trigger: { key: "6", gesture: "triple" },
      sequence: [{ key: "ALT+Z" }],
      enabled: true,
    },
    // KEY A
    {
      name: "ES_Roll",
      trigger: { key: "A", gesture: "single" },
      sequence: [{ key: "F9" }],
      enabled: true,
    },
    {
      name: "ES_Leg_Shot",
      trigger: { key: "A", gesture: "double" },
      sequence: [{ key: "BACKSPACE" }],
      enabled: true,
    },
    {
      name: "ES_Focus_Taunt",
      trigger: { key: "A", gesture: "single_long" },
      sequence: [{ key: "7" }, { key: "F6" }],
      enabled: true,
    },
    // KEY S
    {
      name: "ES_Met_Prep",
      trigger: { key: "S", gesture: "single" },
      sequence: [{ key: "SHIFT+V" }],
      enabled: true,
    },
    // KEY D
    {
      name: "ES_Shield_Probe",
      trigger: { key: "D", gesture: "single" },
      sequence: [{ key: "R" }],
      enabled: true,
    },
    // KEY U
    {
      name: "ES_Evasion",
      trigger: { key: "U", gesture: "single" },
      sequence: [{ key: "SHIFT+." }],
      enabled: true,
    },
    // KEY I
    {
      name: "ES_Relic",
      trigger: { key: "I", gesture: "single" },
      sequence: [{ key: "F8" }],
      enabled: true,
    },
    // KEY H
    {
      name: "ES_Reload_Ammo",
      trigger: { key: "H", gesture: "single" },
      sequence: [{ key: "ALT+X" }],
      enabled: true,
    },
  ],
};

// ============================================================================
// SORC HEALS CONUNDRUM DETECTION
// ============================================================================

describe("Sorc Heals — Conundrum Key Detection", () => {
  let compiled: CompiledProfile;

  beforeEach(() => {
    compiled = compileProfile(SORC_HEALS_PROFILE);
  });

  it("detects N as conundrum: raw N (Resurgence) vs ALT+N (Innervate)", () => {
    expect(compiled.conflictKeys.has("N")).toBe(true);
    expect(compiled.modifierConflicts.get("N")).toBe("alt");
  });

  it("detects K as conundrum: raw K vs ALT+K vs SHIFT+K → 'both'", () => {
    expect(compiled.conflictKeys.has("K")).toBe(true);
    expect(compiled.modifierConflicts.get("K")).toBe("both");
  });

  it("detects F9 as conundrum: raw F9 (Force Speed) vs ALT+F9 (Cog)", () => {
    expect(compiled.conflictKeys.has("F9")).toBe(true);
    expect(compiled.modifierConflicts.get("F9")).toBe("alt");
  });

  it("detects J as conundrum: raw J (Focus ToT) vs SHIFT+J (Dark Heal)", () => {
    expect(compiled.conflictKeys.has("J")).toBe(true);
    expect(compiled.modifierConflicts.get("J")).toBe("shift");
  });

  it("detects F3 as conundrum: raw F3 (Roaming Mend) vs SHIFT+F3 (Knockback)", () => {
    expect(compiled.conflictKeys.has("F3")).toBe(true);
    expect(compiled.modifierConflicts.get("F3")).toBe("shift");
  });

  it("marks [ (Cloud Mind) as SAFE — no modifier variant", () => {
    expect(compiled.safeKeys.has("[")).toBe(true);
    expect(compiled.conflictKeys.has("[")).toBe(false);
  });

  it("detects O as conundrum: raw O (Revivification) vs ALT+O (Self Heal)", () => {
    expect(compiled.conflictKeys.has("O")).toBe(true);
    expect(compiled.modifierConflicts.get("O")).toBe("alt");
  });

  it("detects Z as conundrum: raw Z (Rally) vs ALT+Z (Cleanse)", () => {
    expect(compiled.conflictKeys.has("Z")).toBe(true);
    expect(compiled.modifierConflicts.get("Z")).toBe("alt");
  });

  it("marks , (Barrier) as SAFE — no modifier variant", () => {
    expect(compiled.safeKeys.has(",")).toBe(true);
    expect(compiled.conflictKeys.has(",")).toBe(false);
  });

  it("ALT+N (Innervate output) appears exactly once — no duplicate conflict", () => {
    const allKeys: string[] = [];
    for (const macro of SORC_HEALS_PROFILE.macros) {
      for (const s of macro.sequence) {
        if (s.key) allKeys.push(s.key);
      }
    }
    const altNCount = allKeys.filter((k) => k === "ALT+N").length;
    expect(altNCount).toBe(1);
    expect(compiled.modifierConflicts.get("N")).toBe("alt");
  });

  it("produces correct complete conundrum map", () => {
    const expected: Record<string, string> = {
      N: "alt",
      K: "both",
      F9: "alt",
      J: "shift",
      F3: "shift",
      O: "alt", // raw O (Revivification) vs ALT+O (Self Heal)
      Z: "alt", // raw Z (Rally) vs ALT+Z (Cleanse)
      ".": "alt", // raw . (shared Next Friend Cog) vs ALT+. (shared Prev Friend Cog)
    };
    for (const [key, conflict] of Object.entries(expected)) {
      expect(compiled.conflictKeys.has(key)).toBe(true);
      expect(compiled.modifierConflicts.get(key)).toBe(conflict);
    }
    // L is a non-raw conundrum: SHIFT+L (Force Lightning) + ALT+L (Sorc Pull) → both
    expect(compiled.conflictKeys.has("L")).toBe(true);
    expect(compiled.modifierConflicts.get("L")).toBe("both");
    // No false positives on known safe keys
    // V is a conundrum: raw V (shared targeting) + SHIFT+V (Relic) → shift
    expect(compiled.conflictKeys.has("V")).toBe(true);
    expect(compiled.modifierConflicts.get("V")).toBe("shift");
    for (const safe of ["[", ",", "F1", "F5", "DELETE", "BACKSPACE", "M"]) {
      expect(compiled.conflictKeys.has(safe)).toBe(false);
    }
  });
});

// ============================================================================
// ENGI SNIPER CONUNDRUM DETECTION
// ============================================================================

describe("Engi Sniper — Conundrum Key Detection", () => {
  let compiled: CompiledProfile;

  beforeEach(() => {
    compiled = compileProfile(ENGI_SNIPER_PROFILE);
  });

  it("detects N as conundrum: raw N (Snipe) vs ALT+N (Series of Shots)", () => {
    expect(compiled.conflictKeys.has("N")).toBe(true);
    expect(compiled.modifierConflicts.get("N")).toBe("alt");
  });

  it("detects O as conundrum: raw O (Crouch) vs SHIFT+O (Center Target)", () => {
    expect(compiled.conflictKeys.has("O")).toBe(true);
    expect(compiled.modifierConflicts.get("O")).toBe("shift");
  });

  it("detects F3 as conundrum: raw F3 (Crouch 2) vs SHIFT+F3 (Entrench)", () => {
    expect(compiled.conflictKeys.has("F3")).toBe(true);
    expect(compiled.modifierConflicts.get("F3")).toBe("shift");
  });

  it("detects K as conundrum: raw K (Interrupt) vs ALT+K (Electro Stun)", () => {
    expect(compiled.conflictKeys.has("K")).toBe(true);
    expect(compiled.modifierConflicts.get("K")).toBe("alt");
  });

  it("detects Z as conundrum: raw Z (Interrogation Probe) vs ALT+Z (Diversion)", () => {
    expect(compiled.conflictKeys.has("Z")).toBe(true);
    expect(compiled.modifierConflicts.get("Z")).toBe("alt");
  });

  it("detects J as conundrum: raw J (Focus ToT) vs SHIFT+J (Plasma Probe)", () => {
    expect(compiled.conflictKeys.has("J")).toBe(true);
    expect(compiled.modifierConflicts.get("J")).toBe("shift");
  });

  it("detects F9 as conundrum: raw F9 (Roll) vs ALT+F9 (Cog)", () => {
    expect(compiled.conflictKeys.has("F9")).toBe(true);
    expect(compiled.modifierConflicts.get("F9")).toBe("alt");
  });

  it("marks F7 (Knockback) as SAFE", () => {
    expect(compiled.safeKeys.has("F7")).toBe(true);
    expect(compiled.conflictKeys.has("F7")).toBe(false);
  });

  it("marks , (Maim/Ballistic) as SAFE", () => {
    expect(compiled.safeKeys.has(",")).toBe(true);
    expect(compiled.conflictKeys.has(",")).toBe(false);
  });

  it("marks F8 (Relic) as SAFE", () => {
    expect(compiled.safeKeys.has("F8")).toBe(true);
    expect(compiled.conflictKeys.has("F8")).toBe(false);
  });

  it("marks R (Shield Probe) as SAFE — no modifier variant in Engi", () => {
    expect(compiled.safeKeys.has("R")).toBe(true);
    expect(compiled.conflictKeys.has("R")).toBe(false);
  });

  it("detects ] as conundrum: raw ] (Suppressive Fire) vs ALT+] (shared Prev Target)", () => {
    expect(compiled.conflictKeys.has("]")).toBe(true);
    expect(compiled.modifierConflicts.get("]")).toBe("alt");
  });

  it("marks BACKSPACE (Leg Shot) as SAFE", () => {
    expect(compiled.safeKeys.has("BACKSPACE")).toBe(true);
    expect(compiled.conflictKeys.has("BACKSPACE")).toBe(false);
  });

  it("produces correct complete conundrum map", () => {
    const expected: Record<string, string> = {
      N: "alt",
      O: "shift",
      F3: "shift",
      K: "alt",
      Z: "alt",
      J: "shift",
      F9: "alt",
      "]": "alt", // raw ] (Suppressive Fire) vs ALT+] (shared Prev Target Cog)
      ".": "both", // raw . (shared) vs ALT+. (shared) vs SHIFT+. (Evasion)
    };
    for (const [key, conflict] of Object.entries(expected)) {
      expect(compiled.conflictKeys.has(key)).toBe(true);
      expect(compiled.modifierConflicts.get(key)).toBe(conflict);
    }
    for (const safe of [
      "F7",
      ",",
      "F8",
      "R",
      "BACKSPACE",
      "8",
      "F1",
      "F5",
      "DELETE",
      "F6",
    ]) {
      expect(compiled.conflictKeys.has(safe)).toBe(false);
    }
  });
});

// ============================================================================
// CROSS-PROFILE COMPARISON
// ============================================================================

describe("Cross-Profile Conundrum Comparison", () => {
  it("both profiles flag N as conundrum (ALT+N conflict)", () => {
    const sh = compileProfile(SORC_HEALS_PROFILE);
    const es = compileProfile(ENGI_SNIPER_PROFILE);
    expect(sh.modifierConflicts.get("N")).toBe("alt");
    expect(es.modifierConflicts.get("N")).toBe("alt");
  });

  it("Engi has ] conundrum that Sorc Heals does not", () => {
    const sh = compileProfile(SORC_HEALS_PROFILE);
    const es = compileProfile(ENGI_SNIPER_PROFILE);
    // ] only appears raw in Engi (Suppressive Fire), not in Sorc Heals
    expect(es.conflictKeys.has("]")).toBe(true);
    expect(sh.conflictKeys.has("]")).toBe(false);
  });

  it("both profiles have O and Z as conundrums but with different types", () => {
    const sh = compileProfile(SORC_HEALS_PROFILE);
    const es = compileProfile(ENGI_SNIPER_PROFILE);
    // O: Sorc = alt (raw O + ALT+O), Engi = shift (raw O + SHIFT+O)
    expect(sh.modifierConflicts.get("O")).toBe("alt");
    expect(es.modifierConflicts.get("O")).toBe("shift");
    // Z: both = alt (raw Z + ALT+Z)
    expect(sh.modifierConflicts.get("Z")).toBe("alt");
    expect(es.modifierConflicts.get("Z")).toBe("alt");
  });

  it("Sorc K = 'both' (raw+ALT+SHIFT) vs Engi K = 'alt' (raw+ALT only)", () => {
    const sh = compileProfile(SORC_HEALS_PROFILE);
    const es = compileProfile(ENGI_SNIPER_PROFILE);
    expect(sh.modifierConflicts.get("K")).toBe("both");
    expect(es.modifierConflicts.get("K")).toBe("alt");
  });
});

// ============================================================================
// TRAFFIC CONTROLLER — SMART MODIFIER BYPASS
// ============================================================================
// The TC's modifier callback determines whether a conundrum key ENTERS the
// queue or SKIPS it entirely:
//   modifier NOT held → skip queue → return immediately
//   modifier held → enter queue → serialize via crossingKey mechanism

describe("TC — Smart bypass: Sorc Heals", () => {
  let tc: TrafficController;
  let compiled: CompiledProfile;
  let modState: { shift: boolean; alt: boolean; ctrl: boolean };

  beforeEach(() => {
    compiled = compileProfile(SORC_HEALS_PROFILE);
    tc = new TrafficController(compiled);
    modState = { shift: false, alt: false, ctrl: false };
    tc.setModifierStateCallback(() => ({ ...modState }));
  });

  it("N skips queue when ALT not held (Resurgence fires clean)", async () => {
    modState.alt = false;
    const start = Date.now();
    await tc.requestCrossing("N");
    expect(Date.now() - start).toBeLessThan(15);
  });

  it("K skips queue when neither SHIFT nor ALT held", async () => {
    modState.shift = false;
    modState.alt = false;
    const start = Date.now();
    await tc.requestCrossing("K");
    expect(Date.now() - start).toBeLessThan(15);
  });

  it("F9 skips queue when ALT not held (Force Speed fires clean)", async () => {
    modState.alt = false;
    const start = Date.now();
    await tc.requestCrossing("F9");
    expect(Date.now() - start).toBeLessThan(15);
  });

  it("J skips queue when SHIFT not held (Focus ToT fires clean)", async () => {
    modState.shift = false;
    const start = Date.now();
    await tc.requestCrossing("J");
    expect(Date.now() - start).toBeLessThan(15);
  });

  it("[ (Cloud Mind) always instant — not a conundrum key at all", async () => {
    modState.alt = true;
    modState.shift = true;
    const start = Date.now();
    await tc.requestCrossing("[");
    expect(Date.now() - start).toBeLessThan(15);
  });

  it(", (Barrier) always instant — SAFE key", async () => {
    modState.alt = true;
    const start = Date.now();
    await tc.requestCrossing(",");
    expect(Date.now() - start).toBeLessThan(15);
  });
});

describe("TC — Smart bypass: Engi Sniper", () => {
  let tc: TrafficController;
  let compiled: CompiledProfile;
  let modState: { shift: boolean; alt: boolean; ctrl: boolean };

  beforeEach(() => {
    compiled = compileProfile(ENGI_SNIPER_PROFILE);
    tc = new TrafficController(compiled);
    modState = { shift: false, alt: false, ctrl: false };
    tc.setModifierStateCallback(() => ({ ...modState }));
  });

  it("N skips queue when ALT not held", async () => {
    const start = Date.now();
    await tc.requestCrossing("N");
    expect(Date.now() - start).toBeLessThan(15);
  });

  it("O skips queue when SHIFT not held", async () => {
    const start = Date.now();
    await tc.requestCrossing("O");
    expect(Date.now() - start).toBeLessThan(15);
  });

  it("F3 skips queue when SHIFT not held", async () => {
    const start = Date.now();
    await tc.requestCrossing("F3");
    expect(Date.now() - start).toBeLessThan(15);
  });

  it("Z skips queue when ALT not held", async () => {
    const start = Date.now();
    await tc.requestCrossing("Z");
    expect(Date.now() - start).toBeLessThan(15);
  });

  it("F7 (Knockback) always instant — SAFE", async () => {
    modState.shift = true;
    modState.alt = true;
    const start = Date.now();
    await tc.requestCrossing("F7");
    expect(Date.now() - start).toBeLessThan(15);
  });

  it("F8 (Relic) always instant — SAFE", async () => {
    const start = Date.now();
    await tc.requestCrossing("F8");
    expect(Date.now() - start).toBeLessThan(15);
  });

  it(", (Maim) always instant — SAFE", async () => {
    const start = Date.now();
    await tc.requestCrossing(",");
    expect(Date.now() - start).toBeLessThan(15);
  });

  it("] (Suppressive Fire) always instant — SAFE", async () => {
    const start = Date.now();
    await tc.requestCrossing("]");
    expect(Date.now() - start).toBeLessThan(15);
  });

  it("BACKSPACE (Leg Shot) always instant — SAFE", async () => {
    const start = Date.now();
    await tc.requestCrossing("BACKSPACE");
    expect(Date.now() - start).toBeLessThan(15);
  });
});

// ============================================================================
// TRAFFIC CONTROLLER — QUEUE SERIALIZATION (blocking tests)
// ============================================================================
// When modifier IS held, conundrum keys enter the queue. The first request
// passes through and sets crossingKey. A second request for the same key
// blocks in shouldWait until the first releases.

describe("TC — Queue serialization: Sorc Heals concurrent crossings", () => {
  let tc: TrafficController;
  let compiled: CompiledProfile;
  let modState: { shift: boolean; alt: boolean; ctrl: boolean };

  beforeEach(() => {
    compiled = compileProfile(SORC_HEALS_PROFILE);
    tc = new TrafficController(compiled);
    modState = { shift: false, alt: false, ctrl: false };
    tc.setModifierStateCallback(() => ({ ...modState }));
  });

  it("two concurrent N requests serialize when ALT held", async () => {
    modState.alt = true;
    // First request passes through queue (sets crossingKey = N)
    await tc.requestCrossing("N");

    // Second request blocks (crossingKey is non-null)
    const blocked = { resolved: false };
    tc.requestCrossing("N").then(() => {
      blocked.resolved = true;
    });
    await sleep(15);
    expect(blocked.resolved).toBe(false);

    // Release first → second unblocks
    tc.releaseCrossing("N");
    await sleep(80);
    expect(blocked.resolved).toBe(true);
    tc.releaseCrossing("N");
  });

  it("two concurrent K requests serialize when ALT held (K conflict=both)", async () => {
    modState.alt = true;
    await tc.requestCrossing("K");

    const blocked = { resolved: false };
    tc.requestCrossing("K").then(() => {
      blocked.resolved = true;
    });
    await sleep(15);
    expect(blocked.resolved).toBe(false);

    tc.releaseCrossing("K");
    await sleep(80);
    expect(blocked.resolved).toBe(true);
    tc.releaseCrossing("K");
  });

  it("two concurrent K requests also serialize when SHIFT held", async () => {
    modState.shift = true;
    await tc.requestCrossing("K");

    const blocked = { resolved: false };
    tc.requestCrossing("K").then(() => {
      blocked.resolved = true;
    });
    await sleep(15);
    expect(blocked.resolved).toBe(false);

    tc.releaseCrossing("K");
    await sleep(80);
    expect(blocked.resolved).toBe(true);
    tc.releaseCrossing("K");
  });

  it("N skips queue entirely if ALT not held — no serialization needed", async () => {
    modState.alt = false;
    // Two rapid requests — both skip the queue and return immediately
    const order: string[] = [];
    const p1 = tc.requestCrossing("N").then(() => order.push("first"));
    const p2 = tc.requestCrossing("N").then(() => order.push("second"));
    await Promise.all([p1, p2]);
    expect(order).toEqual(["first", "second"]);
  });
});

describe("TC — Queue serialization: Engi Sniper concurrent crossings", () => {
  let tc: TrafficController;
  let compiled: CompiledProfile;
  let modState: { shift: boolean; alt: boolean; ctrl: boolean };

  beforeEach(() => {
    compiled = compileProfile(ENGI_SNIPER_PROFILE);
    tc = new TrafficController(compiled);
    modState = { shift: false, alt: false, ctrl: false };
    tc.setModifierStateCallback(() => ({ ...modState }));
  });

  it("two concurrent N requests serialize when ALT held (Snipe collision)", async () => {
    modState.alt = true;
    await tc.requestCrossing("N");

    const blocked = { resolved: false };
    tc.requestCrossing("N").then(() => {
      blocked.resolved = true;
    });
    await sleep(15);
    expect(blocked.resolved).toBe(false);

    tc.releaseCrossing("N");
    await sleep(80);
    expect(blocked.resolved).toBe(true);
    tc.releaseCrossing("N");
  });

  it("two concurrent O requests serialize when SHIFT held (Crouch → Center Target)", async () => {
    modState.shift = true;
    await tc.requestCrossing("O");

    const blocked = { resolved: false };
    tc.requestCrossing("O").then(() => {
      blocked.resolved = true;
    });
    await sleep(15);
    expect(blocked.resolved).toBe(false);

    tc.releaseCrossing("O");
    await sleep(80);
    expect(blocked.resolved).toBe(true);
    tc.releaseCrossing("O");
  });

  it("two concurrent F3 requests serialize when SHIFT held (Crouch 2 → Entrench)", async () => {
    modState.shift = true;
    await tc.requestCrossing("F3");

    const blocked = { resolved: false };
    tc.requestCrossing("F3").then(() => {
      blocked.resolved = true;
    });
    await sleep(15);
    expect(blocked.resolved).toBe(false);

    tc.releaseCrossing("F3");
    await sleep(80);
    expect(blocked.resolved).toBe(true);
    tc.releaseCrossing("F3");
  });

  it("two concurrent Z requests serialize when ALT held (Interrogation → Diversion)", async () => {
    modState.alt = true;
    await tc.requestCrossing("Z");

    const blocked = { resolved: false };
    tc.requestCrossing("Z").then(() => {
      blocked.resolved = true;
    });
    await sleep(15);
    expect(blocked.resolved).toBe(false);

    tc.releaseCrossing("Z");
    await sleep(80);
    expect(blocked.resolved).toBe(true);
    tc.releaseCrossing("Z");
  });
});

// ============================================================================
// R-KEY BYPASS & SUPREMACY
// ============================================================================

describe("R-Key Bypass & Supremacy", () => {
  it("R key always bypasses TC regardless of modifier state", async () => {
    const compiled = compileProfile(ENGI_SNIPER_PROFILE);
    const tc = new TrafficController(compiled);
    tc.setModifierStateCallback(() => ({ shift: true, alt: true, ctrl: true }));

    const start = Date.now();
    await tc.requestCrossing("R");
    expect(Date.now() - start).toBeLessThan(10);
  });

  it("supremacy macros bypass all TC waits", async () => {
    const compiled = compileProfile(ENGI_SNIPER_PROFILE);
    const tc = new TrafficController(compiled);
    tc.setModifierStateCallback(() => ({ shift: true, alt: true, ctrl: true }));
    tc.grantPriority("ES_Interrupt");

    const start = Date.now();
    await tc.requestCrossing("K", "ES_Interrupt");
    expect(Date.now() - start).toBeLessThan(10);

    tc.revokePriority("ES_Interrupt");
  });

  it("supremacy revocation re-enables normal TC behavior", async () => {
    const compiled = compileProfile(ENGI_SNIPER_PROFILE);
    const tc = new TrafficController(compiled);
    const modState = { shift: false, alt: true, ctrl: false };
    tc.setModifierStateCallback(() => ({ ...modState }));

    tc.grantPriority("ES_Interrupt");
    // With supremacy, K passes instantly
    await tc.requestCrossing("K", "ES_Interrupt");

    tc.revokePriority("ES_Interrupt");
    // After revocation, K enters queue (ALT held)
    await tc.requestCrossing("K");
    // First passed through, now second will block
    const blocked = { resolved: false };
    tc.requestCrossing("K").then(() => {
      blocked.resolved = true;
    });
    await sleep(15);
    expect(blocked.resolved).toBe(false);
    tc.releaseCrossing("K");
    await sleep(80);
    expect(blocked.resolved).toBe(true);
    tc.releaseCrossing("K");
  });
});

// ============================================================================
// HIGH-FREQUENCY OVERLAP — REALISTIC GAMEPLAY SEQUENCES
// ============================================================================

describe("High-Frequency Overlap — Realistic gameplay", () => {
  it("Resurgence → Innervate → Resurgence: N clears between ALT+N gaps", async () => {
    // Real gameplay: tap 1q (Resurgence → N), then 1qt (Innervate → ALT+N),
    // then 1q again. Between each, the modifier state transitions cleanly.
    const compiled = compileProfile(SORC_HEALS_PROFILE);
    const tc = new TrafficController(compiled);
    const modState = { shift: false, alt: false, ctrl: false };
    tc.setModifierStateCallback(() => ({ ...modState }));

    // 1) Resurgence: ALT not held → skips queue → instant
    modState.alt = false;
    await tc.requestCrossing("N");
    // No releaseCrossing needed — skipped queue

    // 2) Innervate fires ALT+N (executor handles modifier, TC sees it as conundrum N)
    // But ALT is not held at the moment TC checks → skips
    modState.alt = false;
    await tc.requestCrossing("ALT+N");
    // Also skips (raw = N, ALT not held at check time)

    // 3) Resurgence again — ALT is released → instant
    modState.alt = false;
    const start = Date.now();
    await tc.requestCrossing("N");
    expect(Date.now() - start).toBeLessThan(15);
  });

  it("5 rapid Snipe→Series cycles without deadlock", async () => {
    const compiled = compileProfile(ENGI_SNIPER_PROFILE);
    const tc = new TrafficController(compiled);
    const modState = { shift: false, alt: false, ctrl: false };
    tc.setModifierStateCallback(() => ({ ...modState }));

    for (let i = 0; i < 5; i++) {
      // Snipe: raw N, ALT not held → skip queue
      modState.alt = false;
      await tc.requestCrossing("N");

      // Brief ALT hold for Series of Shots
      modState.alt = true;
      await sleep(5);
      modState.alt = false;
    }
    expect(true).toBe(true); // No deadlock
  });

  it("3 rapid Crouch 2 → Entrench cycles without deadlock", async () => {
    const compiled = compileProfile(ENGI_SNIPER_PROFILE);
    const tc = new TrafficController(compiled);
    const modState = { shift: false, alt: false, ctrl: false };
    tc.setModifierStateCallback(() => ({ ...modState }));

    for (let i = 0; i < 3; i++) {
      modState.shift = false;
      await tc.requestCrossing("F3");

      modState.shift = true;
      await sleep(5);
      modState.shift = false;
    }
    expect(true).toBe(true);
  });

  it("interleaved safe + conundrum keys: no blocking when modifiers clean", async () => {
    // In normal gameplay, most keys fire with no modifiers held
    const compiled = compileProfile(ENGI_SNIPER_PROFILE);
    const tc = new TrafficController(compiled);
    const modState = { shift: false, alt: false, ctrl: false };
    tc.setModifierStateCallback(() => ({ ...modState }));

    // Rapid-fire: F7 (safe) → N (conundrum, ALT clean) → , (safe) → Z (conundrum, ALT clean) → F8 (safe)
    const keys = ["F7", "N", ",", "Z", "F8"];
    const start = Date.now();
    for (const key of keys) {
      await tc.requestCrossing(key);
    }
    // All should complete near-instantly (no modifiers held, safe or smart-bypass)
    expect(Date.now() - start).toBeLessThan(20);
  });
});

// ============================================================================
// SELF-DETECTION PREVENTION
// ============================================================================

describe("No Synthetic Input Self-Detection", () => {
  it("SequenceExecutor exposes setSuppressKeyCallback for gesture detector sync", async () => {
    // The executor exposes this method so the gesture detector can ignore
    // synthetic key outputs, preventing re-trigger loops.
    const { SequenceExecutor } = await import("../src/sequenceExecutor.js");
    const executor = new SequenceExecutor(() => {});
    expect(typeof executor.setSuppressKeyCallback).toBe("function");
    executor.destroy();
  });
});

// ============================================================================
// isConflictKey utility
// ============================================================================

describe("isConflictKey utility", () => {
  it("returns true for conundrum raw key", () => {
    const compiled = compileProfile(SORC_HEALS_PROFILE);
    expect(isConflictKey("N", compiled)).toBe(true);
    expect(isConflictKey("K", compiled)).toBe(true);
  });

  it("returns true for modified form of conundrum key", () => {
    const compiled = compileProfile(SORC_HEALS_PROFILE);
    // isConflictKey extracts raw key from "ALT+N" → "N" → checks conflictKeys
    expect(isConflictKey("ALT+N", compiled)).toBe(true);
    expect(isConflictKey("SHIFT+K", compiled)).toBe(true);
  });

  it("returns false for safe keys", () => {
    const compiled = compileProfile(SORC_HEALS_PROFILE);
    expect(isConflictKey("[", compiled)).toBe(false);
    expect(isConflictKey(",", compiled)).toBe(false);
    expect(isConflictKey("F1", compiled)).toBe(false);
  });

  it("returns false for keys not in the profile at all", () => {
    const compiled = compileProfile(SORC_HEALS_PROFILE);
    expect(isConflictKey("Q", compiled)).toBe(false);
    expect(isConflictKey("P", compiled)).toBe(false);
  });
});
