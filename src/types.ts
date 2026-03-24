// ============================================================================
// GESTUREKIT - TYPE DEFINITIONS
// ============================================================================

// 33 Input Keys for gesture detection
export const INPUT_KEYS = [
  // Primary letter keys
  "W",
  "A",
  "S",
  "D",
  "B",
  "I",
  "Y",
  "U",
  "T",
  "C",
  "H",
  "P",
  // Context-dependent input keys
  "E",
  "F",
  "G",
  // Function key
  "F2",
  // Spacebar
  "SPACEBAR",
  // Q key (toggle activator for Q toggle system)
  "Q",
  // Number keys
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  // Special keys
  "=",
  // Auxiliary mouse input
  "MIDDLE_CLICK",
  // Semicolon key
  ";",
  // Auxiliary function keys
  "F10",
  "F11",
  "F12",
  "INSERT",
] as const;

export type InputKey = (typeof INPUT_KEYS)[number];

// 37 Output keys available for emission (letters, punctuation, function, numpad, special)
export const OUTPUT_KEYS = [
  // Letters (11 keys)
  "J",
  "K",
  "L",
  "M",
  "N",
  "O",
  "Q",
  "R",
  "V",
  "X",
  "Z",

  // Punctuation (6 keys)
  ",",
  ".",
  "'",
  ";",
  "]",
  "[",

  // Function Keys (4 keys)
  "F6",
  "F7",
  "F8",
  "F9",

  // Numpad (14 keys)
  "NUMPAD0",
  "NUMPAD1",
  "NUMPAD2",
  "NUMPAD3",
  "NUMPAD4",
  "NUMPAD5",
  "NUMPAD6",
  "NUMPAD7",
  "NUMPAD8",
  "NUMPAD9",
  "NUMPAD_ADD",
  "NUMPAD_MULTIPLY",
  "NUMPAD_DECIMAL",
  "NUMPAD_SUBTRACT",

  // Special Keys (3 keys)
  "BACKSPACE",
  "END",
  "ESCAPE",
] as const;

export type OutputKey = (typeof OUTPUT_KEYS)[number];

// 12 Gesture Types (expanded: single/double/triple/quadruple with long + super_long variants)
export const GESTURE_TYPES = [
  "single",
  "single_long",
  "single_super_long",

  "double",
  "double_long",
  "double_super_long",

  "triple",
  "triple_long",
  "triple_super_long",

  "quadruple",
  "quadruple_long",
  "quadruple_super_long",
] as const;

export type GestureType = (typeof GESTURE_TYPES)[number];

// ============================================================================
// TIMER CONFIGURATION (NEW for Omega system)
// ============================================================================

/**
 * Timer step configuration for TTS countdown timers.
 * Used for timed action tracking.
 */
export interface TimerConfig {
  /** Unique identifier for the timer (e.g., "drop", "burst", "laze") */
  id: string;
  /** Duration in seconds before TTS fires */
  durationSeconds: number;
  /** TTS message to speak when timer completes */
  message: string;
}

// ============================================================================
// SEQUENCE STEP
// ============================================================================

// Timing configuration for a single keypress in a sequence
export interface SequenceStep {
  /** The key to press (e.g., "a", "b", "f1"). Optional if this is a timer-only step. */
  key?: string;

  /** Optional step name for display/debugging */
  name?: string;

  /** Minimum ms before next press (>= 25ms) */
  minDelay?: number;

  /** Maximum ms before next press (variance >= 4ms) */
  maxDelay?: number;

  /**
   * How long to hold the key down (inclusive range in ms).
   * Defaults to [23, 38] if omitted.
   * Uses weighted distribution: 37ms=10%, 29ms=10%, 23ms=10%, rest=70% uniform
   */
  keyDownDuration?: [number, number];

  /**
   * Buffer tier after this key press: determines inter-key randomized delay.
   * If omitted, falls back to using minDelay/maxDelay behavior.
   */
  bufferTier?: "low" | "medium" | "high";

  /**
   * Optional second key to press simultaneously (dual key press).
   * Must be a valid OutputKey.
   */
  dualKey?: OutputKey;

  /**
   * Delay in ms before pressing the second key (after primary key down).
   * Must be >= 1ms if provided. Defaults to 6ms.
   */
  dualKeyOffsetMs?: number;

  /**
   * How long to hold the dual key down (inclusive range in ms).
   * Defaults to same as keyDownDuration if omitted.
   */
  dualKeyDownDuration?: [number, number];

  /**
   * If true, this key will be held down through the next step's execution
   * and released during the next step's buffer period.
   * Used for focus target modifiers (e.g., Shift+R) that need to remain
   * held while the next ability executes.
   */
  holdThroughNext?: boolean;

