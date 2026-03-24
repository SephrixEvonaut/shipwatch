#!/usr/bin/env node
/**
 * Timing Calibration Tool
 *
 * Press keys and this will show you EXACTLY how long you're holding them
 * and what gap you leave between presses. Use this to find YOUR natural timing.
 *
 * Run: node scripts/timingCalibration.mjs
 */

import { GlobalKeyboardListener } from "node-global-key-listener";

const listener = new GlobalKeyboardListener();

// Track state per key
const keyState = new Map(); // key -> { downTime, lastUpTime, pressCount }

// Current gesture settings (TRIPLED - updated 2026-01-12)
const CURRENT_SETTINGS = {
  normalMax: 239, // < 240ms = normal (was <80ms)
  longMin: 240,
  longMax: 435, // 240-435ms = long (195ms window) - was 80-145
  superLongMin: 436,
  superLongMax: 795, // 436-795ms = super_long (359ms window) - was 146-265
  cancelThreshold: 796,
  multiPressWindow: 240, // was 80
  windowExtension: 150, // was 50
};

console.log(
  "\n╔═══════════════════════════════════════════════════════════════╗"
);
console.log(
  "║           TIMING CALIBRATION TOOL (3x TIMINGS)                ║"
);
console.log(
  "╠═══════════════════════════════════════════════════════════════╣"
);
console.log("║  Press and HOLD keys to see your natural timing              ║");
console.log(
  "║  This helps calibrate gesture thresholds                      ║"
);
console.log(
  "║                                                               ║"
);
console.log(
  "║  NEW SETTINGS (tripled from original):                        ║"
);
console.log(
  "║    Normal:     < 240ms                                        ║"
);
console.log(
  "║    Long:       240-435ms  (195ms window)                      ║"
);
console.log(
  "║    Super Long: 436-795ms  (359ms window)                      ║"
);
console.log(
  "║    Cancel:     > 795ms                                        ║"
);
console.log(
  "║    Multi-press gap: 240ms initial + 150ms/press               ║"
);
console.log(
  "║                                                               ║"
);
console.log(
  "║  Press Ctrl+C to exit                                         ║"
);
console.log(
  "╚═══════════════════════════════════════════════════════════════╝\n"
);

function classifyHold(durationMs) {
  if (durationMs < CURRENT_SETTINGS.longMin) {
    return { type: "NORMAL", color: "\x1b[32m", status: "✓" }; // green
  } else if (durationMs <= CURRENT_SETTINGS.longMax) {
    return { type: "LONG", color: "\x1b[33m", status: "✓" }; // yellow
  } else if (durationMs <= CURRENT_SETTINGS.superLongMax) {
    return { type: "SUPER_LONG", color: "\x1b[35m", status: "✓" }; // magenta
  } else {
    return { type: "CANCELLED", color: "\x1b[31m", status: "✗" }; // red
  }
}

function formatMs(ms) {
  return ms.toFixed(0).padStart(4) + "ms";
}

listener.addListener((e) => {
  const key = e.name;
  const now = Date.now();

  // Skip modifier keys and some special keys for cleaner output
  if (
    [
      "LEFT CTRL",
      "RIGHT CTRL",
      "LEFT SHIFT",
      "RIGHT SHIFT",
      "LEFT ALT",
      "RIGHT ALT",
      "LEFT META",
      "RIGHT META",
    ].includes(key)
  ) {
    return;
  }

  if (e.state === "DOWN") {
    let state = keyState.get(key);

    if (!state) {
      state = { downTime: null, lastUpTime: null, pressCount: 0 };
      keyState.set(key, state);
    }

    // Only register if this is a fresh press (not key repeat)
    if (state.downTime === null) {
      const gap = state.lastUpTime ? now - state.lastUpTime : null;
      state.downTime = now;
      state.pressCount++;

      let gapInfo = "";
      if (gap !== null) {
        const gapStatus =
          gap <=
          CURRENT_SETTINGS.multiPressWindow +
            (state.pressCount - 1) * CURRENT_SETTINGS.windowExtension
            ? "\x1b[32m✓ within window\x1b[0m"
            : "\x1b[31m✗ too slow (new gesture)\x1b[0m";
        gapInfo = ` | Gap: ${formatMs(gap)} ${gapStatus}`;
      }

      console.log(
        `\x1b[36m[${key}]\x1b[0m ⬇ DOWN  #${state.pressCount}${gapInfo}`
      );
    }
  } else if (e.state === "UP") {
    const state = keyState.get(key);

    if (state && state.downTime !== null) {
      const holdDuration = now - state.downTime;
      const classification = classifyHold(holdDuration);

      console.log(
        `\x1b[36m[${key}]\x1b[0m ⬆ UP    #${state.pressCount} | ` +
          `Hold: ${formatMs(holdDuration)} → ${classification.color}${
            classification.type
          }\x1b[0m ${classification.status}`
      );

      // Show suggestion if cancelled
      if (classification.type === "CANCELLED") {
        const suggestedMax = Math.ceil(holdDuration * 1.1); // 10% buffer
        console.log(
          `       💡 Suggestion: Set superLongMax to at least ${suggestedMax}ms`
        );
      }

      state.lastUpTime = now;
      state.downTime = null;
    }
  }
});

// Reset gesture tracking after 2 seconds of no activity
setInterval(() => {
  const now = Date.now();
  for (const [key, state] of keyState.entries()) {
    if (
      state.lastUpTime &&
      now - state.lastUpTime > 2000 &&
      state.pressCount > 0
    ) {
      console.log(
        `\x1b[90m[${key}] Reset after ${state.pressCount} presses\x1b[0m`
      );
      state.pressCount = 0;
    }
  }
}, 500);

console.log("🎧 Listening for key presses...\n");
console.log("Try these exercises:");
console.log("  1. TAP a key quickly (aim for normal)");
console.log(
  "  2. HOLD a key briefly (aim for long - should feel like a deliberate pause)"
);
console.log(
  "  3. HOLD longer (aim for super_long - should feel like you're waiting)"
);
console.log("  4. Double-tap at your natural speed (watch the gap timing)");
console.log("");
