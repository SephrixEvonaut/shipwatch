// ============================================================================
// SEQUENCE EXECUTOR - Sends keypresses with human-like timing
// ============================================================================
//
// FEATURES:
// - Multiple concurrent sequences (different bindings run in parallel)
// - Per-binding execution tracking (same binding won't overlap)
// - Human-like timing with sophisticated multi-layer randomization
// - Non-blocking async execution
// - TTS timer system
// - Direct timer field support for Omega system
//
// RANDOMIZATION SYSTEM:
// Uses HumanRandomizer for all timing values which provides:
// - Hash-based pseudo-randomness (appears random, deterministic)
// - Gaussian bias toward "sweet spot" values humans naturally produce
// - History-based "correction" that reinforces natural distributions
// - Multi-layer obfuscation that resists statistical detection
//
// ============================================================================

import robot from "robotjs";
import {
  SequenceStep,
  MacroBinding,
  SEQUENCE_CONSTRAINTS,
  CompiledProfile,
} from "./types.js";
import { isConflictKey } from "./profileCompiler.js";
import { TrafficController } from "./trafficController.js";
import { TimerManager } from "./timerManager.js";
import { logger } from "./logger.js";
import { getQueuePressureMonitor } from "./queuePressureMonitor.js";
import { type BackendMode } from "./keyOutputAdapter.js";
import {
  getHumanBufferDelay,
  getHumanKeyDownDuration,
  getHumanEchoHitDuration,
  getHumanReleaseDelay,
  getHumanDualKeyOffset,
  getHumanDelay,
  calculateBufferExtension,
} from "./humanRandomizer.js";

export interface ExecutionEvent {
  type: "started" | "step" | "completed" | "error" | "cancelled";
  bindingName: string;
  step?: SequenceStep;
  stepIndex?: number;
  delay?: number;
  error?: string;
  timestamp: number;
}

export type ExecutionCallback = (event: ExecutionEvent) => void;

// Callback to suppress keys in the gesture detector during output
export type SuppressKeyCallback = (key: string, durationMs: number) => void;

export class SequenceExecutor {
  // Per-binding execution state - allows DIFFERENT bindings to run concurrently
  // but prevents the SAME binding from overlapping with itself
  private isExecuting: Map<string, boolean> = new Map();

  // Track all active executions for monitoring
  private activeExecutions: Set<string> = new Set();

  // Global shutdown flag - stops all async operations immediately
  private isShutdown: boolean = false;

  private callback: ExecutionCallback;
  private compiledProfile: CompiledProfile | null = null;
  private trafficController: TrafficController | null = null;
  private timerManager: TimerManager;

  // Callback to suppress synthetic keypresses from being detected
  private suppressKeyCallback: SuppressKeyCallback | null = null;

  // Abort controllers for cancellable sleeps
  private sleepAbortController: AbortController | null = null;

  // Track held modifiers from holdThroughNext steps
  private heldModifier: {
    key: string;
    modifiers: string[];
    releaseDelayMin: number;
    releaseDelayMax: number;
  } | null = null;

  // Track if we need to ensure modifier cleanup before key execution
  private lastModifierCleanup: number = 0;
  private readonly MODIFIER_CLEANUP_INTERVAL_MS = 50; // Clean modifiers every 50ms max

  // OUTPUT PACING: Counter for mouse stutter reduction
  // Every 2nd output: +100ms, Every 3rd output: +120ms, Every 4th output: +190ms
  // Now applies to ALL outputs including Rs and echo hits
  // NOTE: In teensy mode, pacing is DISABLED (separate USB device, no queue contention)
  private outputPaceCounter: number = 0;

  // REPEAT POLICE: Prevents redundant ability spam from backing up the queue
  // Tracks last execution time per ability name
  // If same ability fires within 450ms, delays it 250ms
  // If 3rd/4th duplicate queues during that wait, they get deleted
  // NOTE: Disabled entirely in teensy mode (no queue contention)
  private lastAbilityTimes: Map<string, number> = new Map();
  private repeatPoliceWaiting: Map<string, boolean> = new Map();
  private readonly REPEAT_POLICE_WINDOW_MS = 450;
  private readonly REPEAT_POLICE_DELAY_MS = 250;

  // BACKEND MODE: Determines which workarounds are active
  // "software" = full RobotJS workarounds, "teensy" = no workarounds
  private backendMode: BackendMode;

  // Teensy executor reference (set externally when backend is teensy)
  private teensyExecutor: any = null;

  constructor(
    callback?: ExecutionCallback,
    compiledProfile?: CompiledProfile,
    backendMode: BackendMode = "software",
  ) {
    this.callback = callback || (() => {});
    this.backendMode = backendMode;
    if (compiledProfile) this.setCompiledProfile(compiledProfile);
    this.timerManager = new TimerManager();

    // Configure robotjs for minimal internal delay (only in software mode)
    if (this.backendMode === "software") {
      robot.setKeyboardDelay(1);
    }

    logger.debug(`SequenceExecutor initialized (mode: ${backendMode})`);
    logger.debug(
      "Concurrent sequences: ENABLED (different bindings run in parallel)",
    );
    logger.debug("Per-binding overlap: PREVENTED (same binding won't stack)");
    logger.debug("Randomization: HUMAN-LIKE (multi-layer obfuscation)");
    if (backendMode === "teensy") {
      logger.debug(
        "Teensy mode: RepeatPolice DISABLED, Pressure Monitor DISABLED, Pacing DISABLED",
      );
    }
  }

  /**
   * Get the current backend mode
   */
  getBackendMode(): BackendMode {
    return this.backendMode;
  }

  /**
   * Set the Teensy executor reference for teensy mode key output
   */
  setTeensyExecutor(executor: any): void {
    this.teensyExecutor = executor;
    logger.debug("TeensyExecutor attached to SequenceExecutor");
  }

  /**
   * Provide a compiled profile to enable traffic control.
   */
  setCompiledProfile(compiled: CompiledProfile): void {
    this.compiledProfile = compiled;
    this.trafficController = new TrafficController(compiled);
  }

