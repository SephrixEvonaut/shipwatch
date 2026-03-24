// ============================================================================
// GESTURE DETECTOR - Per-key gesture detection with calibration support
// ============================================================================
//
// FEATURES:
// - Per-key isolated state machines (24 independent keys)
// - Per-key calibrated settings (override global defaults)
// - Simultaneous multi-key gesture detection (press W+A+1+2 at once)
// - Press count capped at 4 (excess presses = quadruple, no long)
// - Non-blocking async-friendly design for concurrent sequences
// - Settings-driven timing (reads from GestureSettings)
// - Await jail prevents accidental triggers after triple/quadruple
// - Hot-reload support for live threshold updates
//
// ============================================================================

import {
  InputKey,
  GestureType,
  GestureSettings,
  GestureEvent,
  INPUT_KEYS,
} from "./types.js";
import { performance } from "perf_hooks";

export type GestureCallback = (event: GestureEvent) => void;

// Maximum press count before treating as quadruple
const MAX_PRESS_COUNT = 4;

// Await jail durations (ms) - blocks new gestures after multi-tap
const TRIPLE_JAIL_DURATION = 120; // After triple, block for 120ms
const QUADRUPLE_JAIL_DURATION = 200; // After quadruple, block for 200ms

interface PressRecord {
  timestamp: number;
  // 'normal' = < longPressMin, 'long' = longPressMin..longPressMax,
  // 'super_long' = superLongMin..superLongMax
  pressType: "normal" | "long" | "super_long";
}

// ============================================================================
// KeyGestureStateMachine - Per-key state machine for gesture detection
// Each key has its own completely independent state machine
// ============================================================================
class KeyGestureStateMachine {
  private key: InputKey;
  private globalSettings: GestureSettings;
  private keySpecificSettings: GestureSettings | null = null;
  private emitFn: (event: GestureEvent) => void;

  private pressHistory: PressRecord[] = [];
  private keyDownTime: number | null = null;
  private gestureTimer: ReturnType<typeof setTimeout> | null = null;

  // Track if we've exceeded the press limit (ignore further presses until reset)
  private pressLimitReached: boolean = false;

  // Elongating window with dynamic timing from settings
  private windowDeadline: number | null = null;
  private waitingForRelease: boolean = false; // Must wait for final key release

  // Track if the current keyDown occurred within the window (for long/super_long detection)
  // This allows held keys to count toward the sequence even if released after window expires
  private keyDownWasWithinWindow: boolean = false;

  // Await jail: after triple/quadruple, block new sequence for N ms
  private awaitJailUntil: number = 0;

  constructor(
    key: InputKey,
    globalSettings: GestureSettings,
    emitFn: (event: GestureEvent) => void,
  ) {
    this.key = key;
    this.globalSettings = globalSettings;
    this.emitFn = emitFn;
  }

  /**
   * Get the active settings (key-specific or global fallback)
   */
  private getActiveSettings(): GestureSettings {
    return this.keySpecificSettings || this.globalSettings;
  }

  /**
   * Settings-driven timing (instead of hardcoded constants)
   */
  private get initialWindow(): number {
    return this.getActiveSettings().multiPressWindow;
  }

  /**
   * Extension window: 80% of initial window for subsequent presses
   * This gives comfortable timing for multi-tap sequences
   */
  private get extensionWindow(): number {
    return Math.round(this.getActiveSettings().multiPressWindow * 0.8);
  }

  /**
   * Update global settings at runtime (e.g., when profile changes)
   */
  updateGlobalSettings(settings: GestureSettings): void {
    this.globalSettings = settings;
  }

  /**
   * Set key-specific settings (overrides global)
   */
  setKeySpecificSettings(settings: GestureSettings | null): void {
    this.keySpecificSettings = settings;
  }

  /**
   * Get the currently active settings for this key
   */
  getSettings(): GestureSettings {
    return this.getActiveSettings();
  }

  /**
   * Check if this key has custom settings
   */
  hasCustomSettings(): boolean {
    return this.keySpecificSettings !== null;
  }

  private clearTimers(): void {
    if (this.gestureTimer) {
      clearTimeout(this.gestureTimer);
      this.gestureTimer = null;
    }
  }

  private emitGesture(gesture: GestureType, holdDuration?: number): void {
    // Emit the gesture via callback (non-blocking)
    // Using queueMicrotask for cross-platform compatibility
    queueMicrotask(() => {
      try {
        this.emitFn({
          inputKey: this.key,
          gesture,
          timestamp: performance.now(),
          holdDuration,
        });
      } catch {
        // swallow callback errors
      }
    });

    // Reset state (reuse array to reduce allocations)
    this.pressHistory.length = 0;
    this.pressLimitReached = false;
  }

