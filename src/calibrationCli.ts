// ============================================================================
// CALIBRATION CLI - Interactive calibration wizard using real input listener
// ============================================================================
//
// This version uses the actual inputListener (node-global-key-listener) to
// capture real keydown/keyup timing, which is essential for accurate calibration.
//
// ============================================================================

import * as readline from "readline";
import { WebSocket } from "ws";
import { writeFileSync, readFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { performance } from "perf_hooks";
import { InputListener, KeyEvent } from "./inputListener.js";
import {
  InputKey,
  GestureSettings,
  INPUT_KEYS,
  KeyProfile,
  CalibrationStep,
  CalibrationConfig,
  CalibratedMacroProfile,
  CalculatedThresholds,
  CALIBRATION_STEPS,
  STEP_NAMES,
  STEP_INSTRUCTIONS,
  DEFAULT_CALIBRATION_CONFIG,
  getSpecialKeyConfig,
} from "./calibrationTypes.js";
import {
  CalibrationManager,
  getCalibrationManager,
  calculateStatistics,
} from "./calibrationManager.js";

// ============================================================================
// ANSI COLOR CODES
// ============================================================================

const COLORS = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  white: "\x1b[37m",
};

function colorize(text: string, color: keyof typeof COLORS): string {
  return `${COLORS[color]}${text}${COLORS.reset}`;
}

function progressBar(
  current: number,
  total: number,
  width: number = 40,
): string {
  const filled = Math.round((current / total) * width);
  const empty = width - filled;
  const bar = "█".repeat(filled) + "░".repeat(empty);
  return `[${bar}] ${current}/${total}`;
}

// ============================================================================
// CALIBRATION CLI CLASS
// ============================================================================

export class CalibrationCLI {
  private rl: readline.Interface;
  private manager: CalibrationManager;
  private config: CalibrationConfig;
  private inputListener: InputListener | null = null;

  // Key timing state
  private keyDownTimes: Map<string, number> = new Map();
  private lastKeyUpTime: number | null = null;
  private multiTapGaps: number[] = [];
  private stepData: number[] = [];
  private currentStep: CalibrationStep = "single_tap";
  private currentKey: InputKey | null = null;
  private samplesCollected: number = 0;
  private samplesNeeded: number = 10;
  private resolveWaitForSamples: (() => void) | null = null;

  constructor(config: Partial<CalibrationConfig> = {}) {
    this.config = { ...DEFAULT_CALIBRATION_CONFIG, ...config };
    this.manager = getCalibrationManager();

    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
  }

  // ============================================================================
  // INPUT LISTENER INTEGRATION
  // ============================================================================

  private startInputListener(): void {
    if (this.inputListener) return;

    this.inputListener = new InputListener((event) => {
      if ("key" in event) {
        this.handleKeyEvent(event as KeyEvent);
      }
    });

    this.inputListener.start();
    console.log(
      colorize("✓ Input listener started - press keys to calibrate", "green"),
    );
  }

  private stopInputListener(): void {
    if (this.inputListener) {
      this.inputListener.stop();
      this.inputListener = null;
    }
  }

  private handleKeyEvent(event: KeyEvent): void {
    const key = event.key.toUpperCase();
    const now = performance.now();

    // Only process the key we're calibrating
    if (this.currentKey && key !== this.currentKey) {
      return;
    }

    if (event.type === "down") {
      // Key pressed down
      if (!this.keyDownTimes.has(key)) {
        this.keyDownTimes.set(key, now);

        // For multi-tap, record gap from last key up
        if (
          (this.currentStep === "double_tap" ||
            this.currentStep === "triple_tap" ||
            this.currentStep === "quadruple_tap") &&
          this.lastKeyUpTime !== null
        ) {
          const gap = now - this.lastKeyUpTime;
          if (gap < 500) {
            // Only count gaps under 500ms as intentional multi-taps
            this.multiTapGaps.push(gap);
          } else {
            // Reset - too long between taps
            this.multiTapGaps = [];
          }
        }
      }
    } else if (event.type === "up") {
      // Key released
      const downTime = this.keyDownTimes.get(key);
      if (downTime !== undefined) {
        const duration = now - downTime;
        this.keyDownTimes.delete(key);
        this.lastKeyUpTime = now;

        this.processKeyRelease(key as InputKey, duration);
      }
    }
  }

