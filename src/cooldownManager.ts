// ============================================================================
// COOLDOWN MANAGER - Action Rate Limiting System
// ============================================================================
//
// Provides configurable action rate limiting with per-action cooldowns:
// - Default cooldown after any cooldown-tracked action
// - Per-action cooldowns that must expire before reuse
// - Queue system that executes most recent sequence when cooldown ends
// - Long/Super Long gesture fallback when one is unbound
//
// ============================================================================

import { MacroBinding, GestureType } from "./types.js";
import { OmegaMacroBinding } from "./omegaTypes.js";

// Create a simple logger if the real one isn't available
const logger = {
  info: (msg: string) => console.log(`[Cooldown] ${msg}`),
  debug: (msg: string) => {
    if (process.env.DEBUG_COOLDOWN) console.log(`[Cooldown:DEBUG] ${msg}`);
  },
  warn: (msg: string) => console.warn(`[Cooldown:WARN] ${msg}`),
  error: (msg: string) => console.error(`[Cooldown:ERROR] ${msg}`),
};

// ============================================================================
// CONFIGURATION
// ============================================================================

/** Default cooldown duration in milliseconds */
export const DEFAULT_COOLDOWN_MS = 1275;

// Populated from profile configuration at runtime
export const COOLDOWN_ACTIONS = new Set<string>();

// Populated from profile configuration at runtime
export const ACTION_COOLDOWNS_MS: Record<string, number> = {};

// ============================================================================
// TYPES
// ============================================================================

export interface QueuedSequence {
  binding: MacroBinding;
  queuedAt: number;
  cooldownAction: string;
}

export interface CooldownState {
  isActive: boolean;
  startedAt: number;
  endsAt: number;
  currentAction: string | null;
}

export interface CooldownManagerStats {
  cooldownActive: boolean;
  cooldownRemaining: number;
  queueSize: number;
  currentAction: string | null;
  actionsOnCooldown: string[];
}

// ============================================================================
// COOLDOWN MANAGER CLASS
// ============================================================================

export class CooldownManager {
  private cooldownState: CooldownState = {
    isActive: false,
    startedAt: 0,
    endsAt: 0,
    currentAction: null,
  };

  /** Tracks when each action was last used (for per-action cooldowns) */
  private actionCooldowns: Map<string, number> = new Map();

  /** Queue of pending cooldown sequences (only most recent will execute) */
  private cooldownQueue: QueuedSequence[] = [];

  /** Callback to execute a binding when cooldown ends */
  private executeCallback: ((binding: MacroBinding) => void) | null = null;

  /** Timer for cooldown expiration */
  private cooldownTimer: NodeJS.Timeout | null = null;

  /** Shutdown flag */
  private isShutdown: boolean = false;

  /**
   * Per-action cooldown tracking mode.
   * When false, only the default cooldown is respected - individual action cooldowns are ignored.
   * When true, actions respect their configured cooldowns.
   */
  private perActionCooldownsEnabled: boolean = true;

  constructor() {
    logger.info(`Initialized - cooldown: ${DEFAULT_COOLDOWN_MS}ms`);
  }

  /**
   * Enable or disable per-action cooldown tracking.
   * When disabled, only cooldown (1.275s) is enforced between abilities.
   */
  setPerActionCooldownsEnabled(enabled: boolean): void {
    this.perActionCooldownsEnabled = enabled;
    if (enabled) {
      logger.info("Per-action cooldowns ENABLED");
    } else {
      logger.info("Per-action cooldowns DISABLED (default cooldown only)");
      this.actionCooldowns.clear(); // Clear any existing cooldowns
    }
  }

  /**
   * Check if per-action cooldowns are enabled
   */
  isPerActionCooldownsEnabled(): boolean {
    return this.perActionCooldownsEnabled;
  }