  /**
   * Resolve gesture based on press count and long press state
   */
  private resolveGesture(): void {
    const count = this.pressHistory.length;
    if (count === 0) return;

    const lastPress = this.pressHistory[count - 1];
    let gesture: GestureType;

    // Helper to map count + pressType -> gesture string
    const mapGesture = (
      n: number,
      type: PressRecord["pressType"],
    ): GestureType => {
      const base =
        n === 1
          ? "single"
          : n === 2
            ? "double"
            : n === 3
              ? "triple"
              : "quadruple";
      if (type === "normal") return base as GestureType;
      if (type === "long") return `${base}_long` as GestureType;
      return `${base}_super_long` as GestureType;
    };

    const capped = Math.min(count, MAX_PRESS_COUNT);
    gesture = mapGesture(capped, lastPress.pressType);

    // Await jail: after triple or quadruple, block new sequence for N ms
    // This prevents accidental 5th/6th taps from starting new gestures
    if (gesture.startsWith("triple")) {
      this.awaitJailUntil = performance.now() + TRIPLE_JAIL_DURATION;
    } else if (gesture.startsWith("quadruple")) {
      this.awaitJailUntil = performance.now() + QUADRUPLE_JAIL_DURATION;
    }

    this.emitGesture(gesture);
  }

  handleKeyDown(): void {
    const now = performance.now();

    // Await jail: block new sequence if still in jail
    if (now < this.awaitJailUntil) {
      return;
    }

    // CRITICAL: Ignore key repeat events (key already held down)
    // This prevents Windows key repeat from triggering multiple presses
    if (this.keyDownTime !== null) {
      return; // Key is already down, this is a repeat event
    }

    // If we've already hit the press limit, ignore this press
    if (this.pressLimitReached) {
      return;
    }

    // Determine if this keyDown is within the elongating window
    const withinWindow =
      this.windowDeadline !== null && now <= this.windowDeadline;

    if (withinWindow) {
      // This keyDown is within the window - it will count toward the current sequence
      this.keyDownWasWithinWindow = true;

      // Clear any pending timer as we're continuing the sequence
      if (this.gestureTimer) {
        clearTimeout(this.gestureTimer);
        this.gestureTimer = null;
      }

      // CRITICAL: Extend window from THIS keyDown time using settings-driven timing
      this.windowDeadline = now + this.extensionWindow;
    } else {
      // This keyDown is outside the window - it starts a new sequence
      if (!this.waitingForRelease) {
        this.pressHistory.length = 0;
        this.pressLimitReached = false;
      }
      this.keyDownWasWithinWindow = false; // First press of new sequence

      // CRITICAL: Set initial window from THIS keyDown time using settings-driven timing
      this.windowDeadline = now + this.initialWindow;
    }

    this.keyDownTime = now;

    // Handle 4th press special case - will resolve immediately on release
    if (
      this.pressHistory.length === 3 &&
      (withinWindow || this.waitingForRelease)
    ) {
      this.windowDeadline = null;
      this.waitingForRelease = true;
    }
  }

  handleKeyUp(): void {
    if (this.keyDownTime === null) return;

    const now = performance.now();
    const holdDuration = now - this.keyDownTime;
    this.keyDownTime = null;

    // If press limit already reached, ignore this key up
    if (this.pressLimitReached) {
      return;
    }

    const settings = this.getActiveSettings();

    // If hold exceeded cancel threshold, nullify only this key's recording
    if (holdDuration >= settings.cancelThreshold) {
      this.pressHistory.length = 0;
      this.windowDeadline = null;
      this.waitingForRelease = false;
      return;
    }

    // Determine press type for this tap based on holdDuration (settings-driven)
    let pressType: PressRecord["pressType"] = "normal";
    if (
      holdDuration >= settings.longPressMin &&
      holdDuration <= settings.longPressMax
    ) {
      pressType = "long";
    } else if (
      holdDuration >= settings.superLongMin &&
      holdDuration <= settings.superLongMax
    ) {
      pressType = "super_long";
    }

    // Determine if this press counts toward the current sequence
    const countsTowardSequence =
      this.pressHistory.length === 0 || // First press always counts
      this.keyDownWasWithinWindow || // KeyDown was within window
      this.waitingForRelease; // Waiting for 4th press

    if (!countsTowardSequence) {
      // KeyDown was after window expired - start fresh sequence
      this.pressHistory.length = 0;
      this.pressLimitReached = false;
      this.waitingForRelease = false;
    }

    // Record this press (normal/long/super_long)
    this.pressHistory.push({ timestamp: now, pressType });

    // If we've reached the max press count (4th press), resolve immediately
    if (this.pressHistory.length >= MAX_PRESS_COUNT) {
      this.pressLimitReached = true;
      this.waitingForRelease = false;
      this.windowDeadline = null;
      if (this.gestureTimer) {
        clearTimeout(this.gestureTimer);
        this.gestureTimer = null;
      }
      this.resolveGesture();
      return;
    }
  }

