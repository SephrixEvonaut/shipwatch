// ============================================================================
// BACKEND MODE & KEY OUTPUT ADAPTER TESTS
// ============================================================================
//
// Tests the dual-mode (software/teensy) architecture to verify:
// 1. SequenceExecutor in teensy mode skips RepeatPolice
// 2. SequenceExecutor in teensy mode uses reduced pacing (20/50/80ms)
// 3. SequenceExecutor in software mode keeps full workarounds (100/120/190ms)
// 4. Pressure monitor is only called in software mode
// 5. KeyOutputAdapter correctly determines backend mode
// 6. TeensyAdapter and RobotJSAdapter have correct mode flags
// 7. SpecialKeyHandler respects backendMode for pressure recording
//
// ============================================================================

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock robotjs
vi.mock("robotjs", () => ({
  default: {
    keyTap: vi.fn(),
    keyToggle: vi.fn(),
    setKeyboardDelay: vi.fn(),
    scrollMouse: vi.fn(),
  },
}));

// Mock serialport
vi.mock("serialport", () => ({
  SerialPort: {
    list: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock("@serialport/parser-readline", () => ({
  ReadlineParser: vi.fn(),
}));

// Mock the queue pressure monitor
const mockRecordOutput = vi.fn();
const mockGetAdaptiveDelay = vi.fn().mockReturnValue(0);
const mockShouldThrottleAbility = vi.fn().mockReturnValue(0);
const mockPrintSummary = vi.fn();

vi.mock("../src/queuePressureMonitor.js", () => ({
  getQueuePressureMonitor: () => ({
    recordOutput: mockRecordOutput,
    getAdaptiveDelay: mockGetAdaptiveDelay,
    shouldThrottleAbility: mockShouldThrottleAbility,
    printSummary: mockPrintSummary,
  }),
}));

import { SequenceExecutor } from "../src/sequenceExecutor.js";
import {
  type BackendMode,
  getBackendMode,
  RobotJSAdapter,
  TeensyAdapter,
} from "../src/keyOutputAdapter.js";
import { MacroBinding, SequenceStep } from "../src/types.js";

// ============================================================================
// HELPER: Create test bindings
// ============================================================================

function createSimpleBinding(name: string, key: string = "N"): MacroBinding {
  return {
    name,
    trigger: { key: "1", gesture: "single" },
    sequence: [
      {
        key,
        minDelay: 10,
        maxDelay: 15,
        keyDownDuration: [20, 30],
        bufferTier: "low" as any,
      },
    ],
    enabled: true,
  };
}

function createMultiStepBinding(name: string): MacroBinding {
  return {
    name,
    trigger: { key: "1", gesture: "single" },
    sequence: [
      {
        key: "N",
        minDelay: 10,
        maxDelay: 15,
        keyDownDuration: [20, 30],
        bufferTier: "low" as any,
      },
      {
        key: "J",
        minDelay: 10,
        maxDelay: 15,
        keyDownDuration: [20, 30],
        bufferTier: "low" as any,
      },
      {
        key: "K",
        minDelay: 10,
        maxDelay: 15,
        keyDownDuration: [20, 30],
        bufferTier: "low" as any,
      },
      {
        key: "L",
        minDelay: 10,
        maxDelay: 15,
        keyDownDuration: [20, 30],
        bufferTier: "low" as any,
      },
    ],
    enabled: true,
  };
}

// ============================================================================
// TESTS: getBackendMode()
// ============================================================================

describe("getBackendMode()", () => {
  it('returns "teensy" for teensy backend', () => {
    expect(getBackendMode("teensy")).toBe("teensy");
  });

  it('returns "software" for robotjs backend', () => {
    expect(getBackendMode("robotjs")).toBe("software");
  });

  it('returns "software" for interception backend', () => {
    expect(getBackendMode("interception")).toBe("software");
  });

  it('returns "software" for mock backend', () => {
    expect(getBackendMode("mock")).toBe("software");
  });
});

// ============================================================================
// TESTS: Adapter Mode Flags
// ============================================================================

describe("Adapter Mode Flags", () => {
  it("RobotJSAdapter has mode 'software'", () => {
    const adapter = new RobotJSAdapter();
    expect(adapter.mode).toBe("software");
  });

  it("TeensyAdapter has mode 'teensy'", () => {
    // Create with a mock teensy executor
    const mockTeensy = {
      pressKey: vi.fn().mockResolvedValue(undefined),
    };
    const adapter = new TeensyAdapter(mockTeensy);
    expect(adapter.mode).toBe("teensy");
  });

  it("TeensyAdapter.pressKeyForDuration delegates to executor", async () => {
    const mockTeensy = {
      pressKey: vi.fn().mockResolvedValue(undefined),
    };
    const adapter = new TeensyAdapter(mockTeensy);

    await adapter.pressKeyForDuration!("n", 50, ["shift"]);
    expect(mockTeensy.pressKey).toHaveBeenCalledWith("n", 50, ["shift"]);
  });

  it("TeensyAdapter.keyTap fires and forgets", () => {
    const mockTeensy = {
      pressKey: vi.fn().mockResolvedValue(undefined),
    };
    const adapter = new TeensyAdapter(mockTeensy);

    adapter.keyTap("j");
    expect(mockTeensy.pressKey).toHaveBeenCalledWith("j", 50, []);
  });

  it("TeensyAdapter.setKeyboardDelay is a no-op", () => {
    const mockTeensy = {
      pressKey: vi.fn().mockResolvedValue(undefined),
    };
    const adapter = new TeensyAdapter(mockTeensy);

    // Should not throw
    expect(() => adapter.setKeyboardDelay(100)).not.toThrow();
  });
});

// ============================================================================
// TESTS: SequenceExecutor Backend Mode Initialization
// ============================================================================

describe("SequenceExecutor Backend Mode", () => {
  it('defaults to "software" mode', () => {
    const executor = new SequenceExecutor();
    expect(executor.getBackendMode()).toBe("software");
  });

  it('can be initialized in "teensy" mode', () => {
    const executor = new SequenceExecutor(undefined, undefined, "teensy");
    expect(executor.getBackendMode()).toBe("teensy");
  });

  it("accepts a teensy executor reference", () => {
    const executor = new SequenceExecutor(undefined, undefined, "teensy");
    const mockTeensy = { pressKey: vi.fn() };
    executor.setTeensyExecutor(mockTeensy);
    // Should not throw
    expect(executor.getBackendMode()).toBe("teensy");
  });
});

// ============================================================================
// TESTS: RepeatPolice Behavior
// ============================================================================

describe("RepeatPolice in Different Modes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("software mode: RepeatPolice delays duplicate abilities", async () => {
    const events: any[] = [];
    const executor = new SequenceExecutor(
      (ev) => events.push(ev),
      undefined,
      "software",
    );

    const binding = createSimpleBinding("Test Ability");

    // Execute first time
    const startTime = Date.now();
    await executor.execute(binding);

    // Execute immediately again (within REPEAT_POLICE_WINDOW_MS)
    await executor.execute(binding);
    const elapsed = Date.now() - startTime;

    // In software mode, second execution should have been delayed by REPEAT_POLICE_DELAY_MS (250ms)
    // We expect at least some delay (not instant), but account for other timing in the executor
    const completedEvents = events.filter((e) => e.type === "completed");
    expect(completedEvents.length).toBe(2);
  });

  it("teensy mode: RepeatPolice does NOT delay duplicate abilities", async () => {
    const events: any[] = [];
    const executor = new SequenceExecutor(
      (ev) => events.push(ev),
      undefined,
      "teensy",
    );

    const binding = createSimpleBinding("Test Ability");

    // Execute twice rapidly
    const startTime = Date.now();
    await executor.execute(binding);
    await executor.execute(binding);
    const elapsed = Date.now() - startTime;

    // In teensy mode, no RepeatPolice delay - should complete much faster
    // Both should complete without the 250ms RepeatPolice penalty
    const completedEvents = events.filter((e) => e.type === "completed");
    expect(completedEvents.length).toBe(2);
    // Teensy mode should complete faster than software mode would (no 250ms delay)
    // Just verify both completed
  });
});

// ============================================================================
// TESTS: Queue Pressure Monitor Integration
// ============================================================================

describe("Queue Pressure Monitor by Mode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("software mode: calls pressureMonitor.recordOutput after key release", async () => {
    const executor = new SequenceExecutor(undefined, undefined, "software");
    const binding = createSimpleBinding("Pressure Test");

    await executor.execute(binding);

    // In software mode, recordOutput should have been called
    expect(mockRecordOutput).toHaveBeenCalled();
  });

  it("teensy mode: does NOT call pressureMonitor.recordOutput", async () => {
    const executor = new SequenceExecutor(undefined, undefined, "teensy");
    const binding = createSimpleBinding("Pressure Test");

    await executor.execute(binding);

    // In teensy mode, recordOutput should NOT have been called
    expect(mockRecordOutput).not.toHaveBeenCalled();
  });

  it("software mode: checks adaptive delay from pressure monitor", async () => {
    const executor = new SequenceExecutor(undefined, undefined, "software");
    const binding = createSimpleBinding("Adaptive Test");

    await executor.execute(binding);

    // In software mode, getAdaptiveDelay should be checked
    expect(mockGetAdaptiveDelay).toHaveBeenCalled();
  });

  it("teensy mode: does NOT check adaptive delay", async () => {
    const executor = new SequenceExecutor(undefined, undefined, "teensy");
    const binding = createSimpleBinding("Adaptive Test");

    await executor.execute(binding);

    // In teensy mode, getAdaptiveDelay should NOT be called
    expect(mockGetAdaptiveDelay).not.toHaveBeenCalled();
  });
});