  /**
   * Set modifier state callback for smart traffic control.
   * This allows traffic controller to only wait when conflicting modifier is held.
   */
  setModifierStateCallback(
    cb: () => { shift: boolean; alt: boolean; ctrl: boolean },
  ): void {
    if (this.trafficController) {
      this.trafficController.setModifierStateCallback(cb);
    }
  }

  /**
   * Set callback to suppress keys in the gesture detector during output.
   * This prevents synthetic keypresses from triggering gestures.
   */
  setSuppressKeyCallback(cb: SuppressKeyCallback): void {
    this.suppressKeyCallback = cb;
  }

  /**
   * Suppress a key for a duration (prevents gesture detection of synthetic keypresses)
   */
  private suppressKey(key: string, durationMs: number = 150): void {
    if (this.suppressKeyCallback) {
      this.suppressKeyCallback(key, durationMs);
    }
  }

  /**
   * Validate a sequence step meets timing constraints
   */
  private validateStep(step: SequenceStep, stepIndex: number): string | null {
    // Timer-only steps have minimal validation
    if (step.timer && !step.key) {
      if (
        !step.timer.id ||
        !step.timer.message ||
        step.timer.durationSeconds <= 0
      ) {
        return `Step ${stepIndex}: timer must have id, message, and positive durationSeconds`;
      }
      return null;
    }

    // Scroll steps have simpler validation
    if (step.scrollDirection) {
      if (!["up", "down"].includes(step.scrollDirection)) {
        return `Step ${stepIndex}: scrollDirection must be "up" or "down"`;
      }
      return null;
    }

    // Allow delay-only steps (minDelay/maxDelay without key)
    if (
      !step.key &&
      (step.minDelay !== undefined || step.maxDelay !== undefined)
    ) {
      // This is a pure delay step - valid
      return null;
    }

    // Steps without a key (and not timer/scroll/delay) are invalid
    if (!step.key) {
      return `Step ${stepIndex}: must have key, timer, or scrollDirection`;
    }

    // If bufferTier is provided, we use tiered buffer delays and skip legacy min/max validation
    if (step.bufferTier) {
      if (!["low", "medium", "high"].includes(step.bufferTier)) {
        return `Step ${stepIndex} ("${step.key}"): bufferTier must be one of low|medium|high`;
      }
    } else if (step.minDelay !== undefined && step.maxDelay !== undefined) {
      if (step.minDelay < SEQUENCE_CONSTRAINTS.MIN_DELAY) {
        return `Step ${stepIndex} ("${step.key}"): minDelay must be >= ${SEQUENCE_CONSTRAINTS.MIN_DELAY}ms (got ${step.minDelay}ms)`;
      }

      const variance = step.maxDelay - step.minDelay;
      if (variance < SEQUENCE_CONSTRAINTS.MIN_VARIANCE) {
        return `Step ${stepIndex} ("${step.key}"): variance (max - min) must be >= ${SEQUENCE_CONSTRAINTS.MIN_VARIANCE}ms (got ${variance}ms)`;
      }
    }

    // Validate keyDownDuration if provided
    if (step.keyDownDuration) {
      const [kmin, kmax] = step.keyDownDuration;
      if (kmin <= 0 || kmax < kmin) {
        return `Step ${stepIndex} ("${step.key}"): keyDownDuration must be [min,max] with min>0 and max>=min`;
      }
    }

    return null;
  }

  /**
   * Validate entire sequence meets constraints
   */
  private validateSequence(sequence: SequenceStep[]): string | null {
    for (let i = 0; i < sequence.length; i++) {
      const step = sequence[i];
      const error = this.validateStep(step, i);
      if (error) return error;
    }

    const keyStepCount: Map<string, number> = new Map();
    for (const step of sequence) {
      // Skip scroll steps and timer-only steps which don't have a key
      if (step.scrollDirection || !step.key) continue;

      const normalizedKey = step.key.toLowerCase();
      const count = keyStepCount.get(normalizedKey) || 0;
      keyStepCount.set(normalizedKey, count + 1);
    }

    if (keyStepCount.size > SEQUENCE_CONSTRAINTS.MAX_UNIQUE_KEYS) {
      return `Sequence has ${keyStepCount.size} unique keys, maximum is ${SEQUENCE_CONSTRAINTS.MAX_UNIQUE_KEYS}`;
    }

    for (const [key, count] of keyStepCount) {
      if (count > SEQUENCE_CONSTRAINTS.MAX_STEPS_PER_KEY) {
        return `Key "${key}" used in ${count} steps, maximum is ${SEQUENCE_CONSTRAINTS.MAX_STEPS_PER_KEY} steps per key`;
      }
    }

    return null;
  }

  /**
   * Map our profile key names to RobotJS key names
   */
  private robotJsKeyMap: Record<string, string> = {
    // Numpad keys - RobotJS uses "numpad_X" format
    numpad0: "numpad_0",
    numpad1: "numpad_1",
    numpad2: "numpad_2",
    numpad3: "numpad_3",
    numpad4: "numpad_4",
    numpad5: "numpad_5",
    numpad6: "numpad_6",
    numpad7: "numpad_7",
    numpad8: "numpad_8",
    numpad9: "numpad_9",
    numpad_add: "numpad_+",
    numpad_subtract: "numpad_-",
    numpad_multiply: "numpad_*",
    numpad_decimal: "numpad_.",
    // Punctuation keys
    grave: "`",
    backslash: "\\",
    slash: "/",
    minus: "-",
    lbracket: "[",
    rbracket: "]",
    comma: ",",
    apostrophe: "'",
    // Navigation/editing keys
    pageup: "pageup",
    pagedown: "pagedown",
    delete: "delete",
    backspace: "backspace",
    tab: "tab",
    // Escape key
    escape: "escape",
    esc: "escape",
  };