  /**
   * Reset cooldowns for actions with duration less than specified threshold.
   * Default threshold is 20000ms (20 seconds).
   * Returns the list of actions that were reset.
   */
  resetShortCooldowns(maxDurationMs: number = 20000): string[] {
    const resetAbilities: string[] = [];

    for (const [action, lastUsed] of this.actionCooldowns) {
      const cooldownMs = ACTION_COOLDOWNS_MS[action];
      if (cooldownMs && cooldownMs < maxDurationMs) {
        // Check if this action is actually on cooldown
        const elapsed = Date.now() - lastUsed;
        if (elapsed < cooldownMs) {
          resetAbilities.push(action);
        }
      }
    }

    // Clear the cooldowns for short-duration actions
    for (const action of resetAbilities) {
      this.actionCooldowns.delete(action);
    }

    if (resetAbilities.length > 0) {
      logger.info(
        `Reset ${resetAbilities.length} short cooldowns: ${resetAbilities.join(", ")}`,
      );
    } else {
      logger.debug("No short cooldowns to reset");
    }

    return resetAbilities;
  }

  // ==========================================================================
  // PUBLIC API
  // ==========================================================================

  /**
   * Set the callback to execute bindings when cooldown allows
   */
  setExecuteCallback(callback: (binding: MacroBinding) => void): void {
    this.executeCallback = callback;
  }

  /**
   * Detect the cooldown action in a macro binding
   */
  detectCooldownAction(binding: MacroBinding): string | null {
    // Check if binding has explicit actionId field
    if ((binding as any).actionId) {
      return (binding as any).actionId.toUpperCase();
    }

    return null;
  }

  /**
   * Check if a binding contains a cooldown action
   */
  isCooldownBinding(binding: MacroBinding): boolean {
    return this.detectCooldownAction(binding) !== null;
  }

  /**
   * Check if the cooldown is currently active
   */
  isCooldownActive(): boolean {
    if (!this.cooldownState.isActive) return false;

    // Check if cooldown has expired
    if (Date.now() >= this.cooldownState.endsAt) {
      this.cooldownState.isActive = false;
      return false;
    }

    return true;
  }

  /**
   * Get remaining cooldown time in milliseconds
   */
  getCooldownRemaining(): number {
    if (!this.isCooldownActive()) return 0;
    return Math.max(0, this.cooldownState.endsAt - Date.now());
  }

  /**
   * Check if a specific action is on its individual cooldown.
   * Always returns false if per-action cooldowns are disabled.
   */
  isActionOnCooldown(actionName: string): boolean {
    // If per-action cooldowns are disabled, only cooldown matters
    if (!this.perActionCooldownsEnabled) {
      return false;
    }

    const upperName = actionName.toUpperCase();
    const lastUsed = this.actionCooldowns.get(upperName);

    if (!lastUsed) return false;

    const cooldownMs = ACTION_COOLDOWNS_MS[upperName];
    if (!cooldownMs) return false; // No specific cooldown for this action

    const elapsed = Date.now() - lastUsed;
    return elapsed < cooldownMs;
  }

  /**
   * Get remaining cooldown time for an action in milliseconds
   */
  getActionCooldownRemaining(actionName: string): number {
    const upperName = actionName.toUpperCase();
    const lastUsed = this.actionCooldowns.get(upperName);

    if (!lastUsed) return 0;

    const cooldownMs = ACTION_COOLDOWNS_MS[upperName];
    if (!cooldownMs) return 0;

    const elapsed = Date.now() - lastUsed;
    return Math.max(0, cooldownMs - elapsed);
  }

