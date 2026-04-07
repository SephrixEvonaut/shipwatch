// ============================================================================
// COOLDOWN MANAGER TESTS
// ============================================================================

import { test, expect, beforeEach, afterEach, describe } from "vitest";
import {
  CooldownManager,
  DEFAULT_COOLDOWN_MS,
  ACTION_COOLDOWNS_MS,
  COOLDOWN_ACTIONS,
  getGestureFallback,
  isEmptyBinding,
} from "../src/cooldownManager.js";
import { MacroBinding, GestureType } from "../src/types.js";

// Helper to create test bindings
function createBinding(name: string, actionId?: string): MacroBinding {
  return {
    name,
    trigger: { key: "1", gesture: "single" },
    sequence: [{ key: "N", minDelay: 25, maxDelay: 30 }],
    enabled: true,
    actionId: actionId as any,
  };
}

// Helper to wait
function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("CooldownManager", () => {
  let cooldownManager: CooldownManager;
  let executedBindings: MacroBinding[];

  beforeEach(() => {
    cooldownManager = new CooldownManager();
    executedBindings = [];
    cooldownManager.setExecuteCallback((binding) => {
      executedBindings.push(binding);
    });
  });

  afterEach(() => {
    cooldownManager.shutdown();
    // Clean up any runtime-populated data
    COOLDOWN_ACTIONS.clear();
    for (const key of Object.keys(ACTION_COOLDOWNS_MS)) {
      delete ACTION_COOLDOWNS_MS[key];
    }
  });

  // ==========================================================================
  // COOLDOWN ACTION DETECTION
  // ==========================================================================

  describe("Cooldown Action Detection", () => {
    test("detects explicit actionId field", () => {
      const binding = createBinding("My Macro", "CRUSHING_BLOW");
      expect(cooldownManager.detectCooldownAction(binding)).toBe(
        "CRUSHING_BLOW",
      );
    });

    test("returns null when no actionId present", () => {
      const binding = createBinding("Some Macro");
      expect(cooldownManager.detectCooldownAction(binding)).toBeNull();
    });

    test("returns null for non-cooldown macros", () => {
      const binding = createBinding("Jump");
      expect(cooldownManager.detectCooldownAction(binding)).toBeNull();
    });

    test("returns null for timer macros", () => {
      const binding = createBinding("Timer: Burst (13s)");
      expect(cooldownManager.detectCooldownAction(binding)).toBeNull();
    });
  });

  // ==========================================================================
  // COOLDOWN STATE
  // ==========================================================================

  describe("Cooldown State", () => {
    test("cooldown is not active initially", () => {
      expect(cooldownManager.isCooldownActive()).toBe(false);
      expect(cooldownManager.getCooldownRemaining()).toBe(0);
    });

    test("cooldown activates after executing cooldown binding", () => {
      const binding = createBinding("Action A", "ACTION_A");
      COOLDOWN_ACTIONS.add("ACTION_A");
      cooldownManager.tryExecute(binding);

      expect(cooldownManager.isCooldownActive()).toBe(true);
      expect(cooldownManager.getCooldownRemaining()).toBeGreaterThan(0);
      expect(cooldownManager.getCooldownRemaining()).toBeLessThanOrEqual(
        DEFAULT_COOLDOWN_MS,
      );
    });

    test("cooldown does not activate for non-cooldown binding", () => {
      const binding = createBinding("Jump");
      cooldownManager.tryExecute(binding);

      expect(cooldownManager.isCooldownActive()).toBe(false);
    });
  });

  // ==========================================================================
  // ACTION COOLDOWNS
  // ==========================================================================

  describe("Action Cooldowns", () => {
    test("action is on cooldown after execution", () => {
      COOLDOWN_ACTIONS.add("ACTION_A");
      ACTION_COOLDOWNS_MS["ACTION_A"] = 7000;
      const binding = createBinding("Action A", "ACTION_A");
      cooldownManager.tryExecute(binding);

      expect(cooldownManager.isActionOnCooldown("ACTION_A")).toBe(true);
      expect(
        cooldownManager.getActionCooldownRemaining("ACTION_A"),
      ).toBeGreaterThan(0);
    });

    test("action cooldown matches configured duration", () => {
      COOLDOWN_ACTIONS.add("ACTION_A");
      ACTION_COOLDOWNS_MS["ACTION_A"] = 7000;
      const binding = createBinding("Action A", "ACTION_A");
      cooldownManager.tryExecute(binding);

      const remaining = cooldownManager.getActionCooldownRemaining("ACTION_A");
      expect(remaining).toBeGreaterThan(6900); // Should be close to 7000ms
      expect(remaining).toBeLessThanOrEqual(7000);
    });

    test("actions without specific cooldowns only respect default cooldown", () => {
      const binding = createBinding("Generic Action");
      cooldownManager.tryExecute(binding);

      // No actionId → no action-specific cooldown tracked
      expect(cooldownManager.isActionOnCooldown("GENERIC_ACTION")).toBe(false);
    });
  });

  // ==========================================================================
  // EXECUTION BEHAVIOR
  // ==========================================================================

  describe("Execution Behavior", () => {
    test("executes immediately when cooldown not active", () => {
      COOLDOWN_ACTIONS.add("ACTION_A");
      const binding = createBinding("Action A", "ACTION_A");
      const result = cooldownManager.tryExecute(binding);

      expect(result.executed).toBe(true);
      expect(result.queued).toBe(false);
      expect(executedBindings).toHaveLength(1);
      expect(executedBindings[0].name).toBe("Action A");
    });

    test("queues when cooldown is active", () => {
      COOLDOWN_ACTIONS.add("ACTION_A");
      COOLDOWN_ACTIONS.add("ACTION_B");
      const binding1 = createBinding("Action A", "ACTION_A");
      const binding2 = createBinding("Action B", "ACTION_B");

      cooldownManager.tryExecute(binding1); // Starts cooldown
      const result = cooldownManager.tryExecute(binding2);

      expect(result.executed).toBe(false);
      expect(result.queued).toBe(true);
      expect(result.reason).toBe("Cooldown active");
    });

    test("non-cooldown executes immediately even during cooldown", () => {
      COOLDOWN_ACTIONS.add("ACTION_A");
      const cooldownBinding = createBinding("Action A", "ACTION_A");
      const nonCooldownBinding = createBinding("Jump");

      cooldownManager.tryExecute(cooldownBinding); // Starts cooldown
      const result = cooldownManager.tryExecute(nonCooldownBinding);

      expect(result.executed).toBe(true);
      expect(result.queued).toBe(false);
    });

    test("tracks action cooldown after execution", () => {
      COOLDOWN_ACTIONS.add("ACTION_A");
      ACTION_COOLDOWNS_MS["ACTION_A"] = 7000;
      const binding = createBinding("Action A", "ACTION_A");

      cooldownManager.tryExecute(binding);

      expect(cooldownManager.isActionOnCooldown("ACTION_A")).toBe(true);
    });
  });

  // ==========================================================================
  // QUEUE PROCESSING
  // ==========================================================================

  describe("Queue Processing", () => {
    test("executes most recent queued sequence when cooldown ends", async () => {
      COOLDOWN_ACTIONS.add("ACTION_A");
      COOLDOWN_ACTIONS.add("ACTION_B");
      COOLDOWN_ACTIONS.add("ACTION_C");
      const binding1 = createBinding("Action A", "ACTION_A");
      const binding2 = createBinding("Action B", "ACTION_B");
      const binding3 = createBinding("Action C", "ACTION_C");

      cooldownManager.tryExecute(binding1); // Starts cooldown, executes
      await wait(5);
      cooldownManager.tryExecute(binding2); // Queued
      await wait(5);
      cooldownManager.tryExecute(binding3); // Queued (most recent)

      expect(cooldownManager.getStats().queueSize).toBe(2);

      // Wait for cooldown to end
      await wait(DEFAULT_COOLDOWN_MS + 50);

      // Most recent (Action C) should have been executed
      expect(executedBindings.length).toBeGreaterThanOrEqual(2);
      const lastExecuted = executedBindings[executedBindings.length - 1];
      expect(lastExecuted.name).toBe("Action C");
    }, 10000);

    test("skips queued actions that are on cooldown", async () => {
      COOLDOWN_ACTIONS.add("ACTION_A");
      COOLDOWN_ACTIONS.add("ACTION_B");
      ACTION_COOLDOWNS_MS["ACTION_A"] = 7000;
      const binding1 = createBinding("Action A", "ACTION_A");
      const binding2 = createBinding("Action A copy", "ACTION_A"); // Same action, will be on CD
      const binding3 = createBinding("Action B", "ACTION_B");

      cooldownManager.tryExecute(binding1); // Starts cooldown, puts ACTION_A on cooldown
      cooldownManager.tryExecute(binding2); // Queued but will be on CD
      cooldownManager.tryExecute(binding3); // Queued, different action

      // Wait for cooldown to end
      await wait(DEFAULT_COOLDOWN_MS + 50);

      // Action B should execute (Action A is on CD)
      const executed = executedBindings.map((b) => b.name);
      expect(executed).toContain("Action B");
    }, 10000);

    test("clears queue after processing", async () => {
      COOLDOWN_ACTIONS.add("ACTION_A");
      COOLDOWN_ACTIONS.add("ACTION_B");
      const binding1 = createBinding("Action A", "ACTION_A");
      const binding2 = createBinding("Action B", "ACTION_B");

      cooldownManager.tryExecute(binding1);
      cooldownManager.tryExecute(binding2);

      await wait(DEFAULT_COOLDOWN_MS + 50);

      expect(cooldownManager.getStats().queueSize).toBe(0);
    }, 10000);
  });

  // ==========================================================================
  // RESET AND SHUTDOWN
  // ==========================================================================

  describe("Reset and Shutdown", () => {
    test("resetCooldowns clears all state", () => {
      COOLDOWN_ACTIONS.add("ACTION_A");
      ACTION_COOLDOWNS_MS["ACTION_A"] = 7000;
      const binding = createBinding("Action A", "ACTION_A");
      cooldownManager.tryExecute(binding);

      cooldownManager.resetCooldowns();

      expect(cooldownManager.isCooldownActive()).toBe(false);
      expect(cooldownManager.isActionOnCooldown("ACTION_A")).toBe(false);
      expect(cooldownManager.getStats().queueSize).toBe(0);
    });

    test("clearQueue only clears queue", () => {
      COOLDOWN_ACTIONS.add("ACTION_A");
      COOLDOWN_ACTIONS.add("ACTION_B");
      const binding1 = createBinding("Action A", "ACTION_A");
      const binding2 = createBinding("Action B", "ACTION_B");

      cooldownManager.tryExecute(binding1);
      cooldownManager.tryExecute(binding2);

      cooldownManager.clearQueue();

      expect(cooldownManager.isCooldownActive()).toBe(true); // Cooldown still active
      expect(cooldownManager.getStats().queueSize).toBe(0); // Queue cleared
    });
  });
});