  /**
   * Parse a step key which may include modifiers like "SHIFT+Q" or "ALT+NUMPAD7"
   */
  private parseKey(key: string): { key: string; modifiers: string[] } {
    const parts = key.split("+").map((p) => p.trim());
    const modifiers: string[] = [];
    let base = parts[parts.length - 1];

    // Collect modifiers (all parts except last)
    for (let i = 0; i < parts.length - 1; i++) {
      const m = parts[i].toUpperCase();
      if (m === "SHIFT") modifiers.push("shift");
      else if (m === "ALT") modifiers.push("alt");
      else if (m === "CTRL" || m === "CONTROL") modifiers.push("control");
      else modifiers.push(m.toLowerCase());
    }

    // Normalize base key
    base = base.toUpperCase();
    // Map common patterns (NUMPADx -> numpadx, F6 -> f6)
    if (base.startsWith("NUMPAD")) {
      base = base.replace("NUMPAD", "numpad").toLowerCase();
    } else {
      base = base.toLowerCase();
    }

    // Apply RobotJS key mapping
    if (this.robotJsKeyMap[base]) {
      base = this.robotJsKeyMap[base];
    }

    return { key: base, modifiers };
  }

  /**
   * Ensure clean modifier state before sending modified keys
   * This prevents conflicts when physical keys (like movement) are held
   * while we try to send synthetic ALT/SHIFT + key combinations
   */
  private ensureCleanModifierState(modifiers: string[]): void {
    if (modifiers.length === 0) return;

    const now = Date.now();
    if (now - this.lastModifierCleanup < this.MODIFIER_CLEANUP_INTERVAL_MS) {
      return; // Don't spam cleanup
    }

    // Release all modifiers first to ensure clean state
    // This fixes issues where physical numpad movement keys conflict
    // with synthetic ALT+NUMPAD combinations
    try {
      for (const mod of modifiers) {
        this._keyToggle(mod, "up");
      }
    } catch {
      // Ignore errors - modifier might not have been down
    }

    this.lastModifierCleanup = now;
  }

  /**
   * Buffer tier ranges (inclusive) - base ranges for human randomizer
   * Actual values selected using sophisticated multi-layer randomization
   * Updated: Larger gaps to reduce mouse lag from blocking robotjs calls
   */
  private bufferRanges: Record<string, [number, number]> = {
    low: [229, 263],
    medium: [337, 423],
    high: [513, 667],
  };

  /**
   * Sleep for specified milliseconds (cancellable - aborts on shutdown)
   * Optimized: No polling interval - checks shutdown before and after sleep
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
      if (this.isShutdown) {
        resolve();
        return;
      }
      setTimeout(() => {
        resolve();
      }, ms);
    });
  }

  /**
   * Send a single keypress
   */
  private pressKey(key: string): void {
    // Keep for backward compatibility but prefer explicit key+modifier flow
    const { key: parsedKey, modifiers } = this.parseKey(key);
    // Must pass [] not undefined - Windows RobotJS bug with undefined modifiers
    this._keyTap(parsedKey, modifiers);
  }

  // ========================================================================
  // KEY OUTPUT ROUTING: Sends to either RobotJS or Teensy based on backend
  // ========================================================================

  /**
   * Route keyToggle to the active backend.
   * In teensy mode, "down" sends a minimal press (Teensy handles hold+release atomically).
   * "up" is a no-op for Teensy since it auto-releases after the duration.
   */
  private _keyToggle(
    key: string,
    direction: "down" | "up",
    modifiers?: string[],
  ): void {
    if (this.backendMode === "teensy" && this.teensyExecutor) {
      if (direction === "down") {
        // Teensy: fire-and-forget a minimal press (10ms)
        // The actual hold duration is handled by _keyPressForDuration
        this.teensyExecutor
          .pressKey(key, 10, modifiers || [])
          .catch((err: Error) => {
            logger.error(`[Teensy] keyToggle error: ${err.message}`);
          });
      }
      // "up" is a no-op - Teensy auto-releases after duration
    } else {
      robot.keyToggle(key, direction, modifiers);
    }
  }

  /**
   * Route keyTap to the active backend.
   */
  private _keyTap(key: string, modifiers?: string[]): void {
    if (this.backendMode === "teensy" && this.teensyExecutor) {
      this.teensyExecutor
        .pressKey(key, 50, modifiers || [])
        .catch((err: Error) => {
          logger.error(`[Teensy] keyTap error: ${err.message}`);
        });
    } else {
      robot.keyTap(key, modifiers);
    }
  }

  /**
   * Press a key for a specific duration - the optimized Teensy path.
   * For Teensy: sends a single serial command with built-in hold duration.
   * For RobotJS: does keyToggle down → sleep → keyToggle up.
   */
  private async _keyPressForDuration(
    key: string,
    durationMs: number,
    modifiers: string[],
  ): Promise<void> {
    if (this.backendMode === "teensy" && this.teensyExecutor) {
      // Teensy: single command handles the entire press-hold-release cycle
      await this.teensyExecutor.pressKey(key, durationMs, modifiers);
    } else {
      // RobotJS: manual down → sleep → up
      robot.keyToggle(key, "down", modifiers);
      await this.sleep(durationMs);
      if (!this.isShutdown) {
        robot.keyToggle(key, "up", modifiers);
      }
    }
  }

  /**
   * Check if a binding is currently executing
   */
  isBindingExecuting(bindingName: string): boolean {
    return this.isExecuting.get(bindingName) || false;
  }

  /**
   * Get count of currently active executions
   */
  getActiveExecutionCount(): number {
    return this.activeExecutions.size;
  }

  /**
   * Get names of all currently executing bindings
   */
  getActiveBindings(): string[] {
    return Array.from(this.activeExecutions);
  }

  /**
   * Cancel execution for a specific binding
   */
  cancel(bindingName: string): void {
    if (this.isExecuting.get(bindingName)) {
      this.isExecuting.set(bindingName, false);
      this.callback({
        type: "cancelled",
        bindingName,
        timestamp: Date.now(),
      });
    }
  }

