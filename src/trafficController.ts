import { CompiledProfile, ModifierConflict } from "./types.js";
import { extractRawKey } from "./utils.js";
import { getHumanTrafficWait } from "./humanRandomizer.js";

/**
 * Modifier state for traffic control decisions
 */
export interface ModifierState {
  shift: boolean;
  alt: boolean;
  ctrl: boolean;
}

/**
 * Sleep for a random duration using human-like randomization
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class TrafficController {
  private crossingKey: string | null = null;
  private queue: Array<{ key: string; timestamp: number }> = [];
  private compiledProfile: CompiledProfile;

  // Macros with priority bypass traffic control entirely
  private priorityMacros: Set<string> = new Set();

  // Action cooldown tracking
  private actionCooldownEnd: number = 0;
  private readonly ACTION_COOLDOWN_MS = 120000; // 120 seconds

  // Callback to get current modifier state
  private getModifierState: (() => ModifierState) | null = null;

  constructor(compiledProfile: CompiledProfile) {
    this.compiledProfile = compiledProfile;
  }

  /**
   * Set callback to get current modifier state for smart conflict detection
   */
  setModifierStateCallback(cb: () => ModifierState): void {
    this.getModifierState = cb;
  }

  /**
   * Grant priority to a macro - it will bypass traffic control entirely
   */
  grantPriority(macroName: string): void {
    this.priorityMacros.add(macroName);
  }

  /**
   * Revoke priority from a macro
   */
  revokePriority(macroName: string): void {
    this.priorityMacros.delete(macroName);
  }

  /**
   * Check if a macro has priority
   */
  hasPriority(macroName: string): boolean {
    return this.priorityMacros.has(macroName);
  }

  /**
   * Get all macros with priority
   */
  getPriorityList(): string[] {
    return [...this.priorityMacros];
  }

  /**
   * Check if action is blocked by cooldown
   * @returns null if available, BlockerInfo if on cooldown
   */
  isActionCooldownBlocked(): { reason: string; cooldownMs: number } | null {
    const now = Date.now();
    if (now < this.actionCooldownEnd) {
      const remainingMs = this.actionCooldownEnd - now;
      return {
        reason: `Action on cooldown`,
        cooldownMs: remainingMs,
      };
    }
    return null;
  }

  /**
   * Record action usage and start cooldown timer
   */
  recordActionCooldownUsed(): void {
    this.actionCooldownEnd = Date.now() + this.ACTION_COOLDOWN_MS;
  }

  async requestCrossing(key: string, macroName?: string): Promise<void> {
    // Priority macros bypass traffic control
    if (macroName && this.priorityMacros.has(macroName)) {
      return;
    }

    const raw = extractRawKey(key);

    // R key bypasses traffic control (priority action)
    if (raw === "R") {
      return;
    }

    // TAB is ULTRA-SENSITIVE: never fire if ALT or CTRL are held
    if (raw === "TAB" && this.getModifierState) {
      const modState = this.getModifierState();
      while (modState.alt || modState.ctrl) {
        // Wait until ALT and CTRL are both released
        const waitMs = getHumanTrafficWait();
        await sleep(waitMs);
        // Re-check modifier state (callback returns fresh state)
        const freshState = this.getModifierState();
        if (!freshState.alt && !freshState.ctrl) break;
      }
    }

    // Check if this key is a conflict AND if the conflicting modifier is held
    const conflict = this.compiledProfile.modifierConflicts.get(raw);
    if (!conflict) {
      // Not a conflict key, no wait needed
      return;
    }

    // Smart conflict detection: only wait if the relevant modifier is held
    if (this.getModifierState) {
      const modState = this.getModifierState();

      // Check if the currently held modifier(s) conflict with this key
      const conflictsNow = this.hasActiveConflict(conflict, modState);
      if (!conflictsNow) {
        // The modifier that conflicts with this key is NOT held, safe to proceed
        return;
      }
    }

    this.queue.push({ key: raw, timestamp: Date.now() });

    while (this.shouldWait(raw)) {
      // Use human-like random wait time instead of fixed range
      const waitMs = getHumanTrafficWait();
      await sleep(waitMs);
    }

    this.crossingKey = raw;
  }

  /**
   * Check if there's an active conflict based on current modifier state
   */
  private hasActiveConflict(
    conflict: ModifierConflict,
    modState: ModifierState,
  ): boolean {
    switch (conflict) {
      case "shift":
        return modState.shift;
      case "alt":
        return modState.alt;
      case "both":
        return modState.shift || modState.alt;
    }
  }

  releaseCrossing(key: string): void {
    const raw = extractRawKey(key);
    if (this.crossingKey === raw) {
      this.crossingKey = null;
    }

    // Remove any finished items from queue head
    if (this.queue.length > 0 && this.queue[0].key === raw) {
      this.queue.shift();
    }
  }

  private shouldWait(key: string): boolean {
    const raw = key.toUpperCase();
    return this.crossingKey !== null || this.queue[0]?.key !== raw;
  }
}

export default TrafficController;
