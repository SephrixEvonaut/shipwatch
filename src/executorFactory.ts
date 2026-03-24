// ============================================================================
// EXECUTOR FACTORY - Backend selection for keypress injection
// ============================================================================

import { MacroBinding } from "./types.js";
import {
  SequenceExecutor,
  ExecutionCallback,
  ExecutionEvent,
} from "./sequenceExecutor.js";
import {
  InterceptionExecutor,
  MockInterceptionExecutor,
} from "./interceptionExecutor.js";
import { logger } from "./logger.js";

/**
 * Available execution backends
 * - robotjs: Software-level keyboard simulation (SendInput API)
 * - interception: Kernel-level integration (lowest latency)
 * - teensy: Hardware USB HID via Teensy 4.0 serial (zero host CPU contention)
 * - mock: Testing only (no keypresses sent)
 */
export type ExecutorBackend = "robotjs" | "interception" | "teensy" | "mock";

/**
 * Unified executor interface
 * Supports both awaitable and fire-and-forget execution for concurrent sequences
 */
export interface IExecutor {
  execute(binding: MacroBinding): Promise<boolean>;
  executeDetached(binding: MacroBinding): void; // Fire-and-forget for concurrent execution
  isBindingExecuting?(bindingName: string): boolean;
  getActiveExecutionCount?(): number;
  cancel?(bindingName: string): void;
  cancelAll?(): void;
  dryRun?(binding: MacroBinding): Promise<void>;
  destroy?(): void;
  grantPriority?(macroName: string): void;
  revokePriority?(macroName: string): void;
  isActionCooldownBlocked?(): { reason: string; cooldownMs: number } | null;
  recordActionCooldownUsed?(): void;
}

/**
 * Backend configuration
 */
export interface ExecutorConfig {
  backend: ExecutorBackend;
  interceptionDllPath?: string;
  onEvent?: ExecutionCallback;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: ExecutorConfig = {
  backend: "robotjs",
};

/**
 * Wrapper for InterceptionExecutor to match the IExecutor interface
 */
class InterceptionExecutorWrapper implements IExecutor {
  private executor: InterceptionExecutor | MockInterceptionExecutor;
  private onEvent: ExecutionCallback;
  private activeExecutions: Map<string, boolean> = new Map();
  private activeCount: number = 0;

  constructor(
    executor: InterceptionExecutor | MockInterceptionExecutor,
    onEvent?: ExecutionCallback,
  ) {
    this.executor = executor;
    this.onEvent = onEvent || (() => {});
  }

  async execute(binding: MacroBinding): Promise<boolean> {
    return this.executeInternal(binding);
  }

  executeDetached(binding: MacroBinding): void {
    if (this.isBindingExecuting(binding.name)) {
      console.log(`⚠️  "${binding.name}" already executing, skipping...`);
      return;
    }

    this.executeInternal(binding).catch((error) => {
      console.error(
        `❌ Detached execution error for "${binding.name}":`,
        error,
      );
    });
  }

  private async executeInternal(binding: MacroBinding): Promise<boolean> {
    if (this.activeExecutions.get(binding.name)) {
      console.log(`⚠️  "${binding.name}" already executing, skipping...`);
      return false;
    }

    this.activeExecutions.set(binding.name, true);
    this.activeCount++;

    this.onEvent({
      type: "started",
      bindingName: binding.name,
      timestamp: Date.now(),
    });

    try {
      const result = await this.executor.executeSequence(binding.sequence);

      this.onEvent({
        type: result ? "completed" : "error",
        bindingName: binding.name,
        error: result ? undefined : "Execution failed",
        timestamp: Date.now(),
      });

      return result;
    } finally {
      this.activeExecutions.set(binding.name, false);
      this.activeCount--;
    }
  }

  isBindingExecuting(bindingName: string): boolean {
    return this.activeExecutions.get(bindingName) || false;
  }

  getActiveExecutionCount(): number {
    return this.activeCount;
  }