  /**
   * Try to execute a macro binding.
   * - Non-cooldown bindings execute immediately
   * - cooldown bindings either execute (if Cooldown not active) or queue (if Cooldown active)
   *
   * Returns: { executed: boolean, queued: boolean, reason?: string }
   */
  tryExecute(binding: MacroBinding): {
    executed: boolean;
    queued: boolean;
    reason?: string;
  } {
    if (this.isShutdown) {
      return { executed: false, queued: false, reason: "shutdown" };
    }

    const cooldownAction = this.detectCooldownAction(binding);

    // Non-cooldown binding - execute immediately (bypass cooldown system)
    if (!cooldownAction) {
      logger.debug(`Non-cooldown: ${binding.name} - executing immediately`);
      this.executeNonCooldownBinding(binding);
      return { executed: true, queued: false };
    }

    // cooldown binding - check action cooldown first
    if (this.isActionOnCooldown(cooldownAction)) {
      const remaining = this.getActionCooldownRemaining(cooldownAction);
      logger.debug(
        `${cooldownAction} on cooldown (${(remaining / 1000).toFixed(1)}s remaining)`,
      );

      // Still queue it - might become available by the time cooldown processes
      if (this.isCooldownActive()) {
        this.queueSequence(binding, cooldownAction);
        return {
          executed: false,
          queued: true,
          reason: `${cooldownAction} on cooldown, queued`,
        };
      }

      // Cooldown not active but action on cooldown - skip
      return {
        executed: false,
        queued: false,
        reason: `${cooldownAction} on cooldown`,
      };
    }

    // Check if cooldown is active
    if (this.isCooldownActive()) {
      const remaining = this.getCooldownRemaining();
      logger.debug(
        `Cooldown active (${remaining}ms remaining) - queueing ${binding.name}`,
      );
      this.queueSequence(binding, cooldownAction);
      return { executed: false, queued: true, reason: "Cooldown active" };
    }

    // Cooldown not active, action not on cooldown - execute now
    logger.info(`Executing: ${binding.name} (${cooldownAction})`);
    this.executeCooldownBinding(binding, cooldownAction);
    return { executed: true, queued: false };
  }

  /**
   * Get current stats for debugging/display
   */
  getStats(): CooldownManagerStats {
    const actionsOnCooldown: string[] = [];

    for (const [action] of this.actionCooldowns) {
      if (this.isActionOnCooldown(action)) {
        actionsOnCooldown.push(action);
      }
    }

    return {
      cooldownActive: this.isCooldownActive(),
      cooldownRemaining: this.getCooldownRemaining(),
      queueSize: this.cooldownQueue.length,
      currentAction: this.cooldownState.currentAction,
      actionsOnCooldown,
    };
  }

  /**
   * Clear the queue
   */
  clearQueue(): void {
    const count = this.cooldownQueue.length;
    this.cooldownQueue = [];
    if (count > 0) {
      logger.debug(`Cleared ${count} queued sequences`);
    }
  }

  /**
   * Reset all cooldowns (e.g., for testing or combat reset)
   */
  resetCooldowns(): void {
    this.actionCooldowns.clear();
    this.cooldownState = {
      isActive: false,
      startedAt: 0,
      endsAt: 0,
      currentAction: null,
    };
    if (this.cooldownTimer) {
      clearTimeout(this.cooldownTimer);
      this.cooldownTimer = null;
    }
    this.clearQueue();
    logger.info("All cooldowns reset");
  }

  /**
   * Shutdown the manager
   */
  shutdown(): void {
    this.isShutdown = true;
    if (this.cooldownTimer) {
      clearTimeout(this.cooldownTimer);
      this.cooldownTimer = null;
    }
    this.clearQueue();
    logger.info("Shutdown complete");
  }

  // ==========================================================================
  // INTERNAL METHODS
  // ==========================================================================

  private queueSequence(binding: MacroBinding, cooldownAction: string): void {
    this.cooldownQueue.push({
      binding,
      queuedAt: Date.now(),
      cooldownAction,
    });
    logger.debug(
      `Queued: ${binding.name} (${cooldownAction}) - queue size: ${this.cooldownQueue.length}`,
    );
  }

  private executeCooldownBinding(
    binding: MacroBinding,
    cooldownAction: string,
  ): void {
    // Start cooldown timer
    this.startCooldown(cooldownAction);

    // Execute via callback
    if (this.executeCallback) {
      this.executeCallback(binding);
    }
  }

  private executeNonCooldownBinding(binding: MacroBinding): void {
    if (this.executeCallback) {
      this.executeCallback(binding);
    }
  }

  private startCooldown(actionName: string): void {
    const now = Date.now();
    const upperName = actionName.toUpperCase();

    // Set cooldown state
    this.cooldownState = {
      isActive: true,
      startedAt: now,
      endsAt: now + DEFAULT_COOLDOWN_MS,
      currentAction: upperName,
    };

    // Record action usage for per-action cooldown
    this.actionCooldowns.set(upperName, now);

    logger.debug(
      `Cooldown started: ${upperName} (ends in ${DEFAULT_COOLDOWN_MS}ms)`,
    );

    // Clear any existing timer
    if (this.cooldownTimer) {
      clearTimeout(this.cooldownTimer);
    }

    // Set timer to process queue when cooldown ends
    this.cooldownTimer = setTimeout(() => {
      this.onCooldownEnd();
    }, DEFAULT_COOLDOWN_MS + 5); // Small buffer for timing precision
  }