  /**
   * Cancel all executions
   */
  cancelAll(): void {
    for (const name of this.activeExecutions) {
      this.cancel(name);
    }
  }

  /**
   * Grant priority to a macro - it bypasses traffic control entirely
   * Use for high-priority macros that should never wait
   */
  grantPriority(macroName: string): void {
    if (this.trafficController) {
      this.trafficController.grantPriority(macroName);
    }
  }

  /**
   * Revoke priority from a macro
   */
  revokePriority(macroName: string): void {
    if (this.trafficController) {
      this.trafficController.revokePriority(macroName);
    }
  }

  /**
   * Get list of macros with priority
   */
  getPriorityList(): string[] {
    return this.trafficController?.getPriorityList() || [];
  }

  /**
   * Check if action is blocked by cooldown
   * @returns null if available, BlockerInfo if on cooldown
   */
  isActionCooldownBlocked(): { reason: string; cooldownMs: number } | null {
    return this.trafficController?.isActionCooldownBlocked() || null;
  }

  /**
   * Record action cooldown usage and start cooldown timer
   */
  recordActionCooldownUsed(): void {
    if (this.trafficController) {
      this.trafficController.recordActionCooldownUsed();
    }
  }

  /**
   * Destroy the executor - stops all operations and prevents new ones
   */
  destroy(): void {
    this.isShutdown = true;
    // Cancel all bindings first
    this.cancelAll();
    // Cancel any timers
    this.timerManager.cancelAllTimers();
    // Release any held keys immediately
    if (this.heldModifier) {
      try {
        this._keyToggle(
          this.heldModifier.key,
          "up",
          this.heldModifier.modifiers,
        );
      } catch (e) {
        /* ignore */
      }
      this.heldModifier = null;
    }
    // Clear all state
    this.activeExecutions.clear();
    this.isExecuting.clear();
  }

  /**
   * Execute a macro binding's sequence (fire-and-forget)
   * This method launches the execution as a detached promise, allowing
   * multiple different bindings to run simultaneously.
   */
  executeDetached(binding: MacroBinding): void {
    // Check if shutdown in progress
    if (this.isShutdown) return;

    // Check if this specific binding is already executing
    if (this.isExecuting.get(binding.name)) {
      logger.warn(`"${binding.name}" already executing, skipping...`);
      return;
    }

    // Launch as detached promise (don't await - allows concurrency)
    this.executeInternal(binding).catch((error) => {
      if (!this.isShutdown) {
        logger.error(`Detached execution error for "${binding.name}":`, error);
      }
    });
  }

  /**
   * Execute a macro binding's sequence (awaitable)
   * Use this when you need to wait for completion.
   */
  async execute(binding: MacroBinding): Promise<boolean> {
    if (this.isShutdown) return false;
    return this.executeInternal(binding);
  }