  private processKeyRelease(key: InputKey, duration: number): void {
    const step = this.currentStep;

    if (
      step === "single_tap" ||
      step === "long_hold" ||
      step === "super_long_hold"
    ) {
      // Record the hold duration
      this.stepData.push(duration);
      this.samplesCollected++;

      // Show feedback
      const status = this.validateSample(duration, step)
        ? colorize("✓", "green")
        : colorize("⚠", "yellow");
      console.log(
        `  Sample ${this.samplesCollected}: ${Math.round(duration)}ms ${status}`,
      );

      // Check if we have enough samples
      if (
        this.samplesCollected >= this.samplesNeeded &&
        this.resolveWaitForSamples
      ) {
        this.resolveWaitForSamples();
      }
    } else if (step === "double_tap") {
      // Need 1 gap for double tap
      if (this.multiTapGaps.length >= 1) {
        const gap = this.multiTapGaps[0];
        this.stepData.push(gap);
        this.samplesCollected++;

        console.log(
          `  Sample ${this.samplesCollected}: Gap ${Math.round(gap)}ms ${colorize("✓", "green")}`,
        );

        // Reset for next double-tap
        this.multiTapGaps = [];
        this.lastKeyUpTime = null;

        if (
          this.samplesCollected >= this.samplesNeeded &&
          this.resolveWaitForSamples
        ) {
          this.resolveWaitForSamples();
        }
      }
    } else if (step === "triple_tap") {
      // Need 2 gaps for triple tap
      if (this.multiTapGaps.length >= 2) {
        const gaps = this.multiTapGaps.slice(0, 2);
        this.stepData.push(...gaps);
        this.manager.recordTripleTapGaps(key, gaps);
        this.samplesCollected++;

        console.log(
          `  Sample ${this.samplesCollected}: Gaps [${gaps.map((g) => Math.round(g)).join(", ")}]ms ${colorize("✓", "green")}`,
        );

        this.multiTapGaps = [];
        this.lastKeyUpTime = null;

        if (
          this.samplesCollected >= this.samplesNeeded &&
          this.resolveWaitForSamples
        ) {
          this.resolveWaitForSamples();
        }
      }
    } else if (step === "quadruple_tap") {
      // Need 3 gaps for quadruple tap
      if (this.multiTapGaps.length >= 3) {
        const gaps = this.multiTapGaps.slice(0, 3);
        this.stepData.push(...gaps);
        this.manager.recordQuadrupleTapGaps(key, gaps);
        this.samplesCollected++;

        console.log(
          `  Sample ${this.samplesCollected}: Gaps [${gaps.map((g) => Math.round(g)).join(", ")}]ms ${colorize("✓", "green")}`,
        );

        this.multiTapGaps = [];
        this.lastKeyUpTime = null;

        if (
          this.samplesCollected >= this.samplesNeeded &&
          this.resolveWaitForSamples
        ) {
          this.resolveWaitForSamples();
        }
      }
    }
  }

  private validateSample(duration: number, step: CalibrationStep): boolean {
    switch (step) {
      case "single_tap":
        return duration < 200; // Quick tap should be under 200ms
      case "long_hold":
        return duration >= 300 && duration <= 900;
      case "super_long_hold":
        return duration >= 800 && duration <= 1500;
      default:
        return true;
    }
  }

  // ============================================================================
  // WIZARD FLOW
  // ============================================================================

  async run(): Promise<void> {
    console.log("\n" + "═".repeat(50));
    console.log(colorize("  Gesture Calibration Wizard", "cyan"));
    console.log("═".repeat(50));
    console.log("\nThis wizard will calibrate gesture detection thresholds");
    console.log("based on your unique finger timing patterns.\n");

    // Select keys to calibrate
    const keys = await this.selectKeys();

    if (keys.length === 0) {
      console.log("No keys selected. Exiting.");
      this.cleanup();
      return;
    }

    console.log(`\nCalibrating ${keys.length} key(s): ${keys.join(", ")}\n`);

    // Start the input listener
    this.startInputListener();

    // Give a moment for the listener to initialize
    await this.sleep(500);

    // Calibrate each key
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      console.log(`\n${"─".repeat(50)}`);
      console.log(
        colorize(`[${i + 1}/${keys.length}] Calibrating ${key} key`, "bright"),
      );
      console.log("─".repeat(50));

      await this.calibrateKey(key);
    }

