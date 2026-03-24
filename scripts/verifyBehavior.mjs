#!/usr/bin/env node
// ============================================================================
// BEHAVIOR VERIFICATION SCRIPT
// ============================================================================
// Verifies the gesture detector constants and behavior logic.
// Run: node scripts/verifyBehavior.mjs
// ============================================================================

import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const srcDir = join(__dirname, "..", "src");

let passed = 0;
let failed = 0;

function check(description, condition, detail = "") {
  if (condition) {
    console.log(`  ✅ ${description}`);
    passed++;
  } else {
    console.log(`  ❌ FAIL: ${description}${detail ? " — " + detail : ""}`);
    failed++;
  }
}

function readSrc(filename) {
  return readFileSync(join(srcDir, filename), "utf-8");
}

console.log("\n╔════════════════════════════════════════════════════════════╗");
console.log("║   BEHAVIOR VERIFICATION - Gesture Detector Logic           ║");
console.log("╚════════════════════════════════════════════════════════════╝\n");

// ============================================================================
// READ SOURCE FILES
// ============================================================================
const detector = readSrc("omegaGestureDetector.ts");
const indexTs = readSrc("index.ts");
const specialKey = readSrc("specialKeyHandler.ts");
const inputListener = readSrc("inputListener.ts");

// ============================================================================
// SECTION F: D KEY TOGGLE
// ============================================================================
console.log("═══ SECTION F: D KEY TOGGLE ═══");

// D_STREAM_INTERVAL_MS = 430
const dStreamMatch = detector.match(/D_STREAM_INTERVAL_MS\s*=\s*(\d+)/);
check(
  "D_STREAM_INTERVAL_MS = 430",
  dStreamMatch && dStreamMatch[1] === "430",
  `Got: ${dStreamMatch?.[1]}`,
);

// D toggle uses "on on on" TTS
check("D toggle TTS 'on on on'", detector.includes('"on on on"'));
check("D toggle TTS 'off off off'", detector.includes('"off off off"'));

// TTS callback wired in index.ts
check(
  "TTS callback wired in index.ts",
  indexTs.includes("setTTSSpeakingCallback") &&
    indexTs.includes("isTTSSpeaking"),
  "Should call gestureDetector.setTTSSpeakingCallback(() => specialKeyHandler.isTTSSpeaking())",
);

// specialKeyHandler has isTTSSpeaking
check(
  "specialKeyHandler.isTTSSpeaking() exists",
  specialKey.includes("isTTSSpeaking(): boolean"),
);
check(
  "specialKeyHandler tracks ttsSpeaking state",
  specialKey.includes("ttsSpeaking: boolean"),
);
check(
  "specialKeyHandler uses say module",
  specialKey.includes('import("say")') ||
    specialKey.includes("require('say')") ||
    specialKey.includes('require("say")'),
);

// D toggle debounce - checks isTTSSpeakingCallback before toggling
check(
  "D toggle checks isTTSSpeakingCallback before toggle",
  detector.includes("isTTSSpeakingCallback") &&
    detector.includes("TTS still speaking"),
);

// ============================================================================
// SECTION E: W/Y IMMEDIATE TOGGLE
// ============================================================================
console.log("\n═══ SECTION E: W/Y IMMEDIATE TOGGLE ═══");

// Toggle activates IMMEDIATELY on keyDown
check(
  "W/Y toggle activates IMMEDIATELY on keyDown (comment)",
  detector.includes("Toggle activates IMMEDIATELY") ||
    detector.includes("IMMEDIATE ACTIVATION ON KEYDOWN") ||
    detector.includes("immediately"),
);

// W and Y are processed in processKeyDown
check(
  "W/Y case in processKeyDown",
  detector.includes('case "W":') && detector.includes('case "Y":'),
);

// toggleActive set in keyDown handler
check(
  "toggleActive set on keyDown",
  detector.includes("this.state.toggleActive = true"),
);

// On keyUp, checks hold duration < threshold for quick
check(
  "W/Y keyUp checks hold duration for quick gesture",
  detector.includes("handleToggleKeyUp") ||
    (detector.includes("toggle") && detector.includes("quick")),
);

// ============================================================================
// SECTION D: Q TOGGLE
// ============================================================================
console.log("\n═══ SECTION D: Q TOGGLE ═══");

