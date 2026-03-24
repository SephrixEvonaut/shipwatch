import { test } from "vitest";
import { GestureDetector } from "../src/gestureDetector.js";
import { DEFAULT_GESTURE_SETTINGS } from "../src/profileLoader.js";

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runTest() {
  const settings = { ...DEFAULT_GESTURE_SETTINGS };
  const detector = new GestureDetector(settings, (event) => {
    // noop - replaced per-test
  });

  // Helper to run a single check
  const expectGesture = (
    key: string,
    actions: Array<{ type: "down" | "up"; delay: number }>,
    expected: string,
    timeout = 5000 // Increased timeout for longer hold durations
  ) => {
    return new Promise<void>((resolve, reject) => {
      const events: any[] = [];

      const collector = (ev: any) => {
        events.push(ev);
        if (ev.gesture === expected) {
          (detector as any).offGesture?.(collector);
          resolve();
        }
      };

      // temporarily subscribe to emissions
      (detector as any).onGesture?.(collector);

      // schedule actions relative to now
      let t = 0;
      for (const a of actions) {
        t += a.delay;
        if (a.type === "down") {
          setTimeout(() => detector.handleKeyDown(key), t);
        } else {
          setTimeout(() => detector.handleKeyUp(key), t);
        }
      }

      // timeout
      setTimeout(() => {
        (detector as any).offGesture?.(collector);
        reject(
          new Error(
            `Timeout waiting for gesture ${expected}. Got: ${events
              .map((e) => e.gesture)
              .join(",")}`
          )
        );
      }, timeout);
    });
  };

  // ============================================================================
  // PRODUCTION TIMING PARAMETERS
  // ============================================================================
  // From gesture-manifest.yaml / swtor-vengeance-jugg.json:
  //   multiPressWindow: 355ms  (initial window for multi-tap detection)
  //   longPressMin: 520ms      (minimum hold for long press)
  //   longPressMax: 860ms      (maximum hold for long press)
  //   superLongMin: 861ms      (minimum hold for super long press)
  //   superLongMax: 1300ms     (maximum hold for super long press)
  //   cancelThreshold: 1301ms  (hold longer = cancel gesture)
  //
  // Extension window: ~285ms (80% of multiPressWindow)
  // ============================================================================

  const short = 50; // <520ms hold = normal press
  const longHold = 650; // 520-860ms = long press (middle of range)
  const superHold = 1000; // 861-1300ms = super long press (middle of range)
  const gap = 100; // Gap between presses (comfortable, within 355ms window)

  // Wait times between tests (allow gesture to fully resolve + some buffer)
  const waitAfterNormal = 500; // Wait for window to expire after normal presses
  const waitAfterLong = 300; // Less wait needed after long (already waited during hold)
  const waitAfterSuper = 300; // Less wait needed after super long

  // ============================================================================
  // SINGLE PRESS TESTS
  // ============================================================================

  await expectGesture(
    "1",
    [
      { type: "down", delay: 0 },
      { type: "up", delay: short },
    ],
    "single"
  );
  await wait(waitAfterNormal);

  await expectGesture(
    "2",
    [
      { type: "down", delay: 0 },
      { type: "up", delay: longHold },
    ],
    "single_long"
  );
  await wait(waitAfterLong);

  await expectGesture(
    "3",
    [
      { type: "down", delay: 0 },
      { type: "up", delay: superHold },
    ],
    "single_super_long"
  );
  await wait(waitAfterSuper);

  // ============================================================================
  // DOUBLE PRESS TESTS
  // ============================================================================

  await expectGesture(
    "4",
    [
      { type: "down", delay: 0 },
      { type: "up", delay: short },
      { type: "down", delay: gap },
      { type: "up", delay: short },
    ],
    "double"
  );
  await wait(waitAfterNormal);

  await expectGesture(
    "5",
    [
      { type: "down", delay: 0 },
      { type: "up", delay: short },
      { type: "down", delay: gap },
      { type: "up", delay: longHold },
    ],
    "double_long"
  );
  await wait(waitAfterLong);

  await expectGesture(
    "6",
    [
      { type: "down", delay: 0 },
      { type: "up", delay: short },
      { type: "down", delay: gap },
      { type: "up", delay: superHold },
    ],
    "double_super_long"
  );
  await wait(waitAfterSuper);

  // ============================================================================
  // TRIPLE PRESS TESTS
  // ============================================================================

  await expectGesture(
    "W",
    [
      { type: "down", delay: 0 },
      { type: "up", delay: short },
      { type: "down", delay: gap },
      { type: "up", delay: short },
      { type: "down", delay: gap },
      { type: "up", delay: short },
    ],
    "triple"
  );
  await wait(waitAfterNormal);

  await expectGesture(
    "A",
    [
      { type: "down", delay: 0 },
      { type: "up", delay: short },
      { type: "down", delay: gap },
      { type: "up", delay: short },
      { type: "down", delay: gap },
      { type: "up", delay: longHold },
    ],
    "triple_long"
  );
  await wait(waitAfterLong);

  await expectGesture(
    "S",
    [
      { type: "down", delay: 0 },
      { type: "up", delay: short },
      { type: "down", delay: gap },
      { type: "up", delay: short },
      { type: "down", delay: gap },
      { type: "up", delay: superHold },
    ],
    "triple_super_long"
  );
  await wait(waitAfterSuper);

  // ============================================================================
  // QUADRUPLE PRESS TESTS
  // ============================================================================

  await expectGesture(
    "D",
    [
      { type: "down", delay: 0 },
      { type: "up", delay: short },
      { type: "down", delay: gap },
      { type: "up", delay: short },
      { type: "down", delay: gap },
      { type: "up", delay: short },
      { type: "down", delay: gap },
      { type: "up", delay: short },
    ],
    "quadruple"
  );
  await wait(waitAfterNormal);

  await expectGesture(
    "B",
    [
      { type: "down", delay: 0 },
      { type: "up", delay: short },
      { type: "down", delay: gap },
      { type: "up", delay: short },
      { type: "down", delay: gap },
      { type: "up", delay: short },
      { type: "down", delay: gap },
      { type: "up", delay: longHold },
    ],
    "quadruple_long"
  );
  await wait(waitAfterLong);

  await expectGesture(
    "C",
    [
      { type: "down", delay: 0 },
      { type: "up", delay: short },
      { type: "down", delay: gap },
      { type: "up", delay: short },
      { type: "down", delay: gap },
      { type: "up", delay: short },
      { type: "down", delay: gap },
      { type: "up", delay: superHold },
    ],
    "quadruple_super_long"
  );

  console.log("All gesture mapping tests passed.");
}

test("gesture mapping matches expected gestures", async () => {
  await runTest();
}, 60000); // 60 second timeout for all tests (long holds take time)
