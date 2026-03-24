/**
 * Interception Driver Executor
 *
 * Uses the Interception driver for kernel-level input integration.
 * Input is processed at the kernel level, providing the lowest
 * possible latency and maximum compatibility with applications
 * that may not accept software-generated input events.
 *
 * This is particularly valuable for accessibility applications
 * where target software needs to receive input indistinguishable
 * from physical keyboard events.
 *
 * Requirements:
 * - Interception driver installed (github.com/oblitum/Interception)
 * - Windows only
 * - Administrator privileges for driver installation
 */

import { SequenceStep, MacroBinding, SEQUENCE_CONSTRAINTS } from "./types.js";
import { logger } from "./logger.js";

// Interception key codes (scan codes)
// These are hardware scan codes, not virtual key codes
// Extended keys (marked with isExtended: true) require the E0 flag
interface ScanCodeEntry {
  code: number;
  isExtended?: boolean;
}

const SCAN_CODES: Record<string, ScanCodeEntry> = {
  // Number row
  "1": { code: 0x02 },
  "2": { code: 0x03 },
  "3": { code: 0x04 },
  "4": { code: 0x05 },
  "5": { code: 0x06 },
  "6": { code: 0x07 },
  "7": { code: 0x08 },
  "8": { code: 0x09 },
  "9": { code: 0x0a },
  "0": { code: 0x0b },

  // QWERTY row
  q: { code: 0x10 },
  w: { code: 0x11 },
  e: { code: 0x12 },
  r: { code: 0x13 },
  t: { code: 0x14 },
  y: { code: 0x15 },
  u: { code: 0x16 },
  i: { code: 0x17 },
  o: { code: 0x18 },
  p: { code: 0x19 },

  // ASDF row
  a: { code: 0x1e },
  s: { code: 0x1f },
  d: { code: 0x20 },
  f: { code: 0x21 },
  g: { code: 0x22 },
  h: { code: 0x23 },
  j: { code: 0x24 },
  k: { code: 0x25 },
  l: { code: 0x26 },

  // ZXCV row
  z: { code: 0x2c },
  x: { code: 0x2d },
  c: { code: 0x2e },
  v: { code: 0x2f },
  b: { code: 0x30 },
  n: { code: 0x31 },
  m: { code: 0x32 },

  // Function keys
  f1: { code: 0x3b },
  f2: { code: 0x3c },
  f3: { code: 0x3d },
  f4: { code: 0x3e },
  f5: { code: 0x3f },
  f6: { code: 0x40 },
  f7: { code: 0x41 },
  f8: { code: 0x42 },
  f9: { code: 0x43 },
  f10: { code: 0x44 },
  f11: { code: 0x57 },
  f12: { code: 0x58 },

  // Special keys
  space: { code: 0x39 },
  enter: { code: 0x1c },
  escape: { code: 0x01 },
  tab: { code: 0x0f },
  backspace: { code: 0x0e },

  // Numpad (NOT extended - these are the numpad keys)
  num0: { code: 0x52 },
  num1: { code: 0x4f },
  num2: { code: 0x50 },
  num3: { code: 0x51 },
  num4: { code: 0x4b },
  num5: { code: 0x4c },
  num6: { code: 0x4d },
  num7: { code: 0x47 },
  num8: { code: 0x48 },
  num9: { code: 0x49 },
  numplus: { code: 0x4e },
  numminus: { code: 0x4a },
  nummultiply: { code: 0x37 },
  numdivide: { code: 0x35, isExtended: true },
  numenter: { code: 0x1c, isExtended: true },

  // Arrow keys (EXTENDED - require E0 flag to distinguish from numpad)
  up: { code: 0x48, isExtended: true },
  down: { code: 0x50, isExtended: true },
  left: { code: 0x4b, isExtended: true },
  right: { code: 0x4d, isExtended: true },

  // Navigation keys (EXTENDED)
  insert: { code: 0x52, isExtended: true },
  delete: { code: 0x53, isExtended: true },
  home: { code: 0x47, isExtended: true },
  end: { code: 0x4f, isExtended: true },
  pageup: { code: 0x49, isExtended: true },
  pagedown: { code: 0x51, isExtended: true },

  // Other
  minus: { code: 0x0c },
  equals: { code: 0x0d },
  leftbracket: { code: 0x1a },
  rightbracket: { code: 0x1b },
  semicolon: { code: 0x27 },
  quote: { code: 0x28 },
  comma: { code: 0x33 },
  period: { code: 0x34 },
  slash: { code: 0x35 },
  backslash: { code: 0x2b },
  grave: { code: 0x29 },
};

