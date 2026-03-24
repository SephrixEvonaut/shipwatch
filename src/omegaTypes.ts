// ============================================================================
// OMEGA TYPES - Type definitions for the Omega gesture detection system
// ============================================================================
//
// Omega is a simplified 4-gesture system designed for responsive low-latency input processing:
// - quick: Fires on keyUp if held below threshold
// - long: Fires IMMEDIATELY when threshold is crossed (no wait for keyUp)
// - quick_toggle: Same as quick, but while toggle is active
// - long_toggle: Same as long, but while toggle is active
//
// Toggle keys (W, Y) create a modifier state for all other keys.
//
// ============================================================================

import { InputKey, MacroBinding, GestureSettings } from "./types.js";

// ============================================================================
// OMEGA GESTURE TYPES
// ============================================================================

/**
 * The 8 Omega gesture types (4 base + 4 F2 toggle variants)
 * F2 toggle is an independent modifier that creates a separate gesture space
 * combo_7_4: Special combo gesture triggered by key 4 during/after key 7 hold
 */
export const OMEGA_GESTURE_TYPES = [
  "quick",
  "long",
  "quick_toggle",
  "long_toggle",
  "quick_f2",
  "long_f2",
  "quick_toggle_f2",
  "long_toggle_f2",
  "combo_7_4",
  "quick_q_toggle",
  "long_q_toggle",
  "quick_s_toggle",
  "long_s_toggle",
] as const;

export type OmegaGestureType = (typeof OMEGA_GESTURE_TYPES)[number];

/**
 * Check if a string is a valid Omega gesture type
 */
export function isOmegaGestureType(value: string): value is OmegaGestureType {
  return OMEGA_GESTURE_TYPES.includes(value as OmegaGestureType);
}

// ============================================================================
// PER-KEY THRESHOLDS
// ============================================================================

/**
 * Per-key calibrated thresholds (quick→long boundary in ms)
 * These values define when a press transitions from "quick" to "long"
 */
export const OMEGA_KEY_THRESHOLDS: Record<InputKey, number> = {
  // Number keys
  "1": 312,
  "2": 488,
  "3": 355,
  "4": 298,
  "5": 470,
  "6": 510, // Same threshold for normal and toggled mode
  "7": 500, // F2 toggle activation threshold (custom handler)

  // Letter keys
  W: 185, // Also a toggle activator
  A: 241,
  S: 512,
  D: 400, // Special handling (Prompt 2)
  B: 391,
  I: 597,
  Y: 233, // Also a toggle activator
  U: 558,
  T: 238,
  C: 349, // Special: has double-tap detection
  H: 452,
  P: 380, // Default estimate

  // Context-dependent input keys
  E: 380, // Default estimate
  F: 380, // Default estimate
  G: 380, // Default estimate

  // Special keys
  "=": 380, // Special: has double-tap detection
  F2: 380, // Special: has double-tap detection
  MIDDLE_CLICK: 442,

  // Default threshold
  ";": 380, // Default estimate

  // Spacebar
  SPACEBAR: 380,

  // Q key (toggle activator for Q toggle system)
  Q: 350,

  // 8 key
  "8": 380,

  // Default threshold
  F10: 380,
  F11: 380,
  F12: 380,
  INSERT: 380,
} as const;

/**
 * Special threshold for key "6" when in toggled mode
 */
export const KEY_6_TOGGLED_THRESHOLD = 510;

/**
 * Keys that require double-tap detection (wait for multi-press window)
 */
export const DOUBLE_TAP_DETECTION_KEYS: InputKey[] = ["C", "=", "F2"];

/**
 * Toggle activator keys
 */
export const TOGGLE_KEYS: InputKey[] = ["W", "Y"];

/**
 * Check if a key is a toggle activator
 */
export function isToggleKey(key: InputKey): key is "W" | "Y" {
  return key === "W" || key === "Y";
}

/**
 * Check if a key has double-tap detection
 */
export function hasDoubleTapDetection(key: InputKey): boolean {
  return DOUBLE_TAP_DETECTION_KEYS.includes(key);
}

// ============================================================================
// OMEGA STATE TYPES
// ============================================================================

/**
 * State of an actively pressed key
 */
export interface ActiveKeyState {
  startTime: number; // When keyDown occurred
  longFired: boolean; // Whether long gesture has already fired
}

/**
 * Core Omega state machine state
 */
export interface OmegaState {
  /** Whether toggle mode is currently active */
  toggleActive: boolean;

  /** Which key activated the toggle (W or Y), null if no toggle */
  toggleActivator: "W" | "Y" | null;

  /** When the toggle was activated (for threshold checking) */
  toggleStartTime: number | null;

  /** Map of currently held keys with their state */
  activeKeyDowns: Map<InputKey, ActiveKeyState>;

  /** S key's independent toggle state */
  secondaryToggleActive: boolean;
}

/**
 * Create initial Omega state
 */