// ============================================================================
// GESTURE FALLBACK TESTS
// ============================================================================

describe("Gesture Fallback", () => {
  test("long falls back to super_long when unbound", () => {
    const hasBinding = (g: GestureType) => g === "single_super_long";

    const fallback = getGestureFallback("single_long", hasBinding);
    expect(fallback).toBe("single_super_long");
  });

  test("super_long falls back to long when unbound", () => {
    const hasBinding = (g: GestureType) => g === "double_long";

    const fallback = getGestureFallback("double_super_long", hasBinding);
    expect(fallback).toBe("double_long");
  });

  test("returns null when neither available", () => {
    const hasBinding = () => false;

    const fallback = getGestureFallback("triple_long", hasBinding);
    expect(fallback).toBeNull();
  });

  test("returns null for non-long gestures", () => {
    const hasBinding = () => true;

    const fallback = getGestureFallback("single", hasBinding);
    expect(fallback).toBeNull();
  });

  test("works for all tap counts", () => {
    const hasBinding = (g: GestureType) => g.endsWith("_super_long");

    expect(getGestureFallback("single_long", hasBinding)).toBe(
      "single_super_long",
    );
    expect(getGestureFallback("double_long", hasBinding)).toBe(
      "double_super_long",
    );
    expect(getGestureFallback("triple_long", hasBinding)).toBe(
      "triple_super_long",
    );
    expect(getGestureFallback("quadruple_long", hasBinding)).toBe(
      "quadruple_super_long",
    );
  });
});