// Interception stroke structure
interface InterceptionKeyStroke {
  code: number; // Scan code
  state: number; // 0 = down, 1 = up
  information: number;
}

// Interception context handle
type InterceptionContext = number;
type InterceptionDevice = number;

// Key states for Interception
const KEY_DOWN = 0x00;
const KEY_UP = 0x01;
const KEY_E0 = 0x02; // Extended key flag

// FFI bindings interface (will be loaded dynamically)
interface InterceptionFFI {
  interception_create_context(): InterceptionContext;
  interception_destroy_context(context: InterceptionContext): void;
  interception_get_hardware_id(
    context: InterceptionContext,
    device: InterceptionDevice,
    buffer: Buffer,
    size: number,
  ): number;
  interception_send(
    context: InterceptionContext,
    device: InterceptionDevice,
    stroke: Buffer,
    nstroke: number,
  ): number;
  interception_wait(context: InterceptionContext): InterceptionDevice;
  interception_receive(
    context: InterceptionContext,
    device: InterceptionDevice,
    stroke: Buffer,
    nstroke: number,
  ): number;
  interception_is_keyboard(device: InterceptionDevice): boolean;
  interception_is_mouse(device: InterceptionDevice): boolean;
}

export class InterceptionExecutor {
  private context: InterceptionContext | null = null;
  private keyboardDevice: InterceptionDevice = 1; // Default to first keyboard
  private ffi: InterceptionFFI | null = null;
  private initialized: boolean = false;
  private dllPath: string;

  constructor(
    dllPath: string = "C:\\Program Files\\Interception\\library\\x64\\interception.dll",
  ) {
    this.dllPath = dllPath;
  }

  /**
   * Initialize the Interception driver context
   */
  async initialize(): Promise<boolean> {
    try {
      // Dynamic import of ffi-napi (Windows only, native module)
      // These packages must be installed separately: npm install ffi-napi ref-napi
      // @ts-ignore - dynamic import, only works on Windows with native modules
      const ffi = await import("ffi-napi");
      // @ts-ignore - dynamic import
      const ref = await import("ref-napi");

      // Define the Interception library interface
      this.ffi = ffi.Library(this.dllPath, {
        interception_create_context: ["pointer", []],
        interception_destroy_context: ["void", ["pointer"]],
        interception_get_hardware_id: [
          "int",
          ["pointer", "int", "pointer", "int"],
        ],
        interception_send: ["int", ["pointer", "int", "pointer", "int"]],
        interception_wait: ["int", ["pointer"]],
        interception_receive: ["int", ["pointer", "int", "pointer", "int"]],
        interception_is_keyboard: ["bool", ["int"]],
        interception_is_mouse: ["bool", ["int"]],
      }) as unknown as InterceptionFFI;

      // Create context
      this.context = this.ffi.interception_create_context();

      if (!this.context) {
        console.error(
          "[InterceptionExecutor] Failed to create context - is driver installed?",
        );
        return false;
      }

      // Find first keyboard device (devices 1-10 are keyboards)
      for (let device = 1; device <= 10; device++) {
        if (this.ffi.interception_is_keyboard(device)) {
          this.keyboardDevice = device;
          logger.debug(`Using keyboard device: ${device}`);
          break;
        }
      }

      this.initialized = true;
      logger.debug("Initialized successfully (kernel-level injection ready)");
      return true;
    } catch (error: any) {
      logger.error("Failed to initialize:", error.message);
      logger.error("Make sure:");
      logger.error("  1. Interception driver is installed");
      logger.error(
        "  2. ffi-napi and ref-napi are installed: npm install ffi-napi ref-napi",
      );
      logger.error("  3. Running on Windows with proper permissions");
      return false;
    }
  }

  /**
   * Cleanup and destroy context
   */
  destroy(): void {
    if (this.ffi && this.context) {
      this.ffi.interception_destroy_context(this.context);
      this.context = null;
      this.initialized = false;
      logger.debug("Context destroyed");
    }
  }

  /**
   * Get scan code entry for a key (includes extended flag)
   */
  private getScanCodeEntry(key: string): ScanCodeEntry | null {
    const normalizedKey = key.toLowerCase();
    return SCAN_CODES[normalizedKey] ?? null;
  }

  /**
   * Create a keystroke buffer for Interception
   * The struct is 8 bytes total:
   *   unsigned short code (2 bytes)
   *   unsigned short state (2 bytes)
   *   unsigned int information (4 bytes)
   */
  private createStrokeBuffer(
    code: number,
    state: number,
    isExtended: boolean = false,
  ): Buffer {
    const buffer = Buffer.alloc(8);
    buffer.writeUInt16LE(code, 0); // scan code
    // State: 0=down, 1=up, 2=E0 (extended), 3=E0+up
    const fullState = isExtended ? state | KEY_E0 : state;
    buffer.writeUInt16LE(fullState, 2);
    buffer.writeUInt32LE(0, 4); // information (unused)
    return buffer;
  }

