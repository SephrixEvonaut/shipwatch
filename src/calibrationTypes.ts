// ============================================================================
// CALIBRATION TYPES - Extended type definitions for gesture calibration system
// ============================================================================

import {
  InputKey,
  GestureType,
  GestureSettings,
  GestureEvent,
  INPUT_KEYS,
} from "./types.js";

// ============================================================================
// CALIBRATION DATA STRUCTURES
// ============================================================================

/**
 * Raw timing data collected during calibration for a single key
 */
export interface RawCalibrationData {
  key: InputKey;
  singleTaps: number[]; // Hold durations for single taps in ms
  longHolds: number[]; // Hold durations for long presses in ms
  superLongHolds: number[]; // Hold durations for super long presses in ms
  doubleTapGaps: number[]; // Time gaps between taps for double-tap
  tripleTapGaps: number[]; // Time gaps between taps for triple-tap (flattened)
  quadrupleTapGaps: number[]; // Time gaps between taps for quadruple-tap (flattened)
  collectedAt: string; // ISO timestamp when collection started
}

/**
 * Statistical analysis of calibration samples
 */
export interface CalibrationStatistics {
  mean: number;
  median: number;
  stdDev: number;
  min: number;
  max: number;
  percentile10: number;
  percentile90: number;
  sampleCount: number;
  outlierCount: number; // Samples removed as outliers
}

/**
 * Complete calibration data with metadata
 */
export interface CalibrationData {
  calibratedAt: string; // ISO timestamp of calibration completion
  sampleSize: number; // Total samples collected
  outlierCount: number; // Total outliers removed
  confidence: number; // 0-100 confidence score
  averages: {
    singleTap: number;
    longHold: number;
    superLongHold: number;
    multiTapGap: number;
  };
  stdDeviations: {
    singleTap: number;
    longHold: number;
    superLongHold: number;
    multiTapGap: number;
  };
  ranges: {
    singleTap: [number, number];
    longHold: [number, number];
    superLongHold: [number, number];
    multiTapGap: [number, number];
  };
  reasoning: string[]; // Human-readable explanation of threshold choices
}

/**
 * Calculated thresholds from calibration analysis
 */
export interface CalculatedThresholds {
  key: InputKey;

  // Press duration thresholds
  singleTapMax: number; // Upper bound for normal tap
  longPressMin: number; // Lower bound for long press
  longPressMax: number; // Upper bound for long press
  superLongMin: number; // Lower bound for super long press
  superLongMax: number; // Upper bound for super long press
  cancelThreshold: number; // Above this = cancel gesture

  // Multi-tap timing
  multiPressWindow: number; // Window for detecting multi-taps
  extensionWindow: number; // 80% of multiPressWindow (derived)
  debounceDelay: number; // Debounce for key events (usually constant)

  // Metadata
  confidence: number; // 0-100 score
  sampleSize: number; // Total samples used
  outlierCount: number; // Samples discarded
  reasoning: string[]; // Explanation of each threshold
}

/**
 * Extended key profile with calibration data
 */
export interface KeyProfile extends GestureSettings {
  calibrationData?: CalibrationData;
  specialBehavior?: "singleGesturesOnly" | "noMultiTap";
}

/**
 * Extended macro profile with per-key calibration
 */
export interface CalibratedMacroProfile {
  name: string;
  description: string;
  calibrationVersion?: string;
  calibratedAt?: string;
  calibrationToolVersion?: string;
  gestureSettings: GestureSettings; // Global defaults
  keyProfiles?: Record<string, KeyProfile>; // Per-key overrides
  macros: any[]; // Original macro bindings
}

// ============================================================================
// CALIBRATION WIZARD STATE
// ============================================================================

/**
 * Current state of the calibration wizard
 */
export interface CalibrationWizardState {
  phase: "idle" | "collecting" | "analyzing" | "reviewing" | "complete";
  currentKey: InputKey | null;
  currentStep: CalibrationStep;
  stepProgress: number; // 0-10 for samples collected
  totalKeysCalibrated: number;
  totalKeysRemaining: number;
  currentStepData: number[]; // Timing data for current step
  error: string | null;
}

/**
 * Steps in the calibration process
 */
export type CalibrationStep =
  | "single_tap"
  | "long_hold"
  | "super_long_hold"
  | "double_tap"
  | "triple_tap"
  | "quadruple_tap"
  | "complete";

export const CALIBRATION_STEPS: CalibrationStep[] = [
  "single_tap",
  "long_hold",
  "super_long_hold",
  "double_tap",
  "triple_tap",
  "quadruple_tap",
];

export const STEP_NAMES: Record<CalibrationStep, string> = {
  single_tap: "Single Tap (Quick Press)",
  long_hold: "Long Hold",
  super_long_hold: "Super Long Hold",
  double_tap: "Double Tap Speed",
  triple_tap: "Triple Tap Speed",
  quadruple_tap: "Quadruple Tap Speed",
  complete: "Complete",
};

export const STEP_INSTRUCTIONS: Record<CalibrationStep, string> = {
  single_tap:
    "Perform quick taps of the key as you would during normal gameplay.",
  long_hold:
    "Hold the key for what feels like a 'long' press. Think: charging an ability.",
  super_long_hold:
    "Hold the key for a 'very long' press. Longer than long, but not forever.",
  double_tap: "Double-tap the key at your natural speed.",
  triple_tap: "Triple-tap the key at your natural speed.",
  quadruple_tap: "Quadruple-tap the key at your natural speed.",
  complete: "Calibration complete!",
};