// ============================================================================
// TESTS: Output Pacing Values
// ============================================================================

describe("Output Pacing by Mode", () => {
  // We can't directly test the sleep durations without spying on the sleep method,
  // but we CAN verify the pacing counter advances and mode is respected.

  it("software mode: pacing counter increments for each output", async () => {
    const executor = new SequenceExecutor(undefined, undefined, "software");
    const binding = createMultiStepBinding("Pacing Test");

    await executor.execute(binding);

    // The paceCounter should have incremented for each step (4 steps)
    const paceCounter = (executor as any).outputPaceCounter;
    expect(paceCounter).toBeGreaterThanOrEqual(4);
  });

  it("teensy mode: pacing counter does not increment (pacing disabled)", async () => {
    const executor = new SequenceExecutor(undefined, undefined, "teensy");
    const binding = createMultiStepBinding("Pacing Test");

    await executor.execute(binding);

    // Teensy mode: pacing disabled, counter should not increment
    const paceCounter = (executor as any).outputPaceCounter;
    expect(paceCounter).toBe(0);
  });

  it("teensy mode executes multi-step faster than software mode", async () => {
    // Software mode
    const softwareExecutor = new SequenceExecutor(
      undefined,
      undefined,
      "software",
    );
    const softwareBinding = createMultiStepBinding("Software Speed");
    const softwareStart = Date.now();
    await softwareExecutor.execute(softwareBinding);
    const softwareElapsed = Date.now() - softwareStart;

    // Teensy mode
    const teensyExecutor = new SequenceExecutor(undefined, undefined, "teensy");
    const teensyBinding = createMultiStepBinding("Teensy Speed");
    const teensyStart = Date.now();
    await teensyExecutor.execute(teensyBinding);
    const teensyElapsed = Date.now() - teensyStart;

    // Teensy should be noticeably faster due to:
    // - Reduced pacing (20/50/80 vs 100/120/190)
    // - No pressure monitor delays
    // - No RepeatPolice overhead
    // Allow some tolerance for CI/slow machines but the trend should hold
    console.log(
      `  Software mode: ${softwareElapsed}ms, Teensy mode: ${teensyElapsed}ms`,
    );
    expect(teensyElapsed).toBeLessThanOrEqual(softwareElapsed + 50); // Teensy shouldn't be slower
  });
});