// ============================================================================
// EMPTY BINDING DETECTION
// ============================================================================

describe("Empty Binding Detection", () => {
  test("null is empty", () => {
    expect(isEmptyBinding(null)).toBe(true);
  });

  test("undefined is empty", () => {
    expect(isEmptyBinding(undefined)).toBe(true);
  });

  test("disabled binding is empty", () => {
    const binding = createBinding("Test");
    binding.enabled = false;
    expect(isEmptyBinding(binding)).toBe(true);
  });

  test("binding with ~ in name is empty", () => {
    const binding = createBinding("~ Placeholder");
    expect(isEmptyBinding(binding)).toBe(true);
  });

  test("binding with empty sequence is empty", () => {
    const binding = createBinding("Test");
    binding.sequence = [];
    expect(isEmptyBinding(binding)).toBe(true);
  });

  test("valid binding is not empty", () => {
    const binding = createBinding("My Action");
    expect(isEmptyBinding(binding)).toBe(false);
  });
});

// ============================================================================
// ACTION COOLDOWN CONFIGURATION
// ============================================================================

describe("Action Cooldown Configuration", () => {
  test("cooldown actions set starts empty (populated at runtime)", () => {
    // Data structures are empty by default — profiles populate them at runtime
    expect(COOLDOWN_ACTIONS).toBeInstanceOf(Set);
  });

  test("action cooldowns record starts empty (populated at runtime)", () => {
    expect(ACTION_COOLDOWNS_MS).toEqual({});
  });

  test("cooldown duration is 1.275 seconds", () => {
    expect(DEFAULT_COOLDOWN_MS).toBe(1275);
  });
});