// ============================================================================
// HOT-RELOAD SERVER TYPES
// ============================================================================

/**
 * WebSocket message types from server to client
 */
export type ServerMessage =
  | {
      type: "GESTURE_DETECTED";
      key: InputKey;
      gesture: GestureType;
      timing?: number;
      timestamp: number;
    }
  | {
      type: "PROFILE_UPDATED";
      key: InputKey;
      profile: KeyProfile;
      timestamp: number;
    }
  | { type: "CALIBRATION_STARTED"; keys: InputKey[] | "all"; timestamp: number }
  | { type: "RECENT_GESTURES"; key: InputKey; gestures: GestureEvent[] }
  | { type: "KEY_PROFILE"; key: InputKey; profile: GestureSettings }
  | { type: "ALL_PROFILES"; profiles: Record<string, GestureSettings> }
  | { type: "SUBSCRIBED"; key: InputKey }
  | { type: "SUCCESS"; key?: InputKey; message: string }
  | { type: "ERROR"; message: string }
  | { type: "EXPORT_COMPLETE"; filename: string; path: string };

/**
 * WebSocket command types from client to server
 */
export type ClientCommand =
  | {
      type: "UPDATE_KEY_PROFILE";
      key: InputKey;
      profile: Partial<GestureSettings>;
    }
  | { type: "START_CALIBRATION"; keys?: InputKey[] }
  | { type: "GET_RECENT_GESTURES"; key: InputKey; count?: number }
  | { type: "GET_CURRENT_PROFILE"; key?: InputKey }
  | { type: "SUBSCRIBE_KEY"; key: InputKey }
  | { type: "UNSUBSCRIBE_KEY"; key: InputKey }
  | { type: "EXPORT_PROFILE"; filename?: string }
  | { type: "LOAD_PROFILE"; path: string };

// ============================================================================
// CALIBRATION CONFIGURATION
// ============================================================================

/**
 * Configuration for the calibration process
 */
export interface CalibrationConfig {
  samplesPerStep: number; // Number of samples to collect per step (default: 10)
  outlierStdDevThreshold: number; // Std deviations for outlier detection (default: 2)
  safetyMarginMs: number; // Safety margin added to thresholds (default: 50)
  multiPressWindowMultiplier: number; // Multiplier for gap mean (default: 2.5)
  minThresholdGapMs: number; // Minimum gap between threshold ranges (default: 10)
  quickMode: boolean; // Quick mode uses fewer samples (default: false)
  quickModeSamples: number; // Samples in quick mode (default: 5)
  preselectedKeys?: string[]; // Keys to calibrate (optional, prompts if not provided)
}

export const DEFAULT_CALIBRATION_CONFIG: CalibrationConfig = {
  samplesPerStep: 10,
  outlierStdDevThreshold: 2,
  safetyMarginMs: 50,
  multiPressWindowMultiplier: 2.5,
  minThresholdGapMs: 10,
  quickMode: false,
  quickModeSamples: 5,
};

// ============================================================================
// SPECIAL KEY CONFIGURATIONS
// ============================================================================

/**
 * Keys with special calibration requirements
 */
export interface SpecialKeyConfig {
  key: InputKey;
  skipMultiTap: boolean; // Skip double/triple/quadruple calibration
  usePresetThresholds: boolean; // Use preset instead of calibrating
  presetProfile?: Partial<GestureSettings>;
  note?: string;
}

/**
 * D-key special configuration (single gestures only)
 */
export const D_KEY_SPECIAL_CONFIG: SpecialKeyConfig = {
  key: "D",
  skipMultiTap: true,
  usePresetThresholds: false,
  note: "D key only supports single gestures (no multi-tap)",
};

/**
 * Get special configuration for a key if it exists
 */
export function getSpecialKeyConfig(key: InputKey): SpecialKeyConfig | null {
  if (key === "D") return D_KEY_SPECIAL_CONFIG;
  return null;
}

// ============================================================================
// CALIBRATION RESULTS
// ============================================================================

/**
 * Complete calibration session results
 */
export interface CalibrationSessionResult {
  sessionId: string;
  startedAt: string;
  completedAt: string;
  toolVersion: string;
  globalDefaults: GestureSettings;
  keyProfiles: Record<string, KeyProfile>;
  keysCalibrated: InputKey[];
  keysSkipped: InputKey[];
  totalSamples: number;
  averageConfidence: number;
}

/**
 * Result of validating thresholds
 */
export interface ThresholdValidationResult {
  valid: boolean;
  warnings: string[];
  errors: string[];
  adjustments: string[];
}

// ============================================================================
// CLI TYPES
// ============================================================================

/**
 * CLI command parsing result
 */
export interface ParsedCommand {
  command: string;
  args: string[];
  flags: Record<string, string | boolean>;
}

/**
 * CLI display configuration
 */
export interface CLIDisplayConfig {
  showRawTimings: boolean;
  showStatistics: boolean;
  showConfidence: boolean;
  useColors: boolean;
  progressBarWidth: number;
}

export const DEFAULT_CLI_DISPLAY: CLIDisplayConfig = {
  showRawTimings: true,
  showStatistics: true,
  showConfidence: true,
  useColors: true,
  progressBarWidth: 40,
};

// ============================================================================
// EXPORTS
// ============================================================================

export { InputKey, GestureType, GestureSettings, GestureEvent, INPUT_KEYS };