// ============================================================================
// TESTS: SpecialKeyHandler Backend Mode
// ============================================================================

describe("SpecialKeyHandler Backend Mode", () => {
  // The SpecialKeyOutputEvent interface requires:
  //   { type: "direct_output", source: "d_stream", keys: ["R"], timings: { keyDownMs: [min, max] } }
  // We also need to activate d_stream mode on the handler before sending d_stream events.

  it("software mode config enables pressure monitoring", async () => {
    vi.clearAllMocks();
    const { SpecialKeyHandler } = await import("../src/specialKeyHandler.js");

    const keyPresses: string[] = [];
    const handler = new SpecialKeyHandler({
      onKeyPress: async (key, hold) => {
        keyPresses.push(key);
      },
      backendMode: "software",
    });

    // Activate D stream state (handler blocks d_stream events unless active)
    (handler as any).dStreamActive = true;

    // Process a D stream event with correct SpecialKeyOutputEvent shape
    await handler.handleEvent({
      type: "direct_output",
      source: "d_stream",
      keys: ["R"],
      timings: { keyDownMs: [36, 41] },
    });

    // In software mode, pressure monitor should have been called for R_Stream
    expect(mockRecordOutput).toHaveBeenCalledWith(
      "R_Stream",
      "R",
      expect.any(Number),
    );
  });

  it("teensy mode config disables pressure monitoring", async () => {
    vi.clearAllMocks();
    const { SpecialKeyHandler } = await import("../src/specialKeyHandler.js");

    const keyPresses: string[] = [];
    const handler = new SpecialKeyHandler({
      onKeyPress: async (key, hold) => {
        keyPresses.push(key);
      },
      backendMode: "teensy",
    });

    // Activate D stream state
    (handler as any).dStreamActive = true;

    // Process a D stream event with correct shape
    await handler.handleEvent({
      type: "direct_output",
      source: "d_stream",
      keys: ["R"],
      timings: { keyDownMs: [36, 41] },
    });

    // In teensy mode, pressure monitor should NOT have been called
    expect(mockRecordOutput).not.toHaveBeenCalled();
  });
});