  destroy(): void {
    this.executor.destroy();
  }
}

/**
 * Factory to create the appropriate executor based on configuration
 */
export class ExecutorFactory {
  /**
   * Create an executor with the specified backend
   */
  static async create(
    config: Partial<ExecutorConfig> = {},
  ): Promise<IExecutor> {
    const fullConfig = { ...DEFAULT_CONFIG, ...config };

    switch (fullConfig.backend) {
      case "robotjs":
        logger.debug("Creating RobotJS executor (SendInput API)");
        logger.debug("Integration: software-level (SendInput API)");
        return new SequenceExecutor(fullConfig.onEvent);

      case "interception":
        logger.debug("Creating Interception executor (kernel-level)");
        logger.debug("Integration: kernel-level (Interception driver)");

        const interception = new InterceptionExecutor(
          fullConfig.interceptionDllPath,
        );
        const initialized = await interception.initialize();

        if (!initialized) {
          logger.warn("Interception init failed, falling back to mock");
          const mock = new MockInterceptionExecutor();
          await mock.initialize();
          return new InterceptionExecutorWrapper(mock, fullConfig.onEvent);
        }

        return new InterceptionExecutorWrapper(
          interception,
          fullConfig.onEvent,
        );

      case "teensy":
        logger.debug("Creating Teensy executor (USB HID via serial)");
        logger.debug("Integration: hardware USB HID (Teensy 4.0)");
        logger.debug("Output optimization: minimal (no queue contention)");
        // TeensySequenceExecutor is created in index.ts where we have async access
        // to the TeensyExecutor singleton. The factory returns a SequenceExecutor
        // configured with backendMode='teensy' which disables workarounds.
        return new SequenceExecutor(fullConfig.onEvent, undefined, "teensy");

      case "mock":
        logger.debug("Creating Mock executor (no keypresses)");
        logger.debug("Use this for testing profile logic");
        const mock = new MockInterceptionExecutor();
        await mock.initialize();
        return new InterceptionExecutorWrapper(mock, fullConfig.onEvent);

      default:
        throw new Error(`Unknown backend: ${fullConfig.backend}`);
    }
  }

  /**
   * Auto-select the best available backend
   * Prefers Interception > RobotJS > Mock
   */
  static async createBest(
    onEvent?: ExecutionCallback,
  ): Promise<{ executor: IExecutor; backend: ExecutorBackend }> {
    // Try Interception first (best for application compatibility)
    if (process.platform === "win32") {
      const available = await InterceptionExecutor.isAvailable();
      if (available) {
        logger.debug("Interception driver detected");
        const executor = await this.create({
          backend: "interception",
          onEvent,
        });
        return { executor, backend: "interception" };
      }
    }

    // Try Teensy if available
    try {
      const { isTeensyAvailable } = await import("./teensyExecutor.js");
      if (await isTeensyAvailable()) {
        logger.debug("Teensy 4.0 detected on USB");
        const executor = await this.create({ backend: "teensy", onEvent });
        return { executor, backend: "teensy" };
      }
    } catch (error) {
      // Teensy not available, continue
    }

    // Fall back to RobotJS
    try {
      const executor = await this.create({ backend: "robotjs", onEvent });
      return { executor, backend: "robotjs" };
    } catch (error) {
      console.warn("[ExecutorFactory] RobotJS not available:", error);
    }

    // Final fallback to mock
    console.warn("[ExecutorFactory] No real executors available, using mock");
    const executor = await this.create({ backend: "mock", onEvent });
    return { executor, backend: "mock" };
  }

  /**
   * Get information about available backends
   */
  static async getAvailableBackends(): Promise<
    { backend: ExecutorBackend; available: boolean; notes: string }[]
  > {
    const backends: {
      backend: ExecutorBackend;
      available: boolean;
      notes: string;
    }[] = [];

    // Check Interception
    if (process.platform === "win32") {
      const interceptionAvailable = await InterceptionExecutor.isAvailable();
      backends.push({
        backend: "interception",
        available: interceptionAvailable,
        notes: interceptionAvailable
          ? "Kernel-level integration (lowest latency, maximum app compatibility)"
          : "Install driver from github.com/oblitum/Interception",
      });
    } else {
      backends.push({
        backend: "interception",
        available: false,
        notes: "Windows only",
      });
    }

    // Check Teensy
    try {
      const { isTeensyAvailable } = await import("./teensyExecutor.js");
      const teensyAvailable = await isTeensyAvailable();
      backends.push({
        backend: "teensy",
        available: teensyAvailable,
        notes: teensyAvailable
          ? "USB HID via Teensy 4.0 (no stutter, hardware keyboard)"
          : "Teensy 4.0 not detected on USB",
      });
    } catch {
      backends.push({
        backend: "teensy",
        available: false,
        notes: "Install serialport: npm install serialport",
      });
    }

    // Check RobotJS
    try {
      await import("robotjs");
      backends.push({
        backend: "robotjs",
        available: true,
        notes:
          "SendInput API (software-level, includes output timing optimization)",
      });
    } catch {
      backends.push({
        backend: "robotjs",
        available: false,
        notes: "Install with: npm install robotjs",
      });
    }

    // Mock is always available
    backends.push({
      backend: "mock",
      available: true,
      notes: "Testing only (no keypresses sent)",
    });

    return backends;
  }
}

export default ExecutorFactory;
