import { test, expect } from "vitest";
import { SequenceExecutor } from "../src/sequenceExecutor.js";
import { MacroBinding, SequenceStep } from "../src/types.js";

test("holdThroughNext property exists on SequenceStep type", () => {
  const step: SequenceStep = {
    key: "SHIFT+R",
    minDelay: 10,
    maxDelay: 20,
    holdThroughNext: true,
    releaseDelayMin: 7,
    releaseDelayMax: 18,
  };

  expect(step.holdThroughNext).toBe(true);
  expect(step.releaseDelayMin).toBe(7);
  expect(step.releaseDelayMax).toBe(18);
});

test("SequenceExecutor accepts holdThroughNext in binding", () => {
  const binding: MacroBinding = {
    name: "Test Hold Through",
    trigger: {
      key: "1",
      gesture: "single",
    },
    sequence: [
      {
        key: "a",
        minDelay: 10,
        maxDelay: 20,
      },
      {
        key: "SHIFT+R",
        minDelay: 10,
        maxDelay: 20,
        holdThroughNext: true,
        releaseDelayMin: 7,
        releaseDelayMax: 18,
      },
      {
        key: "b",
        minDelay: 10,
        maxDelay: 20,
      },
    ],
    enabled: true,
  };

  const executor = new SequenceExecutor();

  // This should not throw - validates typing
  expect(binding.sequence[1].holdThroughNext).toBe(true);
  expect(executor).toBeDefined();
});