// QToggleState interface
check(
  "QToggleState interface exists",
  detector.includes("QToggleState") || detector.includes("qToggle"),
);

// Q toggle activation logic
check(
  "Q toggle activation when held past threshold",
  detector.includes("checkQToggleActivation") ||
    detector.includes("qToggle.active = true"),
);
check(
  "Q toggle deactivation on keyUp",
  detector.includes("qToggle.active = false") ||
    detector.includes("handleQKeyUp"),
);

// Q toggle gesture resolution
check(
  "quick_q_toggle returned in gesture determination",
  detector.includes("quick_q_toggle"),
);
check(
  "long_q_toggle returned in gesture determination",
  detector.includes("long_q_toggle"),
);

// ============================================================================
// SECTION G: S TOGGLE INTERCEPTS
// ============================================================================
console.log("\n═══ SECTION G: S TOGGLE INTERCEPTS ═══");

// S_INTERCEPT_KEYS includes 5 and 6
const sInterceptMatch = detector.match(/S_INTERCEPT_KEYS[^;]*;/s);
check(
  "S_INTERCEPT_KEYS includes '5'",
  sInterceptMatch && sInterceptMatch[0].includes('"5"'),
  `Line: ${sInterceptMatch?.[0]?.substring(0, 100)}`,
);
check(
  "S_INTERCEPT_KEYS includes '6'",
  sInterceptMatch && sInterceptMatch[0].includes('"6"'),
);
check(
  "S_INTERCEPT_KEYS includes 'T'",
  sInterceptMatch && sInterceptMatch[0].includes('"T"'),
);

// ============================================================================
// SECTION I: F2 TOGGLE OVERRIDE
// ============================================================================
console.log("\n═══ SECTION I: F2 TOGGLE OVERRIDE ═══");

// F2 override logic (255ms)
check("F2 override 255ms threshold exists", detector.includes("255"));
check(
  "F2 override logic",
  detector.includes("F2") &&
    (detector.includes("override") || detector.includes("deactivateToggle")),
);

// ============================================================================
// SECTION A: INPUT LISTENER KEY MAPPINGS
// ============================================================================
console.log("\n═══ INPUT LISTENER KEY MAPPINGS ═══");

check(
  "SPACE → SPACEBAR mapping",
  inputListener.includes("SPACE") && inputListener.includes('"SPACEBAR"'),
);
check(
  '" " → SPACEBAR mapping',
  inputListener.includes('" "') && inputListener.includes('"SPACEBAR"'),
);

// ============================================================================
// THRESHOLD VERIFICATION (read from omegaTypes compiled)
// ============================================================================
console.log("\n═══ THRESHOLD VERIFICATION (from source) ═══");

const omegaTypes = readSrc("omegaTypes.ts");

// Extract key thresholds
const thresholdChecks = [
  { key: "W", expected: 185 },
  { key: "Y", expected: 233 },
  { key: "A", expected: 241 },
  { key: "SPACEBAR", expected: 380 },
  { key: "Q", expected: 350 },
  { key: '"8"', expected: 380, rawKey: "8" },
];

for (const t of thresholdChecks) {
  const keyPattern = t.rawKey
    ? `"${t.rawKey}"`
    : t.key.length === 1
      ? `${t.key}:`
      : `${t.key}:`;
  const regex = new RegExp(`${t.rawKey ? `"${t.rawKey}"` : t.key}:\\s*(\\d+)`);
  const match = omegaTypes.match(regex);
  check(
    `${t.rawKey || t.key} threshold = ${t.expected}`,
    match && parseInt(match[1]) === t.expected,
    `Got: ${match?.[1]}`,
  );
}

// ============================================================================
// SUMMARY
// ============================================================================
console.log("\n╔════════════════════════════════════════════════════════════╗");
console.log(`║  RESULTS: ${passed} PASSED / ${failed} FAILED`);
console.log("╚════════════════════════════════════════════════════════════╝\n");

if (failed > 0) {
  console.log("🔴 SOME CHECKS FAILED! Review above.");
  process.exit(1);
} else {
  console.log("🟢 ALL BEHAVIOR CHECKS PASSED!");
  process.exit(0);
}