  /**
   * Check if a pending gesture should be finalized
   * Called periodically by the parent GestureDetector
   */
  checkPendingGesture(): void {
    // If no presses recorded, nothing to do
    if (this.pressHistory.length === 0) return;

    // If currently pressing a key, don't finalize yet
    if (this.keyDownTime !== null) return;

    // If waiting for 4th press release, don't finalize
    if (this.waitingForRelease) return;

    // Check if window has expired
    const now = performance.now();
    if (this.windowDeadline !== null && now > this.windowDeadline) {
      // Window expired, finalize gesture
      this.windowDeadline = null;
      this.resolveGesture();
    }
  }

  /**
   * Reset this key's state machine
   */
  reset(): void {
    this.clearTimers();
    this.pressHistory.length = 0;
    this.keyDownTime = null;
    this.pressLimitReached = false;
    this.windowDeadline = null;
    this.waitingForRelease = false;
    this.keyDownWasWithinWindow = false;
    this.awaitJailUntil = 0;
  }
}

// ============================================================================
// GestureDetector - Orchestrates all per-key state machines
// ============================================================================
export class GestureDetector {
  private machines: Map<InputKey, KeyGestureStateMachine> = new Map();
  private _callback: GestureCallback;
  private listeners: Set<GestureCallback> = new Set();
  private globalSettings: GestureSettings;
  private eventQueue: Array<{
    type: "down" | "up";
    key: string;
    timestamp: number;
  }> = [];
  private processingQueue: boolean = false;
  private checkInterval: ReturnType<typeof setInterval> | null = null;
  private isStopped: boolean = false;

  constructor(settings: GestureSettings, callback: GestureCallback) {
    this.globalSettings = settings;
    this._callback = callback;

    // Create a state machine for each input key
    for (const key of INPUT_KEYS) {
      this.machines.set(
        key,
        new KeyGestureStateMachine(key, settings, (ev) => {
          // CRITICAL: Don't emit gestures after destroy
          if (this.isStopped) return;
          try {
            this._callback(ev);
          } catch {
            // swallow callback errors
          }
          // Notify additional listeners
          for (const listener of this.listeners) {
            try {
              listener(ev);
            } catch {
              // swallow listener errors
            }
          }
        }),
      );
    }

    // Start interval to check for pending gestures (20ms for responsive timing)
    this.checkInterval = setInterval(() => {
      this.checkAllPendingGestures();
    }, 20);
  }

  /**
   * Handle key down event
   */
  handleKeyDown(key: string): void {
    this.queueEvent("down", key);
  }

  /**
   * Handle key up event
   */
  handleKeyUp(key: string): void {
    this.queueEvent("up", key);
  }

  /**
   * Handle mouse button down (for MIDDLE_CLICK)
   */
  handleMouseDown(button: string): void {
    if (button === "MIDDLE_CLICK") {
      this.queueEvent("down", button);
    }
  }

  /**
   * Handle mouse button up (for MIDDLE_CLICK)
   */
  handleMouseUp(button: string): void {
    if (button === "MIDDLE_CLICK") {
      this.queueEvent("up", button);
    }
  }

  /**
   * Reset all state machines
   */
  reset(): void {
    for (const machine of this.machines.values()) {
      machine.reset();
    }
  }

  /**
   * Replace the callback used by all per-key machines at runtime
   */
  setCallback(cb: GestureCallback): void {
    this._callback = cb;
  }

  /**
   * Subscribe to gesture events without replacing the central callback
   */
  onGesture(cb: GestureCallback): void {
    this.listeners.add(cb);
  }

  /**
   * Unsubscribe a previously registered gesture listener
   */
  offGesture(cb: GestureCallback): void {
    this.listeners.delete(cb);
  }

  get callback(): GestureCallback {
    return this._callback;
  }

  set callback(cb: GestureCallback) {
    this.setCallback(cb);
  }

  /**
   * Get current event queue depth (for testing/monitoring)
   */
  getQueueDepth(): number {
    return this.eventQueue.length;
  }

  /**
   * Check all key state machines for pending gestures that should be finalized
   */
  private checkAllPendingGestures(): void {
    // CRITICAL: Don't emit any gestures after destroy
    if (this.isStopped) {
      return;
    }
    for (const machine of this.machines.values()) {
      machine.checkPendingGesture();
    }
  }