    // Stop input listener
    this.stopInputListener();

    // Show results and offer to export
    await this.showResults(keys);

    this.cleanup();
  }

  private async selectKeys(): Promise<InputKey[]> {
    console.log("Select keys to calibrate:");
    console.log("  [1] All keys (24 keys)");
    console.log("  [2] Movement keys (W, A, S, D)");
    console.log("  [3] Number keys (1-9)");
    console.log("  [4] Custom selection");
    console.log("  [5] Single key (quick test)");

    const choice = await this.question("Choice [1-5]: ");

    switch (choice) {
      case "1":
        return [...INPUT_KEYS] as InputKey[];
      case "2":
        return ["W", "A", "S", "D"] as InputKey[];
      case "3":
        return ["1", "2", "3", "4", "5", "6", "7", "8", "9"] as InputKey[];
      case "4":
        const customInput = await this.question(
          "Enter keys (comma-separated, e.g., W,A,S,D,1,2): ",
        );
        return customInput
          .toUpperCase()
          .split(",")
          .map((k) => k.trim())
          .filter((k) =>
            (INPUT_KEYS as readonly string[]).includes(k),
          ) as InputKey[];
      case "5":
        const singleKey = await this.question(
          `Enter single key (${INPUT_KEYS.slice(0, 8).join(", ")}...): `,
        );
        const key = singleKey.toUpperCase().trim();
        if ((INPUT_KEYS as readonly string[]).includes(key)) {
          return [key as InputKey];
        }
        console.log("Invalid key. Using W.");
        return ["W"];
      default:
        return ["W", "A", "S", "D"] as InputKey[];
    }
  }

  private async calibrateKey(key: InputKey): Promise<void> {
    this.manager.startKeyCalibration(key);
    this.currentKey = key;

    // Check for special key configuration
    const specialConfig = getSpecialKeyConfig(key);

    // Determine which steps to run (exclude "complete" which is just a status)
    let stepsToRun: CalibrationStep[] = CALIBRATION_STEPS.filter(
      (s) => s !== "complete",
    );
    if (specialConfig?.skipMultiTap) {
      stepsToRun = stepsToRun.filter(
        (s) => !["double_tap", "triple_tap", "quadruple_tap"].includes(s),
      );
      console.log(
        colorize(
          `  Note: ${key} key uses single gestures only (skipping multi-tap)`,
          "yellow",
        ),
      );
    }

    // Run each calibration step
    for (let i = 0; i < stepsToRun.length; i++) {
      const step = stepsToRun[i];
      await this.runCalibrationStep(key, step, i + 1, stepsToRun.length);
    }

    // Analyze and show results for this key
    const thresholds = this.manager.analyzeKey(key);
    if (thresholds) {
      console.log(`\n${colorize("✓", "green")} ${key} calibration complete!`);
      console.log(`  Confidence: ${thresholds.confidence || 0}%`);
    }
  }

  private async runCalibrationStep(
    key: InputKey,
    step: CalibrationStep,
    stepNum: number,
    totalSteps: number,
  ): Promise<void> {
    // Reset state
    this.currentStep = step;
    this.stepData = [];
    this.multiTapGaps = [];
    this.samplesCollected = 0;
    this.lastKeyUpTime = null;
    this.keyDownTimes.clear();

    this.samplesNeeded = this.config.quickMode
      ? this.config.quickModeSamples
      : this.config.samplesPerStep;

    console.log(
      `\n${colorize(`Step ${stepNum}/${totalSteps}: ${STEP_NAMES[step]}`, "cyan")}`,
    );
    console.log(STEP_INSTRUCTIONS[step]);
    console.log(`Samples needed: ${this.samplesNeeded}\n`);

    // Wait for samples to be collected
    await this.waitForSamples();

    // Record the data to the manager
    this.recordStepData(key, step);

    // Show statistics
    if (this.stepData.length > 0) {
      const stats = calculateStatistics(this.stepData);
      console.log(
        `\n  ${colorize("Statistics:", "dim")} mean=${Math.round(stats.mean)}ms, ` +
          `stdDev=${Math.round(stats.stdDev)}ms, range=[${Math.round(stats.min)}-${Math.round(stats.max)}]ms`,
      );
    }

    await this.sleep(300);
  }

  private waitForSamples(): Promise<void> {
    return new Promise((resolve) => {
      this.resolveWaitForSamples = resolve;

      // Safety timeout (2 minutes max per step)
      setTimeout(() => {
        if (this.samplesCollected < this.samplesNeeded) {
          console.log(
            colorize(
              "\n  Timeout - moving to next step with partial data",
              "yellow",
            ),
          );
          resolve();
        }
      }, 120000);
    });
  }

  private recordStepData(key: InputKey, step: CalibrationStep): void {
    switch (step) {
      case "single_tap":
        for (const duration of this.stepData) {
          this.manager.recordSingleTap(key, duration);
        }
        break;
      case "long_hold":
        for (const duration of this.stepData) {
          this.manager.recordLongHold(key, duration);
        }
        break;
      case "super_long_hold":
        for (const duration of this.stepData) {
          this.manager.recordSuperLongHold(key, duration);
        }
        break;
      case "double_tap":
        for (const gap of this.stepData) {
          this.manager.recordDoubleTapGap(key, gap);
        }
        break;
      // triple_tap and quadruple_tap are recorded during collection
    }
  }

  private async showResults(keys: InputKey[]): Promise<void> {
    console.log("\n" + "═".repeat(50));
    console.log(colorize("  Calibration Results", "cyan"));
    console.log("═".repeat(50) + "\n");

    for (const key of keys) {
      const thresholds = this.manager.analyzeKey(key);
      if (thresholds) {
        console.log(`${colorize(key, "bright")}:`);
        console.log(`  multiPressWindow: ${thresholds.multiPressWindow}ms`);
        console.log(`  longPressMin: ${thresholds.longPressMin}ms`);
        console.log(`  longPressMax: ${thresholds.longPressMax}ms`);
        console.log(`  superLongMin: ${thresholds.superLongMin}ms`);
        console.log(`  superLongMax: ${thresholds.superLongMax}ms`);
        console.log(`  confidence: ${thresholds.confidence}%`);
        console.log();
      }
    }

    // Offer to export
    const exportChoice = await this.question(
      "Export calibrated profile? [Y/n]: ",
    );
    if (exportChoice.toLowerCase() !== "n") {
      await this.exportProfile();
    }
  }

  private async exportProfile(): Promise<void> {
    const defaultFilename = `calibrated-profile-${Date.now()}.json`;
    const filename =
      (await this.question(`Filename [${defaultFilename}]: `)) ||
      defaultFilename;

    const outputDir = "./profiles";
    if (!existsSync(outputDir)) {
      mkdirSync(outputDir, { recursive: true });
    }

    const outputPath = join(outputDir, filename);

    // Get default gesture settings
    const defaultSettings: GestureSettings = {
      multiPressWindow: 350,
      debounceDelay: 30,
      longPressMin: 520,
      longPressMax: 860,
      superLongMin: 861,
      superLongMax: 1300,
      cancelThreshold: 1301,
    };

    const profile = this.manager.exportProfiles(defaultSettings);

    writeFileSync(outputPath, JSON.stringify(profile, null, 2));
    console.log(colorize(`\n✓ Profile saved to ${outputPath}`, "green"));
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  private question(prompt: string): Promise<string> {
    return new Promise((resolve) => {
      this.rl.question(prompt, resolve);
    });
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private cleanup(): void {
    this.stopInputListener();
    this.rl.close();
  }
}

// ============================================================================
// HOT RELOAD MODE
// ============================================================================

async function runHotReloadMode(): Promise<void> {
  console.log("\n" + "═".repeat(50));
  console.log(colorize("  Hot Reload Mode", "cyan"));
  console.log("═".repeat(50));
  console.log("\nConnecting to calibration server at ws://localhost:8765...\n");

  const ws = new WebSocket("ws://localhost:8765");

  ws.on("open", () => {
    console.log(colorize("✓ Connected to calibration server", "green"));
    console.log("\nCommands:");
    console.log("  status          - Show current profiles");
    console.log("  test <key>      - Test gesture detection for a key");
    console.log("  history <key>   - Show recent gestures for a key");
    console.log("  export          - Export current profiles");
    console.log("  exit            - Disconnect and exit\n");

    // Start command loop
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const promptCommand = () => {
      rl.question("> ", (cmd) => {
        const parts = cmd.trim().split(" ");
        const command = parts[0].toLowerCase();
        const arg = parts[1]?.toUpperCase();

        switch (command) {
          case "status":
            ws.send(JSON.stringify({ type: "GET_ALL_PROFILES" }));
            break;
          case "test":
            if (arg) {
              ws.send(JSON.stringify({ type: "SUBSCRIBE_KEY", key: arg }));
              console.log(
                `Subscribed to ${arg} - gestures will be shown in real-time`,
              );
            } else {
              console.log("Usage: test <key>");
            }
            break;
          case "history":
            if (arg) {
              ws.send(
                JSON.stringify({ type: "GET_RECENT_GESTURES", key: arg }),
              );
            } else {
              console.log("Usage: history <key>");
            }
            break;
          case "export":
            ws.send(
              JSON.stringify({
                type: "EXPORT_PROFILE",
                filename: `hot-reload-export-${Date.now()}.json`,
              }),
            );
            break;
          case "exit":
          case "quit":
            ws.close();
            rl.close();
            process.exit(0);
            break;
          default:
            console.log(
              "Unknown command. Try: status, test, history, export, exit",
            );
        }

        promptCommand();
      });
    };

    promptCommand();
  });

  ws.on("message", (data) => {
    try {
      const msg = JSON.parse(data.toString());

      switch (msg.type) {
        case "GESTURE_DETECTED":
          console.log(
            `\n${colorize("⚡ Gesture:", "yellow")} ${msg.key} → ${msg.gesture}`,
          );
          break;
        case "ALL_PROFILES":
          console.log("\nCurrent profiles:");
          for (const [key, profile] of Object.entries(msg.profiles)) {
            console.log(
              `  ${key}: multiPressWindow=${(profile as any).multiPressWindow}ms`,
            );
          }
          break;
        case "RECENT_GESTURES":
          console.log(`\nRecent gestures for ${msg.key}:`);
          for (const g of msg.gestures.slice(-10)) {
            console.log(
              `  ${g.gesture} at ${new Date(g.timestamp).toLocaleTimeString()}`,
            );
          }
          break;
        case "EXPORT_COMPLETE":
          console.log(
            colorize(`\n✓ Profile exported to ${msg.filename}`, "green"),
          );
          break;
      }
    } catch (e) {
      // Ignore parse errors
    }
  });

  ws.on("error", (err) => {
    console.error(colorize("✗ Connection error:", "red"), err.message);
    console.log(
      "\nMake sure the main app is running with ENABLE_CALIBRATION_SERVER=true",
    );
    process.exit(1);
  });

  ws.on("close", () => {
    console.log("\nDisconnected from server");
    process.exit(0);
  });
}

// ============================================================================
// MAIN
// ============================================================================

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  // Check for hot-reload mode
  if (args.includes("--hot-reload") || args.includes("--hot")) {
    await runHotReloadMode();
    return;
  }

  // Parse options
  const quickMode = args.includes("--quick");

  // Parse --keys option
  let preselectedKeys: InputKey[] | undefined;
  const keysArg = args.find((a) => a.startsWith("--keys="));
  if (keysArg) {
    preselectedKeys = keysArg
      .split("=")[1]
      .toUpperCase()
      .split(",")
      .map((k) => k.trim())
      .filter((k) =>
        (INPUT_KEYS as readonly string[]).includes(k),
      ) as InputKey[];
  }

  // Check for help
  if (args.includes("--help") || args.includes("-h")) {
    console.log(`
Gesture Calibration Tool

USAGE:
  npm run calibrate                    Interactive wizard
  npm run calibrate -- --quick         Quick mode (5 samples instead of 10)
  npm run calibrate -- --keys=W,A,S,D  Calibrate specific keys
  npm run calibrate:hot                Hot-reload mode (connect to running app)

OPTIONS:
  --quick           Use 5 samples per step instead of 10
  --keys=<keys>     Comma-separated list of keys to calibrate
  --hot-reload      Connect to running app for live adjustments
  --help            Show this help

EXAMPLES:
  npm run calibrate -- --keys=W --quick    Quick single-key calibration
  npm run calibrate -- --keys=W,A,S,D      Calibrate movement keys
  npm run calibrate                        Full interactive wizard
`);
    process.exit(0);
  }

  // Run the wizard
  const cli = new CalibrationCLI({
    quickMode,
    preselectedKeys,
    samplesPerStep: 15,
  });

  await cli.run();
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