  /**
   * Internal execution logic
   */
  private async executeInternal(binding: MacroBinding): Promise<boolean> {
    const { name, sequence } = binding;

    // ================================================================
    // ACTION COOLDOWN CHECK
    // ================================================================
    if (name === "Stun Break") {
      const blocker = this.isActionCooldownBlocked();
      if (blocker) {
        logger.warn(
          `⏱️  Stun Break blocked: ${blocker.reason} (${Math.ceil(blocker.cooldownMs / 1000)}s remaining)`,
        );
        return false;
      }
    }

    // Check if already executing (per-binding lock)
    if (this.isExecuting.get(name)) {
      logger.warn(`"${name}" already executing, skipping...`);
      return false;
    }

    // ================================================================
    // REPEAT POLICE: Prevent redundant ability spam
    // Only active in SOFTWARE mode (RobotJS queue contention)
    // DISABLED in teensy mode (no queue contention)
    // ================================================================
    // Skip for echo hits (handled separately) and R streams
    const isEchoOrR =
      name.includes("echo") || name === "R" || name.includes("_R_");

    if (!isEchoOrR && this.backendMode === "software") {
      const now = Date.now();
      const lastTime = this.lastAbilityTimes.get(name);

      // Check if this ability was fired within REPEAT_POLICE_WINDOW_MS
      if (lastTime && now - lastTime < this.REPEAT_POLICE_WINDOW_MS) {
        // Check if we're already waiting on this ability (3rd/4th duplicate)
        if (this.repeatPoliceWaiting.get(name)) {
          // Delete this execution - it's a 3rd/4th duplicate during wait
          logger.debug(
            `🚔 RepeatPolice: Deleted redundant "${name}" (already waiting)`,
          );
          return false;
        }

        // This is the 2nd duplicate - mark as waiting and delay
        this.repeatPoliceWaiting.set(name, true);
        logger.debug(
          `🚔 RepeatPolice: Delaying "${name}" by ${this.REPEAT_POLICE_DELAY_MS}ms (duplicate within ${this.REPEAT_POLICE_WINDOW_MS}ms)`,
        );

        await this.sleep(this.REPEAT_POLICE_DELAY_MS);

        // Clear waiting state
        this.repeatPoliceWaiting.set(name, false);
      }

      // Update last execution time
      this.lastAbilityTimes.set(name, Date.now());
    }
    // ================================================================

    // Validate sequence
    const validationError = this.validateSequence(sequence);
    if (validationError) {
      this.callback({
        type: "error",
        bindingName: name,
        error: validationError,
        timestamp: Date.now(),
      });
      logger.error(`Validation failed: ${validationError}`);
      return false;
    }

    // Mark as executing
    this.isExecuting.set(name, true);
    this.activeExecutions.add(name);

    this.callback({
      type: "started",
      bindingName: name,
      timestamp: Date.now(),
    });

    const activeCount = this.activeExecutions.size;
    logger.debug(
      `Executing: "${name}" (${sequence.length} steps) [${activeCount} active]`,
    );

    try {
      for (let i = 0; i < sequence.length; i++) {
        // Check if cancelled or shutdown
        if (this.isShutdown || !this.isExecuting.get(name)) {
          logger.info(`"${name}" cancelled`);
          return false;
        }

        const step = sequence[i];

        // ================================================================
        // TIMER-ONLY STEP HANDLING (NEW for Omega system)
        // ================================================================
        if (step.timer && !step.key && !step.scrollDirection) {
          // Support both 'durationSeconds' (code) and 'duration' (JSON profile)
          const timerDuration =
            step.timer.durationSeconds ?? (step.timer as any).duration;

          // This is a timer-only step - start timer and continue
          console.log(
            `⏱️ Timer-only step: id=${step.timer.id}, duration=${timerDuration}s, msg="${step.timer.message}"`,
          );

          this.timerManager.startTimer(
            step.timer.id,
            timerDuration,
            step.timer.message,
          );

          // Emit step event for monitoring
          this.callback({
            type: "step",
            bindingName: name,
            step,
            stepIndex: i,
            timestamp: Date.now(),
          });

          // Apply delay for next step if specified
          if (step.bufferTier) {
            const delay = getHumanBufferDelay(step.bufferTier);
            if (delay > 0) await this.sleep(delay);
          } else if (step.minDelay && step.maxDelay) {
            const delay = getHumanDelay(
              step.minDelay,
              step.maxDelay,
              "timer_delay",
            );
            if (delay > 0) await this.sleep(delay);
          }

          continue; // Skip keypress logic
        }

        // ================================================================
        // DELAY-ONLY STEP HANDLING
        // ================================================================
        if (
          !step.key &&
          !step.scrollDirection &&
          (step.minDelay !== undefined || step.maxDelay !== undefined)
        ) {
          // This is a pure delay step - just wait
          const delay = getHumanDelay(
            step.minDelay || 100,
            step.maxDelay || 150,
            "delay_step",
          );
          logger.debug(`Delay step: ${delay}ms`);
          if (delay > 0) await this.sleep(delay);

          // Emit step event for monitoring
          this.callback({
            type: "step",
            bindingName: name,
            step,
            stepIndex: i,
            timestamp: Date.now(),
          });

          continue; // Skip keypress logic
        }

        // ================================================================
        // SCROLL HANDLING
        // ================================================================
        if (step.scrollDirection) {
          const magnitude = step.scrollMagnitude ?? 3;
          // robotjs scrollMouse: positive y = scroll up, negative y = scroll down
          const scrollDelta = step.scrollDirection === "down" ? -1 : 1;

          console.log(`🖱️ Scroll ${step.scrollDirection}: ${magnitude} ticks`);

          // Send scroll events one at a time with small delays for reliability
          for (let tick = 0; tick < magnitude; tick++) {
            robot.scrollMouse(0, scrollDelta);
            // Small delay between ticks for game to register
            if (tick < magnitude - 1) {
              await this.sleep(15);
            }
          }

          // Emit step event for monitoring
          this.callback({
            type: "step",
            bindingName: name,
            step,
            stepIndex: i,
            timestamp: Date.now(),
          });

          // Apply delay for next step using human-like randomization
          const delay = step.bufferTier
            ? getHumanBufferDelay(step.bufferTier)
            : getHumanDelay(
                step.minDelay || 25,
                step.maxDelay || 50,
                "scroll_delay",
              );
          if (delay > 0) await this.sleep(delay);

          continue; // Skip keypress logic
        }

        // ================================================================
        // KEYPRESS HANDLING (with optional timer)
        // ================================================================

        // If step has BOTH key and timer, start the timer first
        if (step.timer && step.key) {
          // Support both 'durationSeconds' (code) and 'duration' (JSON profile)
          const timerDuration =
            step.timer.durationSeconds ?? (step.timer as any).duration;
          logger.debug(
            `Key+Timer step: ${step.key} + timer ${step.timer.id} (${timerDuration}s)`,
          );
          this.timerManager.startTimer(
            step.timer.id,
            timerDuration,
            step.timer.message,
          );
        }

        // Press the key (support modifiers, hold duration, and dual keys)
        const { key: parsedKey, modifiers } = this.parseKey(step.key!);

        // LEGACY TIMER DETECTION: Check if this is a timer step (string-based parsing)
        // This maintains backward compatibility with Alpha profile format
        if (parsedKey === "end" && step.name?.includes("Timer placeholder")) {
          // Parse timer duration and message from step.name
          // Format: "Timer placeholder - implement TTS: 'message' after N seconds"
          const durationMatch = step.name.match(/(\d+)\s*seconds?/);
          const messageMatch = step.name.match(/[''](.*?)['']/);

          if (durationMatch && messageMatch) {
            const duration = parseInt(durationMatch[1], 10);
            const message = messageMatch[1];

            // Generate timer ID from binding name or use message as fallback
            const timerId = message.toLowerCase().replace(/\s+/g, "_");

            logger.debug(
              `Timer detected: ${timerId} (${duration}s) → "${message}"`,
            );

            // Start timer instead of pressing END key
            this.timerManager.startTimer(timerId, duration, message);

            // Emit step event for monitoring
            this.callback({
              type: "step",
              bindingName: name,
              step,
              stepIndex: i,
              timestamp: Date.now(),
            });

            // Skip key execution - timer started instead
            continue;
          } else {
            logger.warn(
              `Timer step detected but couldn't parse: "${step.name}"`,
            );
            // Fall through to normal key execution
          }
        }

        // ENDURE PAIN TIMER: Automatically start 16s "drop" timer when SHIFT+, is pressed
        if (
          step.key!.toUpperCase() === "SHIFT+," ||
          step.key!.toUpperCase() === "SHIFT + ,"
        ) {
          logger.debug(
            'Endure Pain detected (SHIFT+,) - starting 16s "drop" timer',
          );
          this.timerManager.startTimer("drop", 16, "drop");
        }

        // Traffic control for conflict keys: wait if necessary
        // BYPASS for F8, R, TAB: These keys have all modifier variants bound in-game
        // so they will fire correctly even with modifier contamination
        const trafficBypassKeys = new Set(["F8", "R", "TAB"]);
        const rawKeyForTraffic = step
          .key!.split("+")
          .pop()!
          .trim()
          .toUpperCase();
        const bypassTraffic = trafficBypassKeys.has(rawKeyForTraffic);

        if (this.compiledProfile && this.trafficController && !bypassTraffic) {
          const needsTraffic = isConflictKey(step.key!, this.compiledProfile);
          if (needsTraffic) {
            await this.trafficController.requestCrossing(step.key!, name);
          }
        }

        // OUTPUT PACING: Add delays to reduce mouse stutter from blocking robotjs calls
        // Only needed in software mode - Teensy is a separate USB device with no queue contention
        if (this.backendMode === "software") {
          this.outputPaceCounter++;
          const pacePosition = ((this.outputPaceCounter - 1) % 4) + 1; // 1, 2, 3, 4, 1, 2, 3, 4...
          // Software mode: aggressive pacing to reduce stutter
          if (pacePosition === 2) {
            await this.sleep(100);
          } else if (pacePosition === 3) {
            await this.sleep(120);
          } else if (pacePosition === 4) {
            await this.sleep(190);
          }
        }

        // QUEUE PRESSURE: Check for adaptive delay based on pressure buildup
        // Only active in software mode
        if (this.backendMode === "software") {
          const pressureMonitor = getQueuePressureMonitor();
          const adaptiveDelay = pressureMonitor.getAdaptiveDelay();
          if (adaptiveDelay > 0) {
            await this.sleep(adaptiveDelay);
          }

          // Check if this specific ability should be throttled (frequent spike contributor)
          const abilityThrottle = pressureMonitor.shouldThrottleAbility(name);
          if (abilityThrottle > 0) {
            await this.sleep(abilityThrottle);
          }
        }

        // Determine key down duration using human-like randomization
        const kd = step.keyDownDuration || [23, 38];
        const keyDownMs = getHumanKeyDownDuration(kd[0], kd[1]);

        // Check for dual key configuration
        const hasDualKey = step.dualKey !== undefined;
        let dualParsedKey: { key: string; modifiers: string[] } | null = null;
        let dualKeyDownMs = 0;

        if (hasDualKey) {
          // Parse dual key
          dualParsedKey = this.parseKey(step.dualKey!);

          // Determine dual key hold duration using human-like randomization
          const dualKd = step.dualKeyDownDuration || kd;
          dualKeyDownMs = getHumanKeyDownDuration(dualKd[0], dualKd[1]);
        }

        // Ensure clean modifier state before sending keys with modifiers
        // This prevents conflicts when movement keys (NUMPAD8, E, F, G) are held
        if (modifiers.length > 0) {
          this.ensureCleanModifierState(modifiers);
        }

        // Suppress the raw key to prevent gesture detection of synthetic keypress
        // This prevents ALT+A from triggering the A gesture (Leap) when outputting Ravage
        // Key 7 uses longer suppression (350ms) to ensure reliable isolation
        const suppressDuration = parsedKey === "7" ? 350 : 200;
        this.suppressKey(parsedKey.toUpperCase(), suppressDuration);

        // PRIMARY KEY DOWN
        try {
          // Must pass modifiers array (even if empty) - Windows RobotJS bug with undefined
          this._keyToggle(parsedKey, "down", modifiers);
        } catch (err) {
          // Fallback to keyTap if keyToggle unsupported for this key
          this.pressKey(step.key!);
        }

        // Emergency key release on shutdown
        if (this.isShutdown) {
          try {
            this._keyToggle(parsedKey, "up", modifiers);
          } catch (e) {
            /* ignore */
          }
          return false;
        }

        this.callback({
          type: "step",
          bindingName: name,
          step,
          stepIndex: i,
          timestamp: Date.now(),
        });

        if (hasDualKey) {
          // DUAL KEY MODE: Press second key after offset
          // Use human-like randomization for offset (4-10ms range instead of fixed 6)
          const offsetMs = step.dualKeyOffsetMs ?? getHumanDualKeyOffset();

          logger.debug(
            `[${i + 1}/${sequence.length}] Pressed "${step.key}" + "${
              step.dualKey
            }" (dual) primary=${keyDownMs}ms, dual=${dualKeyDownMs}ms, offset=${offsetMs}ms`,
          );

          // Wait for offset before pressing dual key
          await this.sleep(offsetMs);

          // Emergency release primary on shutdown
          if (this.isShutdown) {
            try {
              this._keyToggle(parsedKey, "up", modifiers);
            } catch (e) {
              /* ignore */
            }
            return false;
          }

          // DUAL KEY DOWN
          try {
            this._keyToggle(
              dualParsedKey!.key,
              "down",
              dualParsedKey!.modifiers.length === 0
                ? undefined
                : dualParsedKey!.modifiers,
            );
          } catch (err) {
            // Fallback to keyTap if keyToggle unsupported
            this.pressKey(step.dualKey!);
          }

          // Emergency release both on shutdown
          if (this.isShutdown) {
            try {
              this._keyToggle(parsedKey, "up", modifiers);
            } catch (e) {
              /* ignore */
            }
            try {
              this._keyToggle(
                dualParsedKey!.key,
                "up",
                dualParsedKey!.modifiers.length === 0
                  ? undefined
                  : dualParsedKey!.modifiers,
              );
            } catch (e) {
              /* ignore */
            }
            return false;
          }

          // Hold primary key for remaining duration (already held for offsetMs)
          const primaryRemainingMs = Math.max(0, keyDownMs - offsetMs);
          await this.sleep(primaryRemainingMs);

          // Emergency release both on shutdown
          if (this.isShutdown) {
            try {
              this._keyToggle(parsedKey, "up", modifiers);
            } catch (e) {
              /* ignore */
            }
            try {
              this._keyToggle(
                dualParsedKey!.key,
                "up",
                dualParsedKey!.modifiers.length === 0
                  ? undefined
                  : dualParsedKey!.modifiers,
              );
            } catch (e) {
              /* ignore */
            }
            return false;
          }

          // PRIMARY KEY UP (releases first)
          try {
            // Must pass modifiers array (even if empty) - Windows RobotJS bug with undefined
            this._keyToggle(parsedKey, "up", modifiers);
          } catch (err) {
            // If keyToggle failed, nothing else to do
          }

          // Hold dual key for its full duration (or remaining if longer than primary)
          const dualRemainingMs = Math.max(
            0,
            dualKeyDownMs - (offsetMs + primaryRemainingMs),
          );
          if (dualRemainingMs > 0) {
            await this.sleep(dualRemainingMs);
            // Emergency release dual on shutdown
            if (this.isShutdown) {
              try {
                this._keyToggle(
                  dualParsedKey!.key,
                  "up",
                  dualParsedKey!.modifiers.length === 0
                    ? undefined
                    : dualParsedKey!.modifiers,
                );
              } catch (e) {
                /* ignore */
              }
              return false;
            }
          }

          // DUAL KEY UP (releases second)
          try {
            this._keyToggle(
              dualParsedKey!.key,
              "up",
              dualParsedKey!.modifiers.length === 0
                ? undefined
                : dualParsedKey!.modifiers,
            );
          } catch (err) {
            // If keyToggle failed, nothing else to do
          }
        } else {
          // SINGLE KEY MODE: Normal behavior
          logger.debug(
            `[${i + 1}/${sequence.length}] Pressed "${
              step.key
            }" held ${keyDownMs}ms`,
          );

          // Hold duration
          await this.sleep(keyDownMs);

          // Emergency release on shutdown
          if (this.isShutdown) {
            try {
              this._keyToggle(parsedKey, "up", modifiers);
            } catch (e) {
              /* ignore */
            }
            return false;
          }

          // Check if this step should hold through next step
          if (step.holdThroughNext) {
            // Store held modifier info for release during next step's buffer
            this.heldModifier = {
              key: parsedKey,
              modifiers,
              releaseDelayMin: step.releaseDelayMin ?? 7,
              releaseDelayMax: step.releaseDelayMax ?? 18,
            };
            logger.debug(
              `Holding "${step.key}" through next step (will release after ${this.heldModifier.releaseDelayMin}-${this.heldModifier.releaseDelayMax}ms of next buffer)`,
            );
            // Skip the normal release - key stays down
          } else {
            // PRIMARY KEY UP (normal release)
            try {
              // Must pass modifiers array (even if empty) - Windows RobotJS bug with undefined
              this._keyToggle(parsedKey, "up", modifiers);
            } catch (err) {
              // If keyToggle failed, nothing else to do
            }
          }
        }

        // Release traffic control if it was acquired (matching bypass logic from above)
        const rawKeyForRelease = step
          .key!.split("+")
          .pop()!
          .trim()
          .toUpperCase();
        const bypassTrafficRelease = trafficBypassKeys.has(rawKeyForRelease);

        if (
          this.compiledProfile &&
          this.trafficController &&
          !bypassTrafficRelease
        ) {
          const needsTraffic = isConflictKey(step.key!, this.compiledProfile);
          if (needsTraffic) {
            this.trafficController.releaseCrossing(step.key!);
          }
        }

        // QUEUE PRESSURE: Record this output event for analysis
        // Only active in software mode
        if (this.backendMode === "software") {
          const isEchoHit =
            step.echoHits !== undefined && step.echoHits.count > 0;
          const pressureMonitor = getQueuePressureMonitor();
          pressureMonitor.recordOutput(
            name,
            step.key!,
            keyDownMs + (hasDualKey ? dualKeyDownMs : 0),
            isEchoHit,
            false, // isRStream - handled separately
          );
        }

        // Determine buffer delay after this key press
        const isLastStep = i === sequence.length - 1;

        if (!isLastStep) {
          let delay: number;

          if (step.bufferTier) {
            // Use human-like buffer delay
            delay = getHumanBufferDelay(step.bufferTier);
          } else if (
            step.minDelay !== undefined &&
            step.maxDelay !== undefined
          ) {
            // Fall back to human-like delay with legacy min/max
            delay = getHumanDelay(
              step.minDelay,
              step.maxDelay,
              "legacy_buffer",
            );
          } else {
            // Default buffer delay
            delay = getHumanBufferDelay("low");
          }

          this.callback({
            type: "step",
            bindingName: name,
            step,
            stepIndex: i,
            delay,
            timestamp: Date.now(),
          });

          // ECHO HITS: Rapid repeat keypresses after initial output
          // Each echo comes 90-120ms after the last one (human randomized)
          // All echo keyDownDurations are 37-42ms
          if (step.echoHits && step.echoHits.count > 0) {
            const echoCount = step.echoHits.count;

            logger.debug(
              `Echo hits: ${echoCount} repeats of "${step.key}" (90-120ms gaps, 37-42ms holds)`,
            );

            for (let e = 0; e < echoCount; e++) {
              // Wait 90-120ms before each echo (human randomized)
              const echoGap = getHumanDelay(90, 120, "echo_gap");
              await this.sleep(echoGap);

              if (this.isShutdown) return false;

              // Echo hold duration: 37-42ms (human randomized)
              const echoHoldMs = getHumanDelay(37, 42, "echo_hold");

              try {
                this._keyToggle(parsedKey, "down", modifiers);
                await this.sleep(echoHoldMs);
                if (this.isShutdown) {
                  try {
                    this._keyToggle(parsedKey, "up", modifiers);
                  } catch (e) {}
                  return false;
                }
                this._keyToggle(parsedKey, "up", modifiers);
              } catch (err) {
                // Fallback to keyTap
                this.pressKey(step.key!);
              }

              logger.debug(
                `  Echo ${e + 1}/${echoCount}: "${step.key}" gap=${echoGap}ms, hold=${echoHoldMs}ms`,
              );
            }

            // Calculate remaining buffer time after echo hits
            // Total echo time = echoCount * ~105ms (avg gap) + echoCount * ~40ms (avg hold)
            const estimatedEchoTime = echoCount * 145; // ~145ms per echo
            const remainingBufferAfterEcho = Math.max(
              0,
              delay - estimatedEchoTime,
            );

            // Handle held modifier release if applicable
            if (this.heldModifier && i > 0) {
              const releaseDelay = getHumanReleaseDelay(
                this.heldModifier.releaseDelayMin,
                this.heldModifier.releaseDelayMax,
              );

              if (remainingBufferAfterEcho >= releaseDelay) {
                await this.sleep(releaseDelay);
                logger.debug(
                  `Releasing held modifier after ${releaseDelay}ms of remaining buffer`,
                );
                try {
                  this._keyToggle(
                    this.heldModifier.key,
                    "up",
                    this.heldModifier.modifiers.length === 0
                      ? undefined
                      : this.heldModifier.modifiers,
                  );
                } catch (err) {
                  /* ignore */
                }
                this.heldModifier = null;

                const finalRemaining = remainingBufferAfterEcho - releaseDelay;
                if (finalRemaining > 0) {
                  await this.sleep(finalRemaining);
                }
              } else {
                await this.sleep(remainingBufferAfterEcho);
              }
            } else if (remainingBufferAfterEcho > 0) {
              await this.sleep(remainingBufferAfterEcho);
            }
          }
          // If there's a held modifier from the previous step, release it partway through this buffer
          else if (this.heldModifier && i > 0) {
            const releaseDelay = getHumanReleaseDelay(
              this.heldModifier.releaseDelayMin,
              this.heldModifier.releaseDelayMax,
            );

            // Wait for the release delay first
            await this.sleep(releaseDelay);

            // Release the held modifier
            logger.debug(
              `Releasing held modifier after ${releaseDelay}ms of buffer`,
            );
            try {
              this._keyToggle(
                this.heldModifier.key,
                "up",
                this.heldModifier.modifiers.length === 0
                  ? undefined
                  : this.heldModifier.modifiers,
              );
            } catch (err) {
              // If keyToggle failed, nothing else to do
            }

            // Clear held modifier
            this.heldModifier = null;

            // Wait for the remaining buffer time
            const remainingDelay = delay - releaseDelay;
            if (remainingDelay > 0) {
              await this.sleep(remainingDelay);
            }
          } else {
            // No held modifier, just wait the full buffer
            await this.sleep(delay);
          }
        } else if (this.heldModifier) {
          // Last step and there's a held modifier - release it after its configured delay
          const releaseDelay = getHumanReleaseDelay(
            this.heldModifier.releaseDelayMin,
            this.heldModifier.releaseDelayMax,
          );
          await this.sleep(releaseDelay);

          logger.debug(
            `Releasing held modifier after ${releaseDelay}ms (last step)`,
          );
          try {
            this._keyToggle(
              this.heldModifier.key,
              "up",
              this.heldModifier.modifiers.length === 0
                ? undefined
                : this.heldModifier.modifiers,
            );
          } catch (err) {
            // If keyToggle failed, nothing else to do
          }
          this.heldModifier = null;
        }
      }

      // Record action cooldown if this was Stun Break
      if (name === "Stun Break") {
        this.recordActionCooldownUsed();
        logger.debug(`⏱️  Action cooldown started (120s)`);
      }

      this.callback({
        type: "completed",
        bindingName: name,
        timestamp: Date.now(),
      });

      logger.info(`"${name}" complete`);
      return true;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Unknown error";

      this.callback({
        type: "error",
        bindingName: name,
        error: errorMsg,
        timestamp: Date.now(),
      });

      logger.error(`"${name}" failed: ${errorMsg}`);
      return false;
    } finally {
      // Cleanup: release any held modifier if sequence ends prematurely
      if (this.heldModifier) {
        logger.debug("Cleaning up held modifier due to sequence end/error");
        try {
          this._keyToggle(
            this.heldModifier.key,
            "up",
            this.heldModifier.modifiers.length === 0
              ? undefined
              : this.heldModifier.modifiers,
          );
        } catch (err) {
          // Ignore cleanup errors
        }
        this.heldModifier = null;
      }

      this.isExecuting.set(name, false);
      this.activeExecutions.delete(name);
    }
  }