  /**
   * Queue a key event for processing
   * Uses immediate processing for low-latency with queue fallback for bursts
   */
  private queueEvent(type: "down" | "up", key: string): void {
    // Queue overflow protection
    if (this.eventQueue.length >= 100) {
      console.error(`❌ Queue overflow, dropping event`);
      return;
    }
    // CRITICAL: Ignore ALL events after destroy() is called
    if (this.isStopped) {
      return;
    }

    const event = { type, key, timestamp: Date.now() };

    // Process immediately if not already processing
    if (!this.processingQueue) {
      this.processEvent(event);
    } else {
      // Queue for later processing
      this.eventQueue.push(event);

      // Warn if queue is getting large (potential issue)
      if (this.eventQueue.length > 50) {
        console.warn(
          `⚠️  Event queue building up: ${this.eventQueue.length} events`,
        );
      }
    }
  }

  /**
   * Process a single event
   */
  private processEvent(event: {
    type: "down" | "up";
    key: string;
    timestamp: number;
  }): void {
    this.processingQueue = true;

    try {
      const upperKey = event.key.toUpperCase() as InputKey;
      const machine = this.machines.get(upperKey);

      if (machine) {
        if (event.type === "down") {
          machine.handleKeyDown();
        } else {
          machine.handleKeyUp();
        }
      }

      // Process any queued events
      while (this.eventQueue.length > 0) {
        const nextEvent = this.eventQueue.shift()!;
        const nextKey = nextEvent.key.toUpperCase() as InputKey;
        const nextMachine = this.machines.get(nextKey);

        if (nextMachine) {
          if (nextEvent.type === "down") {
            nextMachine.handleKeyDown();
          } else {
            nextMachine.handleKeyUp();
          }
        }
      }
    } finally {
      this.processingQueue = false;
    }
  }

  /**
   * Update global gesture settings for all machines
   */
  updateSettings(settings: GestureSettings): void {
    this.globalSettings = settings;

    // Clear existing interval
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }

    // Update each machine's global settings
    for (const machine of this.machines.values()) {
      machine.updateGlobalSettings(settings);
    }

    // Restart interval with 20ms check time
    this.checkInterval = setInterval(() => {
      this.checkAllPendingGestures();
    }, 20);
  }

  // ==========================================================================
  // PER-KEY CALIBRATION SUPPORT
  // ==========================================================================

  /**
   * Update settings for a specific key (hot-reload support)
   * This overrides the global settings for this key only
   */
  updateKeyProfile(key: InputKey, settings: GestureSettings): void {
    const machine = this.machines.get(key);
    if (machine) {
      machine.setKeySpecificSettings(settings);
      console.log(`✅ Updated ${key} profile`);
    } else {
      console.warn(`⚠️  Key ${key} not found`);
    }
  }

  /**
   * Clear key-specific settings (revert to global)
   */
  clearKeyProfile(key: InputKey): void {
    const machine = this.machines.get(key);
    if (machine) {
      machine.setKeySpecificSettings(null);
      console.log(`🔄 Cleared ${key} profile (using global settings)`);
    }
  }

  /**
   * Get the active profile for a specific key
   */
  getKeyProfile(key: InputKey): GestureSettings | null {
    const machine = this.machines.get(key);
    return machine ? machine.getSettings() : null;
  }

  /**
   * Get all key profiles (for export/status)
   */
  getAllProfiles(): Record<string, GestureSettings> {
    const profiles: Record<string, GestureSettings> = {};

    for (const [key, machine] of this.machines) {
      profiles[key] = machine.getSettings();
    }

    return profiles;
  }

  /**
   * Get keys that have custom (non-global) settings
   */
  getCustomizedKeys(): InputKey[] {
    const customized: InputKey[] = [];

    for (const [key, machine] of this.machines) {
      if (machine.hasCustomSettings()) {
        customized.push(key);
      }
    }

    return customized;
  }

  /**
   * Load multiple key profiles at once
   */
  loadKeyProfiles(profiles: Record<string, GestureSettings>): void {
    for (const [key, settings] of Object.entries(profiles)) {
      this.updateKeyProfile(key as InputKey, settings);
    }
  }

  /**
   * Get the global (default) settings
   */
  getGlobalSettings(): GestureSettings {
    return { ...this.globalSettings };
  }

  /**
   * Destroy the gesture detector - stop all timers and clear state
   */
  destroy(): void {
    this.isStopped = true;

    // Clear interval
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }

    // Reset all machines
    for (const machine of this.machines.values()) {
      machine.reset();
    }

    // Clear event queue
    this.eventQueue.length = 0;

    // Clear listeners
    this.listeners.clear();
  }
}