  /**
   * Send a single keypress (down + up) via Interception
   */
  private sendKey(key: string): boolean {
    if (!this.initialized || !this.ffi || !this.context) {
      console.error("[InterceptionExecutor] Not initialized");
      return false;
    }

    const entry = this.getScanCodeEntry(key);
    if (!entry) {
      console.error(`[InterceptionExecutor] Unknown key: ${key}`);
      return false;
    }

    const isExtended = entry.isExtended ?? false;

    // Key down
    const downStroke = this.createStrokeBuffer(
      entry.code,
      KEY_DOWN,
      isExtended,
    );
    this.ffi.interception_send(
      this.context,
      this.keyboardDevice,
      downStroke,
      1,
    );

    // Small delay between down and up (5-15ms, human-like)
    const holdTime = Math.floor(Math.random() * 10) + 5;
    const start = Date.now();
    while (Date.now() - start < holdTime) {
      // Busy wait for precise timing
    }

    // Key up
    const upStroke = this.createStrokeBuffer(entry.code, KEY_UP, isExtended);
    this.ffi.interception_send(this.context, this.keyboardDevice, upStroke, 1);

    return true;
  }

  /**
   * Calculate randomized delay between min and max
   */
  private getRandomDelay(minDelay: number, maxDelay: number): number {
    return Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;
  }

  /**
   * Precise sleep using busy-wait for sub-millisecond accuracy
   */
  private preciseSleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
      const start = Date.now();
      const check = () => {
        if (Date.now() - start >= ms) {
          resolve();
        } else {
          setImmediate(check);
        }
      };
      check();
    });
  }

  /**
   * Validate a sequence before execution
   */
  validateSequence(sequence: SequenceStep[]): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    // Check unique keys constraint (only count steps with keys)
    const uniqueKeys = new Set(
      sequence.filter((s) => s.key).map((s) => s.key!.toLowerCase()),
    );
    if (uniqueKeys.size > SEQUENCE_CONSTRAINTS.MAX_UNIQUE_KEYS) {
      errors.push(
        `Too many unique keys: ${uniqueKeys.size} (max ${SEQUENCE_CONSTRAINTS.MAX_UNIQUE_KEYS})`,
      );
    }

    // Count STEPS per key
    const keyStepCount: Map<string, number> = new Map();

    // Check each step
    for (const step of sequence) {
      // Skip validation for steps without timing (timer-only or scroll steps)
      if (step.minDelay !== undefined && step.maxDelay !== undefined) {
        // Min delay check
        if (step.minDelay < SEQUENCE_CONSTRAINTS.MIN_DELAY) {
          errors.push(
            `Step ${step.key || "unknown"}: minDelay ${step.minDelay}ms < minimum ${SEQUENCE_CONSTRAINTS.MIN_DELAY}ms`,
          );
        }

        // Variance check
        const variance = step.maxDelay - step.minDelay;
        if (variance < SEQUENCE_CONSTRAINTS.MIN_VARIANCE) {
          errors.push(
            `Step ${step.key || "unknown"}: variance ${variance}ms < minimum ${SEQUENCE_CONSTRAINTS.MIN_VARIANCE}ms`,
          );
        }
      }

      // Count steps per key (only if key exists)
      if (step.key) {
        const normalizedKey = step.key.toLowerCase();
        const current = keyStepCount.get(normalizedKey) || 0;
        keyStepCount.set(normalizedKey, current + 1);

        // Key mapping check
        if (!this.getScanCodeEntry(step.key)) {
          errors.push(`Step ${step.key}: unknown key (no scan code mapping)`);
        }
      }
    }

    // Check max steps per key
    for (const [key, count] of keyStepCount) {
      if (count > SEQUENCE_CONSTRAINTS.MAX_STEPS_PER_KEY) {
        errors.push(
          `Key "${key}" used in ${count} steps, maximum is ${SEQUENCE_CONSTRAINTS.MAX_STEPS_PER_KEY} steps per key`,
        );
      }
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Execute a sequence of keypresses with timing
   * Uses Interception driver for kernel-level injection
   */
  async executeSequence(sequence: SequenceStep[]): Promise<boolean> {
    if (!this.initialized) {
      console.error(
        "[InterceptionExecutor] Not initialized - call initialize() first",
      );
      return false;
    }

    // Validate before execution
    const validation = this.validateSequence(sequence);
    if (!validation.valid) {
      console.error("[InterceptionExecutor] Sequence validation failed:");
      validation.errors.forEach((e) => console.error(`  - ${e}`));
      return false;
    }

    logger.debug(
      `Executing ${sequence.length} steps (Interception/kernel mode)`,
    );

    for (let i = 0; i < sequence.length; i++) {
      const step = sequence[i];

      // Skip steps without a key (timer-only or scroll steps)
      if (!step.key) {
        continue;
      }

      // Send the key via Interception
      const success = this.sendKey(step.key);
      if (!success) {
        logger.error(`Failed to send key: ${step.key}`);
        return false;
      }

      logger.debug(
        `[${i + 1}/${sequence.length}] ${step.key} via Interception`,
      );

      // Delay before next keypress (except after last step)
      const isLastStep = i === sequence.length - 1;

      if (
        !isLastStep &&
        step.minDelay !== undefined &&
        step.maxDelay !== undefined
      ) {
        const delay = this.getRandomDelay(step.minDelay, step.maxDelay);
        await this.preciseSleep(delay);
      }
    }

    logger.debug("Sequence completed successfully");
    return true;
  }

  /**
   * Check if Interception driver is available
   */
  static async isAvailable(): Promise<boolean> {
    try {
      const fs = await import("fs");
      const defaultPath =
        "C:\\Program Files\\Interception\\library\\x64\\interception.dll";
      return fs.existsSync(defaultPath);
    } catch {
      return false;
    }
  }
}