  /**
   * Test execution without actually sending keys (dry run)
   */
  async dryRun(binding: MacroBinding): Promise<void> {
    const { name, sequence } = binding;

    const validationError = this.validateSequence(sequence);
    if (validationError) {
      console.error(`❌ Validation failed: ${validationError}`);
      return;
    }

    console.log(`\n🧪 DRY RUN: "${name}" (${sequence.length} steps)`);

    const keyCount: Map<string, number> = new Map();
    for (const step of sequence) {
      if (step.key) {
        keyCount.set(step.key, (keyCount.get(step.key) || 0) + 1);
      }
    }

    logger.info(
      `Unique keys: ${keyCount.size}/${SEQUENCE_CONSTRAINTS.MAX_UNIQUE_KEYS}`,
    );
    logger.info(`Total key presses: ${sequence.length}`);
    for (const [key, count] of keyCount) {
      logger.info(`- "${key}": ${count}x`);
    }

    let totalMinTime = 0;
    let totalMaxTime = 0;

    for (let i = 0; i < sequence.length; i++) {
      const step = sequence[i];
      const keyDisplay =
        step.key || (step.timer ? `[Timer: ${step.timer.id}]` : "[Scroll]");
      const delayMin = step.minDelay ?? 0;
      const delayMax = step.maxDelay ?? 0;
      logger.info(
        `[${i + 1}] "${keyDisplay}" → wait ${delayMin}-${delayMax}ms`,
      );

      const isLastStep = i === sequence.length - 1;
      if (!isLastStep) {
        totalMinTime += delayMin;
        totalMaxTime += delayMax;
      }
    }

    console.log(`   ⏱️  Total time: ${totalMinTime}-${totalMaxTime}ms\n`);
  }

  /**
   * Shutdown executor and clean up resources
   */
  shutdown(): void {
    logger.info("Shutting down SequenceExecutor...");
    this.cancelAll();
    this.timerManager.shutdown();
  }
}