  /**
   * Minimum delay (ms) before releasing a held modifier during next step's buffer.
   * Only applies if holdThroughNext is true.
   * Must be >= 1ms. Defaults to 7ms.
   */
  releaseDelayMin?: number;

  /**
   * Maximum delay (ms) before releasing a held modifier during next step's buffer.
   * Only applies if holdThroughNext is true.
   * Must be >= releaseDelayMin. Defaults to 18ms.
   */
  releaseDelayMax?: number;

  /**
   * Scroll direction for scroll steps. If set, this step performs a scroll instead of keypress.
   */
  scrollDirection?: "up" | "down";

  /**
   * Number of scroll units (lines). Defaults to 3 if scrollDirection is set.
   */
  scrollMagnitude?: number;

  /**
   * Echo hits: rapid repeat keypresses during the buffer phase.
   * The key is held and re-pressed 1-4 times within the specified window
   * to ensure ability activation even with game lag.
   * Format: { count: 1|2|3|4, windowMs: total window time (e.g., 170) }
   * Presses occur during buffer, not as extra delays.
   */
  echoHits?: {
    count: 1 | 2 | 3 | 4;
    windowMs: number;
  };

  /**
   * Timer configuration for TTS countdown timers (NEW for Omega system).
   * If set, this step starts a timer instead of (or in addition to) pressing a key.
   * Timer steps without a key will only start the timer.
   * Timer steps with a key will press the key AND start the timer.
   */
  timer?: TimerConfig;
}

export type ActionIdentifier = string;

// A macro binding: gesture triggers a sequence
export interface MacroBinding {
  name: string;
  trigger?: {
    key: InputKey;
    gesture: GestureType;
  };
  sequence: SequenceStep[];
  enabled: boolean;

  /**
   * Optional action identifier for cooldown tracking.
   * This enables the GCD system to:
   * - Queue sequences during GCD lockout
   * - Track per-ability cooldowns
   * - Execute most-recent-wins logic
   *
   * If omitted, the system will attempt to detect from the macro name.
   */
  actionId?: ActionIdentifier;
}

// Gesture detection timing settings
export interface GestureSettings {
  multiPressWindow: number; // Window for detecting multi-presses (ms)
  debounceDelay: number; // Debounce for key events (ms)
  longPressMin: number; // Minimum for long press (ms)
  longPressMax: number; // Maximum for long press (ms)
  superLongMin: number; // Minimum for super long (ms)
  superLongMax: number; // Maximum for super long (ms)
  cancelThreshold: number; // Hold time to trigger cancel (ms)
}

// Complete macro profile
export interface MacroProfile {
  name: string;
  description: string;
  gestureSettings: GestureSettings;
  macros: MacroBinding[];
}

/**
 * Modifier conflict type
 * - 'shift': key conflicts with SHIFT variant only
 * - 'alt': key conflicts with ALT variant only
 * - 'both': key conflicts with both SHIFT and ALT variants
 */
export type ModifierConflict = "shift" | "alt" | "both";

/**
 * Compiled profile for fast runtime lookup
 * - conflictKeys: raw keys that also appear with modifiers
 * - modifierConflicts: map of key -> which modifier(s) it conflicts with
 * - safeKeys: raw keys that do not appear with modifiers
 */
export interface CompiledProfile {
  conflictKeys: Set<string>;
  modifierConflicts: Map<string, ModifierConflict>;
  safeKeys: Set<string>;
}

// Gesture detection event
export interface GestureEvent {
  inputKey: InputKey;
  gesture: GestureType;
  timestamp: number;
  holdDuration?: number;
}

export interface BlockerInfo {
  reason: string;
  cooldownMs: number;
}

// Sequence execution constraints
export const SEQUENCE_CONSTRAINTS = {
  MIN_DELAY: 25, // Never faster than 25ms
  MIN_VARIANCE: 4, // max - min must be >= 4ms
  MAX_UNIQUE_KEYS: 6, // Maximum 6 unique keys per sequence
  MAX_STEPS_PER_KEY: 6, // Maximum 6 steps per key
} as const;

// ============================================================================
// CALIBRATION SYSTEM TYPES (re-export for convenience)
// ============================================================================

export type {
  RawCalibrationData,
  CalibrationStatistics,
  CalibrationData,
  CalculatedThresholds,
  KeyProfile,
  CalibratedMacroProfile,
  CalibrationConfig,
  CalibrationStep,
  ServerMessage,
  ClientCommand,
} from "./calibrationTypes.js";