  private onCooldownEnd(): void {
    if (this.isShutdown) return;

    this.cooldownState.isActive = false;
    this.cooldownTimer = null;

    logger.debug(
      `Cooldown ended, processing queue (${this.cooldownQueue.length} items)`,
    );

    // Process the queue - execute most recent valid sequence
    this.processQueue();
  }

  /**
   * Process the queue when cooldown ends.
   * Executes the most recently queued sequence that's not on cooldown.
   * Discards all other queued sequences.
   */
  private processQueue(): void {
    if (this.cooldownQueue.length === 0) {
      return;
    }

    // Sort by queuedAt descending (most recent first)
    this.cooldownQueue.sort((a, b) => b.queuedAt - a.queuedAt);

    logger.debug(
      `Processing queue: most recent = ${this.cooldownQueue[0].binding.name}`,
    );

    // Find the most recent sequence that's not on cooldown
    for (const entry of this.cooldownQueue) {
      if (!this.isActionOnCooldown(entry.cooldownAction)) {
        logger.info(
          `Executing queued: ${entry.binding.name} (${entry.cooldownAction})`,
        );

        // Clear queue first (discard all others)
        this.cooldownQueue = [];

        // Execute this one
        this.executeCooldownBinding(entry.binding, entry.cooldownAction);
        return;
      } else {
        const remaining = this.getActionCooldownRemaining(entry.cooldownAction);
        logger.debug(
          `Skipping ${entry.cooldownAction} - on cooldown (${(remaining / 1000).toFixed(1)}s)`,
        );
      }
    }

    // All queued actions on cooldown - clear queue
    logger.debug("All queued actions on cooldown, clearing queue");
    this.cooldownQueue = [];
  }
}

// ============================================================================
// GESTURE FALLBACK LOGIC
// ============================================================================

/**
 * Get fallback gesture when the triggered gesture has no binding.
 *
 * Rules:
 * - If "long" triggered but unbound → try "super_long"
 * - If "super_long" triggered but unbound → try "long"
 *
 * Only applies to single/double/triple/quadruple tap variants.
 */
export function getGestureFallback(
  triggeredGesture: GestureType,
  hasBinding: (gesture: GestureType) => boolean,
): GestureType | null {
  // Extract base (single, double, triple, quadruple) and suffix
  const longMatch = triggeredGesture.match(
    /^(single|double|triple|quadruple)_long$/,
  );
  const superLongMatch = triggeredGesture.match(
    /^(single|double|triple|quadruple)_super_long$/,
  );

  if (longMatch) {
    // "long" triggered - try "super_long"
    const base = longMatch[1];
    const fallback = `${base}_super_long` as GestureType;
    if (hasBinding(fallback)) {
      return fallback;
    }
  } else if (superLongMatch) {
    // "super_long" triggered - try "long"
    const base = superLongMatch[1];
    const fallback = `${base}_long` as GestureType;
    if (hasBinding(fallback)) {
      return fallback;
    }
  }

  return null;
}

/**
 * Check if a binding is "empty" (placeholder with no real sequence)
 * Empty bindings have:
 * - Name containing "~"
 * - Empty sequence array
 * - Not enabled
 */
export function isEmptyBinding(
  binding: MacroBinding | OmegaMacroBinding | undefined | null,
): boolean {
  if (!binding) return true;
  if (!binding.enabled) return true;
  if (binding.name.includes("~")) return true;
  if (!binding.sequence || binding.sequence.length === 0) return true;
  return false;
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let cooldownManagerInstance: CooldownManager | null = null;

export function getCooldownManager(): CooldownManager {
  if (!cooldownManagerInstance) {
    cooldownManagerInstance = new CooldownManager();
  }
  return cooldownManagerInstance;
}

export function resetCooldownManager(): void {
  if (cooldownManagerInstance) {
    cooldownManagerInstance.shutdown();
    cooldownManagerInstance = null;
  }
}

export default CooldownManager;
