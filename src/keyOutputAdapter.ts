// ============================================================================
// KEY OUTPUT ADAPTER - Abstraction layer for keyboard output backends
// ============================================================================
//
// This module defines a common interface for keyboard output, allowing
// the SequenceExecutor and SpecialKeyHandler to work with either:
//   - RobotJS (software-level keyboard simulation)
//   - Teensy 4.0 (hardware USB HID keyboard via serial)
//
// The adapter also carries backend metadata so consumers can conditionally
// enable/disable software-mode optimizations (output pacing, queue pressure
// monitoring).
//
// ============================================================================

import { ExecutorBackend } from "./executorFactory.js";

/**
 * Backend mode determines which workarounds are active:
 * - "software": Full RobotJS workarounds (RepeatPolice, pressure monitor, aggressive pacing)
 * - "teensy": No workarounds needed (hardware USB HID output, no queue contention)
 */
export type BackendMode = "software" | "teensy";

/**
 * Unified key output interface used by SequenceExecutor and SpecialKeyHandler
 */
export interface IKeyOutputAdapter {
  /** Which backend mode is active */
  readonly mode: BackendMode;

  /** Press key down with optional modifiers */
  keyToggle(key: string, direction: "down" | "up", modifiers?: string[]): void;

  /** Tap a key briefly with optional modifiers */
  keyTap(key: string, modifiers?: string[]): void;

  /** Scroll the mouse wheel */
  scrollMouse(x: number, y: number): void;

  /** Set keyboard delay (robotjs-specific, no-op for teensy) */
  setKeyboardDelay(ms: number): void;

  /**
   * Press a key for a specific duration (teensy-optimized path).
   * For robotjs, this is keyToggle down → sleep → keyToggle up.
   * For teensy, this is a single serial command with built-in duration.
   */
  pressKeyForDuration?(
    key: string,
    durationMs: number,
    modifiers?: string[],
  ): Promise<void>;
}

/**
 * RobotJS adapter - wraps the robotjs module
 */
export class RobotJSAdapter implements IKeyOutputAdapter {
  readonly mode: BackendMode = "software";
  private robot: any;

  constructor() {
    // Dynamic import would be async, so we do sync require-style
    // robotjs is already imported at the top of sequenceExecutor.ts
    // This adapter is constructed with the already-imported robot
    this.robot = null;
  }

  /** Initialize with the robotjs module reference */
  init(robotModule: any): void {
    this.robot = robotModule;
  }

  keyToggle(key: string, direction: "down" | "up", modifiers?: string[]): void {
    if (!this.robot) return;
    this.robot.keyToggle(key, direction, modifiers);
  }

  keyTap(key: string, modifiers?: string[]): void {
    if (!this.robot) return;
    this.robot.keyTap(key, modifiers);
  }

  scrollMouse(x: number, y: number): void {
    if (!this.robot) return;
    this.robot.scrollMouse(x, y);
  }

  setKeyboardDelay(ms: number): void {
    if (!this.robot) return;
    this.robot.setKeyboardDelay(ms);
  }
}

/**
 * Teensy adapter - wraps TeensyExecutor for serial communication
 */
export class TeensyAdapter implements IKeyOutputAdapter {
  readonly mode: BackendMode = "teensy";
  private teensyExecutor: any; // TeensyExecutor instance

  constructor(teensyExecutor: any) {
    this.teensyExecutor = teensyExecutor;
  }

  keyToggle(key: string, direction: "down" | "up", modifiers?: string[]): void {
    // Teensy doesn't support separate down/up - it does press+hold+release atomically
    // For "down", we send a minimal press; for "up", it's a no-op
    if (direction === "down") {
      // Fire and forget a minimal press - the actual hold duration is handled by pressKeyForDuration
      this.teensyExecutor
        .pressKey(key, 10, modifiers || [])
        .catch((err: Error) => {
          console.error(`[Teensy] keyToggle error: ${err.message}`);
        });
    }
    // "up" is a no-op - Teensy auto-releases after duration
  }

  keyTap(key: string, modifiers?: string[]): void {
    this.teensyExecutor
      .pressKey(key, 50, modifiers || [])
      .catch((err: Error) => {
        console.error(`[Teensy] keyTap error: ${err.message}`);
      });
  }

  scrollMouse(_x: number, _y: number): void {
    // Teensy doesn't handle mouse scroll - this stays on the host
    // For scroll steps, we fall back to robotjs if available
    try {
      const robot = require("robotjs");
      robot.scrollMouse(_x, _y);
    } catch {
      console.warn("[Teensy] scrollMouse not available (no robotjs fallback)");
    }
  }

  setKeyboardDelay(_ms: number): void {
    // No-op for Teensy
  }

  /**
   * Press a key for a specific duration - the primary Teensy output method.
   * Sends a single serial command; the Teensy handles the hold internally.
   */
  async pressKeyForDuration(
    key: string,
    durationMs: number,
    modifiers?: string[],
  ): Promise<void> {
    await this.teensyExecutor.pressKey(key, durationMs, modifiers || []);
  }
}

/**
 * Determine backend mode from executor backend name
 */
export function getBackendMode(backend: ExecutorBackend): BackendMode {
  return backend === "teensy" ? "teensy" : "software";
}