/**
 * Fallback executor that mimics Interception API but uses console logging
 * Useful for testing on non-Windows systems or without driver installed
 */
export class MockInterceptionExecutor {
  private initialized: boolean = false;

  async initialize(): Promise<boolean> {
    logger.info("Initialized in MOCK mode (no actual keypresses)");
    logger.info("Install Interception driver for real kernel-level injection");
    this.initialized = true;
    return true;
  }

  destroy(): void {
    this.initialized = false;
    logger.debug("Destroyed");
  }

  validateSequence(sequence: SequenceStep[]): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];
    const uniqueKeys = new Set(
      sequence.filter((s) => s.key).map((s) => s.key!.toLowerCase()),
    );

    if (uniqueKeys.size > SEQUENCE_CONSTRAINTS.MAX_UNIQUE_KEYS) {
      errors.push(
        `Too many unique keys: ${uniqueKeys.size} (max ${SEQUENCE_CONSTRAINTS.MAX_UNIQUE_KEYS})`,
      );
    }

    // Count STEPS per key
    const keyStepCount: Map<string, number> = new Map();

    for (const step of sequence) {
      // Skip validation for steps without timing
      if (step.minDelay !== undefined && step.maxDelay !== undefined) {
        if (step.minDelay < SEQUENCE_CONSTRAINTS.MIN_DELAY) {
          errors.push(
            `Step ${step.key || "unknown"}: minDelay ${step.minDelay}ms < minimum ${SEQUENCE_CONSTRAINTS.MIN_DELAY}ms`,
          );
        }
        const variance = step.maxDelay - step.minDelay;
        if (variance < SEQUENCE_CONSTRAINTS.MIN_VARIANCE) {
          errors.push(
            `Step ${step.key || "unknown"}: variance ${variance}ms < minimum ${SEQUENCE_CONSTRAINTS.MIN_VARIANCE}ms`,
          );
        }
      }

      // Count steps per key (only if key exists)
      if (step.key) {
        const normalizedKey = step.key.toLowerCase();
        const current = keyStepCount.get(normalizedKey) || 0;
        keyStepCount.set(normalizedKey, current + 1);
      }
    }

    // Check max steps per key
    for (const [key, count] of keyStepCount) {
      if (count > SEQUENCE_CONSTRAINTS.MAX_STEPS_PER_KEY) {
        errors.push(
          `Key "${key}" used in ${count} steps, maximum is ${SEQUENCE_CONSTRAINTS.MAX_STEPS_PER_KEY} steps per key`,
        );
      }
    }

    return { valid: errors.length === 0, errors };
  }

  async executeSequence(sequence: SequenceStep[]): Promise<boolean> {
    if (!this.initialized) return false;

    const validation = this.validateSequence(sequence);
    if (!validation.valid) {
      logger.error("Validation failed:", validation.errors);
      return false;
    }

    logger.debug(`Would execute ${sequence.length} steps:`);
    for (const step of sequence) {
      logger.debug(`- ${step.key} (${step.minDelay}-${step.maxDelay}ms delay)`);
    }
    logger.debug(`Total: ${sequence.length} key presses`);
    return true;
  }
}

export default InterceptionExecutor;