export function createInitialOmegaState(): OmegaState {
  return {
    toggleActive: false,
    toggleActivator: null,
    toggleStartTime: null,
    activeKeyDowns: new Map(),
    secondaryToggleActive: false,
  };
}

// ============================================================================
// OMEGA GESTURE EVENT
// ============================================================================

/**
 * Omega gesture event (emitted when a gesture is detected)
 */
export interface OmegaGestureEvent {
  inputKey: InputKey;
  gesture: OmegaGestureType;
  timestamp: number;
  holdDuration?: number;
  wasToggled: boolean;
  toggleActivator?: "W" | "Y";
  wasF2Toggle?: boolean;
}

/**
 * Callback type for Omega gesture events
 */
export type OmegaGestureCallback = (event: OmegaGestureEvent) => void;

// ============================================================================
// OMEGA BINDING LOOKUP
// ============================================================================

/**
 * Extended MacroBinding that uses OmegaGestureType
 */
export interface OmegaMacroBinding extends Omit<MacroBinding, "trigger"> {
  trigger: {
    key: InputKey;
    gesture: OmegaGestureType;
  };
}

/**
 * Omega binding lookup table type
 */
export type OmegaBindingLookup = Map<
  InputKey,
  Map<OmegaGestureType, OmegaMacroBinding>
>;

// ============================================================================
// OMEGA CONFIGURATION
// ============================================================================

/**
 * Omega system configuration
 */
export interface OmegaConfig {
  /** Multi-press window for keys with double-tap detection (ms) */
  multiPressWindow: number;

  /** Debounce delay for key events (ms) */
  debounceDelay: number;

  /** Cancel threshold - holds beyond this are ignored (ms) */
  cancelThreshold: number;

  /** How often to check for long-press threshold crossing (ms) */
  checkIntervalMs: number;
}

/**
 * Default Omega configuration
 */
export const DEFAULT_OMEGA_CONFIG: OmegaConfig = {
  multiPressWindow: 350,
  debounceDelay: 15,
  cancelThreshold: 2000,
  checkIntervalMs: 5, // Very fast checking for responsive long-press detection
};

// ============================================================================
// SYSTEM SELECTION
// ============================================================================

/**
 * Available gesture detection systems
 */
export type GestureSystem = "alpha" | "omega";

/**
 * System selection configuration
 */
export interface SystemSelection {
  system: GestureSystem;
  selectedAt: number;
}

// ============================================================================
// COMMON INTERFACE FOR BOTH DETECTORS
// ============================================================================

/**
 * Common interface that both Alpha and Omega detectors implement
 * This allows the rest of the system to work with either detector
 */
export interface IGestureDetector {
  /** Handle key down event */
  handleKeyDown(key: string): void;

  /** Handle key up event */
  handleKeyUp(key: string): void;

  /** Handle mouse button down */
  handleMouseDown(button: string): void;

  /** Handle mouse button up */
  handleMouseUp(button: string): void;

  /** Reset all state */
  reset(): void;

  /** Update global settings */
  updateSettings(settings: GestureSettings): void;

  /** Update settings for a specific key */
  updateKeyProfile(key: InputKey, settings: GestureSettings): void;

  /** Clear key-specific settings */
  clearKeyProfile(key: InputKey): void;

  /** Get active profile for a key */
  getKeyProfile(key: InputKey): GestureSettings | null;

  /** Get all profiles */
  getAllProfiles(): Record<string, GestureSettings>;

  /** Get keys with custom settings */
  getCustomizedKeys(): InputKey[];

  /** Load multiple key profiles */
  loadKeyProfiles(profiles: Record<string, GestureSettings>): void;

  /** Get global settings */
  getGlobalSettings(): GestureSettings;

  /** Destroy the detector */
  destroy(): void;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get the threshold for a key, accounting for toggled state
 */
export function getKeyThreshold(key: InputKey, isToggled: boolean): number {
  // Special case: key "6" has different threshold when toggled
  if (key === "6" && isToggled) {
    return KEY_6_TOGGLED_THRESHOLD;
  }
  return OMEGA_KEY_THRESHOLDS[key] ?? 380; // Default to 380ms if not specified
}

/**
 * Determine the gesture type based on hold duration and toggle state
 */
export function determineOmegaGesture(
  holdDuration: number,
  threshold: number,
  isToggled: boolean,
): OmegaGestureType {
  const isLong = holdDuration >= threshold;

  if (isToggled) {
    return isLong ? "long_toggle" : "quick_toggle";
  } else {
    return isLong ? "long" : "quick";
  }
}

/**
 * Map an Omega gesture to its Alpha equivalent for fallback/compatibility
 * This allows Omega bindings to fall back to Alpha profiles if needed
 */
export function omegaToAlphaGesture(omega: OmegaGestureType): string {
  switch (omega) {
    case "quick":
      return "single";
    case "long":
      return "single_long";
    case "quick_toggle":
      return "double"; // Toggle variants map to double-tap equivalents
    case "long_toggle":
      return "double_long";
    default:
      return "single";
  }
}
