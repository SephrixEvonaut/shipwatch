// ============================================================================
// GESTUREKIT - Main Entry Point (with Alpha/Omega System Selection)
// ============================================================================
//
// Features:
// - Cooldown system with configurable rate limiting
// - Per-action cooldown tracking
// - Gesture fallback (long ↔ super_long for Alpha)
// - Concurrent sequence execution
// - Per-key calibrated gesture thresholds
// - Hot-reload calibration server
// - Alpha (12-gesture) vs Omega (4-gesture) system selection
// - Queue pressure monitoring for output analysis
//
// ============================================================================

import { GestureDetector, GestureCallback } from "./gestureDetector.js";
import {
  OmegaGestureDetector,
  createOmegaGestureDetector,
} from "./omegaGestureDetector.js";
import { SequenceExecutor, ExecutionEvent } from "./sequenceExecutor.js";
import { InputListener, KeyEvent, MouseEvent } from "./inputListener.js";
import { ProfileLoader, DEFAULT_GESTURE_SETTINGS } from "./profileLoader.js";
import { getQueuePressureMonitor } from "./queuePressureMonitor.js";
import {
  MacroProfile,
  GestureEvent,
  MacroBinding,
  GestureType,
  InputKey,
} from "./types.js";
import {
  OmegaGestureEvent,
  OmegaGestureType,
  OmegaMacroBinding,
  GestureSystem,
  IGestureDetector,
  omegaToAlphaGesture,
  OMEGA_GESTURE_TYPES,
} from "./omegaTypes.js";
import {
  ExecutorFactory,
  IExecutor,
  ExecutorBackend,
} from "./executorFactory.js";
import {
  CooldownManager,
  getGestureFallback,
  isEmptyBinding,
} from "./cooldownManager.js";
import {
  createSpecialKeyHandler,
  SpecialKeyHandler,
} from "./specialKeyHandler.js";
import { type BackendMode, getBackendMode } from "./keyOutputAdapter.js";

// NEW: Profile system imports
import {
  PROFILE_REGISTRY,
  ProfileKey,
  ProfileConfig,
  DKeyMode,
  getProfileConfig,
  getValidProfileKeys,
  getProfileBindings,
  SHARED_BINDINGS,
} from "./omegaProfiles.js";
import {
  OmegaBinding,
  buildOmegaBindingLookup,
  omegaBindingToMacro,
} from "./omegaMappings.js";

// NEW: Calibration server imports
import {
  getCalibrationServer,
  stopCalibrationServer,
} from "./calibrationServer.js";
import { KeyProfile } from "./calibrationTypes.js";

// For interactive prompts
import * as readline from "readline";

// ============================================================================
// R STREAM CANCEL ABILITIES
// Ground-targeted AoEs and abilities that require R streaming to stop
// ============================================================================
const R_STREAM_CANCEL_ABILITIES = new Set([
  "Seismic Grenade",
  "Seismic Grenade (6F2)",
  "Seismic Mine",
  "Electro Stun Grenade",
  "Electro Stun",
  "Revivification",
  "Kolto Bomb",
]);

// ============================================================================
// SYSTEM SELECTION UTILITIES
// ============================================================================

/**
 * Prompt user to select gesture system (Alpha or Omega)
 */
async function selectGestureSystem(): Promise<GestureSystem> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    console.log("\n╔════════════════════════════════════════════════════════╗");
    console.log("║           SELECT GESTURE DETECTION SYSTEM              ║");
    console.log("╠════════════════════════════════════════════════════════╣");
    console.log("║                                                        ║");
    console.log("║  [1] ALPHA - 12 gestures (original system)             ║");
    console.log("║      • single, double, triple, quadruple               ║");
    console.log("║      • + long and super_long variants                  ║");
    console.log("║      • Multi-tap detection with elongating window      ║");
    console.log("║                                                        ║");
    console.log("║  [2] OMEGA - 4 gestures (streamlined system)           ║");
    console.log("║      • quick, long, quick_toggle, long_toggle          ║");
    console.log("║      • Long fires IMMEDIATELY on threshold cross       ║");
    console.log("║      • W/Y toggle keys for modifier state              ║");
    console.log("║      • Per-key calibrated thresholds                   ║");
    console.log("║                                                        ║");
    console.log("╚════════════════════════════════════════════════════════╝\n");

    const askQuestion = () => {
      rl.question("Select system [1/2] (default: 1): ", (answer) => {
        const trimmed = answer.trim().toLowerCase();

        if (trimmed === "" || trimmed === "1" || trimmed === "alpha") {
          rl.close();
          resolve("alpha");
        } else if (trimmed === "2" || trimmed === "omega") {
          rl.close();
          resolve("omega");
        } else {
          console.log("Invalid selection. Please enter 1 or 2.");
          askQuestion();
        }
      });
    };

    askQuestion();
  });
}

/**
 * Prompt user to enable/disable per-ability cooldown tracking
 */
async function selectCooldownMode(): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    console.log("\n╔════════════════════════════════════════════════════════╗");
    console.log("║         PER-ABILITY COOLDOWN TRACKING                  ║");
    console.log("╠════════════════════════════════════════════════════════╣");
    console.log("║                                                        ║");
    console.log("║  [Y] YES - Track individual ability cooldowns          ║");
    console.log("║      • Crushing Blow: 7s, Force Scream: 11s, etc.      ║");
    console.log("║      • Abilities blocked until cooldown expires        ║");
    console.log("║      • P key resets short cooldowns (<20s)             ║");
    console.log("║                                                        ║");
    console.log("║  [N] NO - Cooldown only mode (default rate limiting)     ║");
    console.log("║      • No per-ability cooldown tracking                ║");
    console.log(
      "║      • Actions fire as fast as cooldown allows            ║",
    );
    console.log("║      • You manage cooldowns yourself                   ║");
    console.log("║                                                        ║");
    console.log("╚════════════════════════════════════════════════════════╝\n");

    const askQuestion = () => {
      rl.question(
        "Enable per-ability cooldowns? [y/n] (default: n): ",
        (answer) => {
          const trimmed = answer.trim().toLowerCase();

          if (trimmed === "" || trimmed === "n" || trimmed === "no") {
            rl.close();
            resolve(false);
          } else if (trimmed === "y" || trimmed === "yes") {
            rl.close();
            resolve(true);
          } else {
            console.log("Invalid selection. Please enter y or n.");
            askQuestion();
          }
        },
      );
    };

    askQuestion();
  });
}

// Event callback for logging
function createEventCallback(): (event: ExecutionEvent) => void {
  return (event) => {
    if (event.type === "started") {
      console.log(`⚡ Started: ${event.bindingName}`);
    } else if (event.type === "completed") {
      console.log(`✅ Completed: ${event.bindingName}`);
    } else if (event.type === "error") {
      console.error(`❌ Error: ${event.bindingName} - ${event.error}`);
    }
  };
}

/**
 * Prompt user to select which character profile to load
 */
async function selectCharacterProfile(): Promise<ProfileKey> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    console.log("\n╔════════════════════════════════════════════════════════╗");
    console.log("║           SELECT CHARACTER PROFILE                     ║");
    console.log("╠════════════════════════════════════════════════════════╣");
    console.log("║                                                        ║");
    console.log("║  [T] VENGEANCE JUGGERNAUT (Tank)                       ║");
    console.log("║      D: continuous R stream, S: Guard (L bypass TC)    ║");
    console.log("║                                                        ║");
    console.log("║  [R] RAGE JUGGERNAUT                                   ║");
    console.log("║      D: burst F7 stream (slow), S: SpaceJamProtection  ║");
    console.log("║                                                        ║");
    console.log("║  [S] SORCERER HEALER                                   ║");
    console.log("║      D: single R press, S: Static Barrier              ║");
    console.log("║                                                        ║");
    console.log("║  [M] MADNESS SORCERER                                  ║");
    console.log("║      D: single R press, S: Static Barrier              ║");
    console.log("║                                                        ║");
    console.log("║  [E] ENGINEERING SNIPER                                ║");
    console.log("║      D: single R press, S: Shield Probe                ║");
    console.log("║                                                        ║");
    console.log("║  [C] COMBAT MEDIC (Merc Heals)                         ║");
    console.log("║      D: burst R stream (fast), S: Kolto Shell           ║");
    console.log("║                                                        ║");
    console.log("║  [A] ARSENAL MERCENARY                                  ║");
    console.log("║      D: burst R stream (fast), S: Energy Shield         ║");
    console.log("║                                                        ║");
    console.log("╚════════════════════════════════════════════════════════╝\n");

    const validKeys = getValidProfileKeys();

    const askQuestion = () => {
      rl.question("Select profile [T/R/S/M/E/C/A] (default: T): ", (answer) => {
        const trimmed = answer.trim().toUpperCase();

        if (trimmed === "") {
          rl.close();
          resolve("T");
        } else if (validKeys.includes(trimmed as ProfileKey)) {
          rl.close();
          resolve(trimmed as ProfileKey);
        } else {
          console.log(
            `Invalid selection. Valid options: ${validKeys.join(", ")}`,
          );
          askQuestion();
        }
      });
    };

    askQuestion();
  });
}

// ============================================================================
// MACRO AGENT CLASS
// ============================================================================

class MacroAgent {
  private profile: MacroProfile | null = null;

  // Gesture detectors - only one is active at a time
  private alphaDetector: GestureDetector | null = null;
  private omegaDetector: OmegaGestureDetector | null = null;
  private specialKeyHandler: SpecialKeyHandler | null = null;
  private activeSystem: GestureSystem = "alpha";

  private executor: IExecutor | null = null;
  private inputListener: InputListener;
  private profileLoader: ProfileLoader;
  private currentBackend: ExecutorBackend = "robotjs";
  private debugMode: boolean = false;
  private preferredProfile: string | null = null;
  private isStopped: boolean = false;
  private isPaused: boolean = false; // ENTER key chat-mode pause

  // Active character profile
  private currentProfileKey: ProfileKey = "T";

  // Cooldown manager for action rate limiting
  private cooldownManager: CooldownManager;

  // Per-action cooldown mode (set at startup)
  private perAbilityCooldownsEnabled: boolean = false;

  // Lookup tables for fast binding access
  private alphaBindingLookup: Map<string, Map<string, MacroBinding>> =
    new Map();
  private omegaBindingLookup: Map<string, Map<string, OmegaMacroBinding>> =
    new Map();

  // Calibration server state
  private calibrationServerEnabled: boolean = false;

  constructor() {
    this.profileLoader = new ProfileLoader("./profiles");

    // Create input listener
    this.inputListener = new InputListener((event) => {
      this.handleInputEvent(event);
    });

    // Set up hotkey callback for special commands (CTRL+SHIFT+G for config mode)
    this.inputListener.setHotkeyCallback((hotkey) => {
      this.handleHotkey(hotkey);
    });

    // Initialize cooldown manager
    this.cooldownManager = new CooldownManager();
  }

  /**
   * Handle special hotkey combinations
   */
  private handleHotkey(hotkey: string): void {
    if (hotkey === "CTRL+SHIFT+G") {
      if (this.omegaDetector) {
        this.omegaDetector.toggleConfigMode();
      } else {
        console.log("⚠️  Config mode only available in Omega system");
      }
    } else if (hotkey === "ENTER_TOGGLE") {
      this.isPaused = !this.isPaused;
      if (this.isPaused) {
        // Release any keys the gesture detector is tracking
        if (this.omegaDetector) {
          this.omegaDetector.releaseAllKeys();
        }
        console.log(
          "\n⏸️  Gesture system PAUSED (chat mode) — press ENTER to resume",
        );
      } else {
        console.log("\n▶️  Gesture system RESUMED");
      }
    }
  }

  /**
   * Get the currently active gesture system
   */
  getActiveSystem(): GestureSystem {
    return this.activeSystem;
  }

  /**
   * Enable debug mode to show ALL raw key events
   */
  setDebugMode(enabled: boolean): void {
    this.debugMode = enabled;
    if (enabled) {
      this.inputListener.setRawEventCallback((rawName, state, rawEvent) => {
        console.log(
          `🔎 RAW: name="${rawName}" state=${state} scanCode=${
            rawEvent.scanCode || "N/A"
          } vKey=${rawEvent.vKey || "N/A"}`,
        );
      });
      console.log("🔧 Debug mode enabled - showing ALL raw key events");
    }
  }

  /**
   * Set preferred profile to load
   */
  setPreferredProfile(profileName: string): void {
    this.preferredProfile = profileName;
  }

  /**
   * Apply Teensy echo hit boost - increase echoHits from 1 to 3 for key abilities.
   * This is part of the reversion protocol: with Teensy handling output,
   * there's no queue contention, so higher echo counts are safe and improve
   * ability registration.
   */
  private applyTeensyEchoHitBoost(): void {
    if (!this.profile) return;

    const boostTargets = new Set([
      "backhand",
      "force choke",
      "force push",
      "leap",
    ]);
    let boostedCount = 0;

    for (const macro of this.profile.macros) {
      if (!macro.enabled) continue;
      const nameLower = macro.name.toLowerCase();

      // Check if this ability should get boosted echo hits
      const shouldBoost = Array.from(boostTargets).some((target) =>
        nameLower.includes(target),
      );

      if (shouldBoost) {
        for (const step of macro.sequence) {
          if (step.echoHits && (step.echoHits.count as number) < 3) {
            (step.echoHits as any).count = 3;
            boostedCount++;
          }
        }
      }
    }

    if (boostedCount > 0) {
      console.log(
        `🚀 Teensy mode: Boosted ${boostedCount} echo hits (1 → 3) for key abilities`,
      );
    }
  }

  /**
   * Initialize the executor with specified backend
   */
  async initializeExecutor(backend?: ExecutorBackend): Promise<void> {
    if (backend) {
      this.executor = await ExecutorFactory.create({
        backend,
        onEvent: createEventCallback(),
      });
      this.currentBackend = backend;
    } else {
      const result = await ExecutorFactory.createBest(createEventCallback());
      this.executor = result.executor;
      this.currentBackend = result.backend;
    }

    // If teensy backend, connect TeensyExecutor to SequenceExecutor
    if (this.currentBackend === "teensy") {
      try {
        const { getTeensyExecutor } = await import("./teensyExecutor.js");
        const teensy = await getTeensyExecutor();

        // Verify connection with a ping
        const pingOk = await teensy.ping();
        if (pingOk) {
          console.log("✅ Teensy 4.0 connected and responding (PONG)");
        } else {
          console.warn("⚠️  Teensy connected but PING failed - check sketch");
        }

        // Attach teensy to the SequenceExecutor if it's the right type
        if (this.executor && "setTeensyExecutor" in this.executor) {
          (this.executor as any).setTeensyExecutor(teensy);
        }
      } catch (error) {
        console.error("❌ Failed to connect to Teensy 4.0:", error);
        console.log("   Falling back to RobotJS backend...");
        this.executor = await ExecutorFactory.create({
          backend: "robotjs",
          onEvent: createEventCallback(),
        });
        this.currentBackend = "robotjs";
      }
    }

    // Set up cooldown manager to use the executor
    this.cooldownManager.setExecuteCallback((binding) => {
      if (this.executor) {
        this.executor.executeDetached(binding);
      }
    });
  }

  /**
   * Build lookup tables for fast binding access
   */
  private buildBindingLookups(): void {
    this.alphaBindingLookup.clear();
    this.omegaBindingLookup.clear();

    if (!this.profile) return;

    for (const macro of this.profile.macros) {
      if (!macro.enabled) continue;
      if (!macro.trigger) continue;

      const key = macro.trigger.key;
      const gesture = macro.trigger.gesture;

      // Add to Alpha lookup
      if (!this.alphaBindingLookup.has(key)) {
        this.alphaBindingLookup.set(key, new Map());
      }
      this.alphaBindingLookup.get(key)!.set(gesture, macro);

      // Check if gesture is already an Omega type
      const isOmegaGesture = OMEGA_GESTURE_TYPES.includes(
        gesture as OmegaGestureType,
      );

      if (isOmegaGesture) {
        // Gesture is already Omega - add directly to Omega lookup
        if (!this.omegaBindingLookup.has(key)) {
          this.omegaBindingLookup.set(key, new Map());
        }
        this.omegaBindingLookup.get(key)!.set(gesture as OmegaGestureType, {
          ...macro,
          trigger: { key, gesture: gesture as OmegaGestureType },
        });
      } else {
        // Alpha gesture - try to map to Omega equivalent
        const omegaGesture = this.alphaToOmegaGesture(gesture as GestureType);
        if (omegaGesture) {
          if (!this.omegaBindingLookup.has(key)) {
            this.omegaBindingLookup.set(key, new Map());
          }
          // Don't overwrite if already set (first mapping wins)
          if (!this.omegaBindingLookup.get(key)!.has(omegaGesture)) {
            this.omegaBindingLookup.get(key)!.set(omegaGesture, {
              ...macro,
              trigger: { key, gesture: omegaGesture },
            });
          }
        }
      }
    }
  }

  /**
   * Map Alpha gesture to Omega gesture (for compatibility)
   */
  private alphaToOmegaGesture(alpha: GestureType): OmegaGestureType | null {
    // Map primary Alpha gestures to Omega equivalents
    switch (alpha) {
      case "single":
        return "quick";
      case "single_long":
      case "single_super_long":
        return "long";
      case "double":
        return "quick_toggle";
      case "double_long":
      case "double_super_long":
        return "long_toggle";
      // Triple and quadruple don't have Omega equivalents
      default:
        return null;
    }
  }

  /**
   * Get Alpha binding for a specific key and gesture
   */
  private getAlphaBinding(
    key: InputKey,
    gesture: GestureType,
  ): MacroBinding | undefined {
    const keyMap = this.alphaBindingLookup.get(key);
    if (!keyMap) return undefined;
    return keyMap.get(gesture);
  }

  /**
   * Get Omega binding for a specific key and gesture
   */
  private getOmegaBinding(
    key: InputKey,
    gesture: OmegaGestureType,
  ): OmegaMacroBinding | undefined {
    const keyMap = this.omegaBindingLookup.get(key);
    if (!keyMap) return undefined;
    return keyMap.get(gesture);
  }

  /**
   * Check if an Alpha gesture has a valid binding
   */
  private hasValidAlphaBinding(key: InputKey, gesture: GestureType): boolean {
    const binding = this.getAlphaBinding(key, gesture);
    return !isEmptyBinding(binding);
  }

  /**
   * Handle raw input events
   */
  private handleInputEvent(event: KeyEvent | MouseEvent): void {
    if (this.isStopped) return;
    if (this.isPaused) return;

    if (this.debugMode) {
      if ("key" in event) {
        console.log(
          `🔍 DEBUG [${event.type}] key="${event.key}" ts=${event.timestamp}`,
        );
      } else {
        console.log(
          `🔍 DEBUG [${event.type}] button="${event.button}" ts=${event.timestamp}`,
        );
      }
    }

    // Route to active detector
    if (this.activeSystem === "omega" && this.omegaDetector) {
      if ("key" in event) {
        if (event.type === "down") {
          this.omegaDetector.handleKeyDown(event.key);
        } else {
          this.omegaDetector.handleKeyUp(event.key);
        }
      } else {
        if (event.type === "down") {
          this.omegaDetector.handleMouseDown(event.button);
        } else {
          this.omegaDetector.handleMouseUp(event.button);
        }
      }
    } else if (this.alphaDetector) {
      if ("key" in event) {
        if (event.type === "down") {
          this.alphaDetector.handleKeyDown(event.key);
        } else {
          this.alphaDetector.handleKeyUp(event.key);
        }
      } else {
        if (event.type === "down") {
          this.alphaDetector.handleMouseDown(event.button);
        } else {
          this.alphaDetector.handleMouseUp(event.button);
        }
      }
    }
  }

  /**
   * Handle detected Alpha gestures
   */
  private handleAlphaGesture(event: GestureEvent): void {
    if (this.isStopped) return;
    if (!this.profile || !this.executor) return;

    const { inputKey, gesture } = event;

    // P key: Reset short cooldowns (only if per-ability cooldowns enabled)
    if (inputKey === "P" && this.perAbilityCooldownsEnabled) {
      console.log(`\n🔄 [P] Resetting short cooldowns (<20s)...`);
      const reset = this.cooldownManager.resetShortCooldowns(20000);
      if (reset.length > 0) {
        console.log(`   Reset: ${reset.join(", ")}`);
      } else {
        console.log(`   No abilities on short cooldown`);
      }
      return;
    }

    console.log(`\n🎯 [ALPHA] Gesture: ${inputKey} → ${gesture}`);

    // Find matching macro binding (with fallback logic)
    let binding = this.getAlphaBinding(inputKey, gesture);
    let usedFallback = false;

    if (isEmptyBinding(binding)) {
      const fallbackGesture = getGestureFallback(gesture, (g) =>
        this.hasValidAlphaBinding(inputKey, g),
      );

      if (fallbackGesture) {
        binding = this.getAlphaBinding(inputKey, fallbackGesture);
        usedFallback = true;
        console.log(`   Fallback: ${gesture} → ${fallbackGesture}`);
      }
    }

    if (!binding || isEmptyBinding(binding)) {
      console.log(`   No macro bound`);
      return;
    }

    if (usedFallback) {
      console.log(`   Matched (via fallback): "${binding.name}"`);
    } else {
      console.log(`   Matched: "${binding.name}"`);
    }

    this.executeBinding(binding);
  }

  /**
   * Handle detected Omega gestures
   */
  private handleOmegaGesture(event: OmegaGestureEvent): void {
    if (this.isStopped) return;
    if (!this.profile || !this.executor) return;

    const { inputKey, gesture, wasToggled, holdDuration } = event;

    // P key: Reset short cooldowns (only if per-ability cooldowns enabled)
    if (inputKey === "P" && this.perAbilityCooldownsEnabled) {
      console.log(`\n🔄 [P] Resetting short cooldowns (<20s)...`);
      const reset = this.cooldownManager.resetShortCooldowns(20000);
      if (reset.length > 0) {
        console.log(`   Reset: ${reset.join(", ")}`);
      } else {
        console.log(`   No abilities on short cooldown`);
      }
      return;
    }

    const toggleIndicator = wasToggled ? " [TOGGLED]" : "";
    console.log(
      `\n🎯 [OMEGA] Gesture: ${inputKey} → ${gesture}${toggleIndicator} (${Math.round(holdDuration || 0)}ms)`,
    );

    // DPS TARGETING INTERCEPT: Q+5 → DPS 1, Q+6 → DPS 2
    // These fire: [DPS slot target key] → M (ToT) → ALT+F9 (Cog)
    if (
      gesture === "quick_q_toggle" &&
      (inputKey === "5" || inputKey === "6") &&
      this.omegaDetector
    ) {
      const dpsSlot = inputKey === "5" ? 1 : 2;
      const targetKey = this.omegaDetector.getDPSTargetKey(dpsSlot as 1 | 2);
      if (targetKey) {
        console.log(
          `   🎯 DPS ${dpsSlot} intercept: ${targetKey} → M → ALT+F9`,
        );
        // Build a dynamic binding for the DPS targeting sequence
        const dpsBinding: MacroBinding = {
          name: `DPS ${dpsSlot} Target + ToT + Cog`,
          sequence: [
            {
              key: targetKey,
              minDelay: 262,
              maxDelay: 348,
              echoHits: { count: 1, windowMs: 46 },
            },
            { key: "M", minDelay: 262, maxDelay: 348 },
            { key: "ALT+F9", bufferTier: "low", minDelay: 0, maxDelay: 0 },
          ],
          enabled: true,
        };
        this.executor!.executeDetached(dpsBinding);
        return;
      } else {
        console.log(`   ⚠️ DPS ${dpsSlot} not designated yet`);
        return;
      }
    }

    // Find matching Omega binding
    let binding = this.getOmegaBinding(inputKey, gesture);
    let usedFallback = false;

    // TOGGLE FALLBACK: If toggle gesture has no binding, fall back to non-toggle equivalent
    // quick_toggle → quick, long_toggle → long
    if (!binding || isEmptyBinding(binding)) {
      let fallbackGesture: OmegaGestureType | null = null;

      if (gesture === "quick_toggle") {
        fallbackGesture = "quick";
      } else if (gesture === "long_toggle") {
        fallbackGesture = "long";
      }

      if (fallbackGesture) {
        const fallbackBinding = this.getOmegaBinding(inputKey, fallbackGesture);
        if (fallbackBinding && !isEmptyBinding(fallbackBinding)) {
          binding = fallbackBinding;
          usedFallback = true;
          console.log(`   🔄 Toggle fallback: ${gesture} → ${fallbackGesture}`);
        }
      }
    }

    if (!binding || isEmptyBinding(binding)) {
      console.log(`   No macro bound`);
      return;
    }

    if (usedFallback) {
      console.log(`   Matched (via fallback): "${binding.name}"`);
    } else {
      console.log(`   Matched: "${binding.name}"`);
    }

    // Abilities that require R streaming to stop (ground-targeted AoEs that need cursor)
    if (this.omegaDetector && R_STREAM_CANCEL_ABILITIES.has(binding.name)) {
      if (this.omegaDetector.stopRStreamIfActive()) {
        console.log(`   🔴 R stream stopped for "${binding.name}"`);
      }
    }

    this.executeBinding(binding);
  }

  /**
   * Execute a macro binding through the cooldown system.
   * Never throws — errors are logged and swallowed to keep the event loop alive.
   */
  private executeBinding(binding: MacroBinding | OmegaMacroBinding): void {
    try {
      if (!this.executor) {
        console.error(
          `❌ executeBinding: no executor available (binding="${binding.name}")`,
        );
        return;
      }

      // When cooldowns are disabled, bypass cooldown system entirely
      if (!this.perAbilityCooldownsEnabled) {
        console.log(`   🎯 Executing (cooldowns disabled)`);
        this.executor.executeDetached(binding as MacroBinding);
        return;
      }

      const cooldownAction = this.cooldownManager.detectCooldownAction(
        binding as MacroBinding,
      );

      if (cooldownAction) {
        const result = this.cooldownManager.tryExecute(binding as MacroBinding);

        if (result.executed) {
          console.log(`   ⚔️  Executed immediately (${cooldownAction})`);
        } else if (result.queued) {
          console.log(`   ⏳ Queued: ${result.reason}`);
        } else {
          console.log(`   ❌ Skipped: ${result.reason}`);
        }
      } else {
        console.log(`   🎯 Executing (non-cooldown)`);
        this.executor.executeDetached(binding as MacroBinding);
      }
    } catch (err) {
      console.error(
        `❌ Binding execution error for "${binding.name}": ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  /**
   * Load a macro profile
   */
  async loadProfile(filename: string): Promise<boolean> {
    const profile = this.profileLoader.loadProfile(filename);
    if (!profile) return false;

    this.profile = profile;
    this.buildBindingLookups();

    // Teensy mode: Boost echo hits from 1 to 3 for key abilities
    // (Reversion protocol - higher echo counts are safe with no queue contention)
    if (this.currentBackend === "teensy") {
      this.applyTeensyEchoHitBoost();
    }

    // Create the appropriate gesture detector based on active system
    if (this.activeSystem === "omega") {
      this.omegaDetector = createOmegaGestureDetector(
        profile.gestureSettings || DEFAULT_GESTURE_SETTINGS,
        (event) => this.handleOmegaGesture(event),
      );

      // Configure D stream interval based on backend
      // Teensy mode: 200ms (faster Retaliate), Software mode: 380ms (reduce queue pressure)
      if (this.currentBackend === "teensy") {
        this.omegaDetector.setDStreamInterval(200);
      }

      // Wire up special key handler for D retaliate, S group member, C escape, etc.
      // Pass backend mode to disable pressure monitoring in teensy mode
      const backendMode = getBackendMode(this.currentBackend);
      let teensyForHandler: any = null;
      if (this.currentBackend === "teensy") {
        try {
          const { getTeensyExecutor } = await import("./teensyExecutor.js");
          teensyForHandler = await getTeensyExecutor();
        } catch {
          // Teensy not available - will use RobotJS fallback in handler
        }
      }
      this.specialKeyHandler = await createSpecialKeyHandler({
        debug: true,
        backendMode,
        teensyExecutor: teensyForHandler,
        onSuppressKey: (key, durationMs) => {
          // Suppress synthetic keys in the gesture detector
          if (this.omegaDetector) {
            this.omegaDetector.suppressKey(key, durationMs);
          }
        },
      });
      this.omegaDetector.setSpecialKeyCallback((event) => {
        if (this.specialKeyHandler) {
          this.specialKeyHandler.handleEvent(event);
        }
      });
      // Wire up TTS speaking check so D toggle ignores presses during TTS
      this.omegaDetector.setTTSSpeakingCallback(() => {
        return this.specialKeyHandler?.isTTSSpeaking() ?? false;
      });
      console.log("🔧 Special key handler wired up (D/S/C/=/F2/MIDDLE_CLICK)");

      // Configure D key mode based on active character profile
      const profileConfig = getProfileConfig(this.currentProfileKey);
      this.omegaDetector.setDKeyMode(profileConfig.dKeyMode);
      if (profileConfig.dKeyOutput) {
        this.omegaDetector.setDKeyOutput(profileConfig.dKeyOutput);
      }

      // Build combined bindings from profile + shared, and set for instant-quick optimization
      const profileBindings = getProfileBindings(this.currentProfileKey);
      const omegaBindingEntries = profileBindings.map((b) => ({
        inputKey: b.inputKey,
        gesture: b.gesture,
      }));
      this.omegaDetector.setExistingBindings(omegaBindingEntries);

      // Also build the Omega binding lookup from profile bindings
      // This replaces the generic profile macros with the specific Omega bindings
      const omegaLookup = buildOmegaBindingLookup(profileBindings);
      this.omegaBindingLookup.clear();
      for (const [inputKey, gestureMap] of omegaLookup) {
        const oBMap = new Map<string, OmegaMacroBinding>();
        for (const [gesture, binding] of gestureMap) {
          const macroBind = omegaBindingToMacro(binding);
          oBMap.set(gesture, {
            ...macroBind,
            trigger: { key: inputKey, gesture },
          });
        }
        this.omegaBindingLookup.set(inputKey, oBMap);
      }
      console.log(
        `🔧 Omega profile [${this.currentProfileKey}]: ${profileBindings.length} active bindings (authoritative)`,
      );

      // NOTE: We intentionally do NOT re-call setExistingBindings with JSON profile macros here.
      // The Omega profile bindings (set above from getProfileBindings) are the authoritative source.
      // Re-calling setExistingBindings with stale JSON macros would overwrite the correct bindings
      // since setExistingBindings calls .clear() first.

      // Load per-key calibrated profiles
      const keyProfiles = this.profileLoader.getKeyProfiles();
      if (keyProfiles.size > 0) {
        const profilesRecord: Record<string, any> = {};
        for (const [key, keyProfile] of keyProfiles) {
          profilesRecord[key] = keyProfile;
        }
        this.omegaDetector.loadKeyProfiles(profilesRecord);
        console.log(
          `🎯 Applied ${keyProfiles.size} per-key gesture profiles (Omega)`,
        );
      }
    } else {
      this.alphaDetector = new GestureDetector(
        profile.gestureSettings || DEFAULT_GESTURE_SETTINGS,
        (event) => this.handleAlphaGesture(event),
      );

      // Load per-key calibrated profiles
      const keyProfiles = this.profileLoader.getKeyProfiles();
      if (keyProfiles.size > 0) {
        const profilesRecord: Record<string, any> = {};
        for (const [key, keyProfile] of keyProfiles) {
          profilesRecord[key] = keyProfile;
        }
        this.alphaDetector.loadKeyProfiles(profilesRecord);
        console.log(
          `🎯 Applied ${keyProfiles.size} per-key gesture profiles (Alpha)`,
        );
      }
    }

    // Compiled profile for executor
    const compiled = this.profileLoader.getCompiledProfile();
    if (compiled && this.executor && "setCompiledProfile" in this.executor) {
      try {
        (this.executor as any).setCompiledProfile(compiled);
        console.log(
          `🔧 Compiled profile applied to executor (${compiled.conflictKeys.size} conflict keys)`,
        );

        // Wire up modifier state callback for smart traffic control
        if ("setModifierStateCallback" in this.executor) {
          (this.executor as any).setModifierStateCallback(() => {
            return this.inputListener.getModifierState();
          });
          console.log(
            `🚦 Smart traffic control enabled (SHIFT-immune keys will fire immediately)`,
          );
        }

        // Wire up key suppression callback to prevent synthetic keypresses from triggering gestures
        if ("setSuppressKeyCallback" in this.executor && this.omegaDetector) {
          (this.executor as any).setSuppressKeyCallback(
            (key: string, durationMs: number) => {
              this.omegaDetector!.suppressKey(key, durationMs);
            },
          );
          console.log(
            `🔇 Key suppression enabled (synthetic keypresses won't trigger gestures)`,
          );
        }
      } catch (err) {
        console.warn("⚠️  Failed to apply compiled profile to executor:", err);
      }
    }

    return true;
  }

  /**
   * Start the calibration hot-reload server
   */
  private async startCalibrationServer(): Promise<void> {
    try {
      const server = getCalibrationServer(8765);
      await server.start();

      // Connect to active gesture detector
      const activeDetector =
        this.activeSystem === "omega" ? this.omegaDetector : this.alphaDetector;

      if (activeDetector) {
        server.connectGestureDetector(activeDetector as any);
      }

      if (this.profile?.gestureSettings) {
        server.setGlobalDefaults(this.profile.gestureSettings);
      }

      this.calibrationServerEnabled = true;
      console.log("\n🔥 Calibration server enabled (ws://localhost:8765)");
    } catch (error) {
      console.warn("⚠️  Failed to start calibration server:", error);
    }
  }

  /**
   * Start the macro agent
   */
  async start(
    backend?: ExecutorBackend,
    system?: GestureSystem,
  ): Promise<void> {
    console.log("\n╔════════════════════════════════════════════════════════╗");
    console.log("║       GESTUREKIT - Cooldown System              ║");
    console.log("╚════════════════════════════════════════════════════════╝\n");

    // System selection (if not provided via argument)
    if (!system) {
      // Check for command line argument or environment variable
      const args = process.argv.slice(2);
      const systemArg = args.find((a) => a.startsWith("--system="));
      if (systemArg) {
        const value = systemArg.split("=")[1].toLowerCase();
        if (value === "omega" || value === "alpha") {
          system = value;
        }
      } else if (process.env.GESTURE_SYSTEM) {
        const envValue = process.env.GESTURE_SYSTEM.toLowerCase();
        if (envValue === "omega" || envValue === "alpha") {
          system = envValue;
        }
      }

      // Default to omega if both arg and env var are absent — never block on stdin
      if (!system) {
        system = "omega";
        console.log("⚙️  No --system arg — defaulting to system=omega");
      }
    }

    this.activeSystem = system;

    console.log(`\n🎮 Active gesture system: ${system.toUpperCase()}`);
    if (system === "omega") {
      console.log("   • 4 gestures: quick, long, quick_toggle, long_toggle");
      console.log("   • Long fires IMMEDIATELY on threshold cross");
      console.log("   • W/Y toggle keys for modifier state");
      console.log("   • Cooldown: 1.275s");
    } else {
      console.log("   • 12 gestures: single/double/triple/quadruple variants");
      console.log("   • Multi-tap detection with elongating window");
      console.log("   • Long ↔ Super Long fallback enabled");
    }

    // Cooldown mode selection
    const cooldownArg = process.argv.find((a) => a.startsWith("--cooldowns="));
    if (cooldownArg) {
      const value = cooldownArg.split("=")[1].toLowerCase();
      this.perAbilityCooldownsEnabled =
        value === "yes" || value === "y" || value === "true";
    } else if (process.env.ABILITY_COOLDOWNS) {
      const envValue = process.env.ABILITY_COOLDOWNS.toLowerCase();
      this.perAbilityCooldownsEnabled =
        envValue === "yes" || envValue === "y" || envValue === "true";
    } else {
      // Default to disabled — never block on stdin
      this.perAbilityCooldownsEnabled = false;
      console.log("⚙️  No --cooldowns arg — defaulting to cooldowns=no");
    }

    // Configure cooldown manager
    this.cooldownManager.setPerActionCooldownsEnabled(
      this.perAbilityCooldownsEnabled,
    );

    if (this.perAbilityCooldownsEnabled) {
      console.log("\n⏱️  Per-ability cooldowns: ENABLED");
      console.log("   • Abilities respect their in-game cooldowns");
      console.log("   • P key resets short cooldowns (<20s)");
    } else {
      console.log(
        "\n⏱️  Per-action cooldowns: DISABLED (default cooldown only)",
      );
      console.log("   • Only default cooldown between actions");
      console.log("   • You manage cooldowns yourself");
    }

    // Character profile selection (Omega only)
    if (this.activeSystem === "omega") {
      const profileArg = process.argv.find((a) => a.startsWith("--char="));
      if (profileArg) {
        const value = profileArg.split("=")[1].toUpperCase();
        if (getValidProfileKeys().includes(value as ProfileKey)) {
          this.currentProfileKey = value as ProfileKey;
        }
      } else if (process.env.CHAR_PROFILE) {
        const envValue = process.env.CHAR_PROFILE.toUpperCase();
        if (getValidProfileKeys().includes(envValue as ProfileKey)) {
          this.currentProfileKey = envValue as ProfileKey;
        }
      } else {
        // Default to Tank — never block on stdin
        this.currentProfileKey = "T";
        console.log(
          "⚙️  No --char arg — defaulting to char=T (Tank/Vengeance Jugg)",
        );
      }

      const profileConfig = getProfileConfig(this.currentProfileKey);
      console.log(
        `\n🗡️  Character: ${profileConfig.name} [${this.currentProfileKey}]`,
      );
      console.log(`   • D key mode: ${profileConfig.dKeyMode}`);
      console.log(`   • S quick: ${profileConfig.sQuickAbility}`);
    }

    // Initialize executor
    await this.initializeExecutor(backend);
    console.log(`\n🔧 Executor backend: ${this.currentBackend.toUpperCase()}`);
    if (this.currentBackend === "teensy") {
      console.log("   • Output via USB HID (Teensy 4.0)");
      console.log("   • No mouse stutter (separate USB device)");
      console.log("   • RepeatPolice: DISABLED");
      console.log("   • Queue Pressure Monitor: DISABLED");
      console.log("   • Output Pacing: DISABLED");
    } else if (this.currentBackend === "robotjs") {
      console.log("   • Output via SendInput API (software injection)");
      console.log("   • RepeatPolice: ACTIVE (anti-spam)");
      console.log("   • Queue Pressure Monitor: ACTIVE (stutter tracking)");
      console.log("   • Output Pacing: AGGRESSIVE (100/120/190ms)");
    }

    // Load profile
    const profiles = this.profileLoader.listProfiles();

    if (profiles.length === 0) {
      console.log("⚠️  No profiles found in ./profiles/");
      console.log("   Creating example profile...\n");

      if (!(await this.loadProfile("example.json"))) {
        console.error("❌ Failed to load profile");
        return;
      }
    } else {
      console.log(`📂 Available profiles: ${profiles.join(", ")}`);

      let profileToLoad: string;
      if (this.preferredProfile) {
        if (profiles.includes(this.preferredProfile)) {
          profileToLoad = this.preferredProfile;
        } else {
          console.error(
            `❌ Specified profile not found: ${this.preferredProfile}`,
          );
          return;
        }
      } else {
        const defaultProfile = profiles.find((p) =>
          p.toLowerCase().includes("default"),
        );
        profileToLoad = defaultProfile || profiles[0];
      }

      console.log(`📌 Loading: ${profileToLoad}`);
      if (!(await this.loadProfile(profileToLoad))) {
        console.error("❌ Failed to load profile");
        return;
      }
    }

    // Start calibration server if enabled
    if (process.env.ENABLE_CALIBRATION_SERVER === "true") {
      await this.startCalibrationServer();
    }

    // Show summary
    if (this.profile) {
      let cooldownCount = 0;
      let nonCooldownCount = 0;
      for (const macro of this.profile.macros) {
        if (macro.enabled) {
          if (this.cooldownManager.detectCooldownAction(macro)) {
            cooldownCount++;
          } else {
            nonCooldownCount++;
          }
        }
      }

      console.log(
        `\n📋 Loaded macros: ${cooldownCount} cooldown, ${nonCooldownCount} non-cooldown`,
      );
      console.log(
        `   Cooldown Duration: ${this.activeSystem === "omega" ? "1.275s" : "1.385s"}`,
      );
    }

    console.log("\n🔒 Cooldown System:");
    console.log("   • Cooldown actions queue when cooldown active");
    console.log("   • Most recent gesture wins when cooldown ends");
    console.log("   • Per-action cooldowns tracked independently");

    console.log("\n📀 Concurrency:");
    console.log("   • Simultaneous keys: YES");
    console.log("   • Concurrent sequences: YES");
    console.log("   • Cooldown actions: QUEUED");

    // Show calibration status
    if (this.profileLoader.hasCalibrationData()) {
      const detector =
        this.activeSystem === "omega" ? this.omegaDetector : this.alphaDetector;
      const customKeys = detector?.getCustomizedKeys() || [];
      console.log("\n📏 Calibration:");
      console.log(`   • Per-key profiles: ${customKeys.length} keys`);
    }

    // =========================================================================
    // STARTUP VALIDATION + READY BANNER
    // =========================================================================
    {
      const profileCfg = getProfileConfig(this.currentProfileKey);
      const loadedBindings = getProfileBindings(this.currentProfileKey);
      const bindingCount = loadedBindings.length;

      // Hard validation — zero bindings means something is deeply wrong
      if (bindingCount === 0) {
        console.error(
          "\n❌ STARTUP VALIDATION FAILED: Profile loaded 0 bindings — " +
            "check omegaProfiles.ts and omegaMappings.ts",
        );
      }

      const executorOk = this.executor !== null;
      const specialKeyOk =
        this.activeSystem !== "omega" || this.specialKeyHandler !== null;

      if (!executorOk) {
        console.error("❌ STARTUP VALIDATION: Executor not initialized!");
      }
      if (!specialKeyOk) {
        console.error(
          "❌ STARTUP VALIDATION: Special key handler not wired (Omega mode)!",
        );
      }

      const backendLabel = this.currentBackend.toUpperCase();
      const cooldownLabel = this.perAbilityCooldownsEnabled ? "yes" : "no";
      console.log("\n══════════════════════════════════════════════════════");
      console.log("  ★  GESTUREKIT — READY  ★");
      console.log("══════════════════════════════════════════════════════");
      console.log(
        `  Profile  : ${profileCfg.name} [${this.currentProfileKey}]`,
      );
      console.log(`  Bindings : ${bindingCount} loaded`);
      console.log(`  Backend  : ${backendLabel}`);
      console.log(`  D Mode   : ${profileCfg.dKeyMode}`);
      console.log(`  Cooldowns: ${cooldownLabel}`);
      console.log(`  Executor : ${executorOk ? "✅ OK" : "❌ MISSING"}`);
      console.log(
        `  SpecialK : ${
          this.activeSystem === "omega"
            ? specialKeyOk
              ? "✅ wired"
              : "❌ MISSING"
            : "N/A (alpha mode)"
        }`,
      );
      console.log("══════════════════════════════════════════════════════");
    }

    // Start listening
    console.log("\n─────────────────────────────────────────────────────────");
    this.inputListener.start();
  }

  /**
   * Stop the macro agent
   */
  stop(): void {
    this.isStopped = true;
    this.inputListener.stop();
    this.cooldownManager.shutdown();

    // Destroy active detector
    if (this.alphaDetector && "destroy" in this.alphaDetector) {
      (this.alphaDetector as any).destroy?.();
    }
    if (this.omegaDetector) {
      this.omegaDetector.destroy();
    }

    // Stop executor
    if (this.executor && "cancelAll" in this.executor) {
      (this.executor as any).cancelAll?.();
    }
    if (this.executor && "destroy" in this.executor) {
      (this.executor as any).destroy?.();
    }

    // Stop calibration server
    if (this.calibrationServerEnabled) {
      stopCalibrationServer();
    }

    console.log("🛑 Macro Agent stopped");
  }

  getBackend(): ExecutorBackend {
    return this.currentBackend;
  }

  static async showBackends(): Promise<void> {
    console.log("\n📊 Available executor backends:\n");
    const backends = await ExecutorFactory.getAvailableBackends();

    for (const { backend, available, notes } of backends) {
      const status = available ? "✅" : "❌";
      console.log(`  ${status} ${backend.toUpperCase()}`);
      console.log(`     ${notes}\n`);
    }
  }
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  const args = process.argv.slice(2);

  // Show help
  if (args.includes("--help") || args.includes("-h")) {
    console.log(`
GestureKit - Input Gesture Engine (Alpha/Omega)

USAGE:
  npm start                    Auto-select executor, prompt for system
  npm start -- --system=omega  Use Omega gesture system
  npm start -- --system=alpha  Use Alpha gesture system
  npm start -- --backend=X     Use specific executor backend
  npm start -- --backends      Show available backends
  npm start -- --help          Show this help

GESTURE SYSTEMS:
  alpha       12 gestures (original) - single/double/triple/quadruple variants
  omega       4 gestures (streamlined) - quick/long with toggle modifiers

BACKENDS:
  robotjs       RobotJS (SendInput API) - Medium detection risk
  interception  Interception Driver - Hard to detect (kernel-level)
  mock          Mock executor (no keypresses) - For testing

CALIBRATION:
  npm run calibrate              Run calibration wizard
  npm run calibrate:hot          Hot-reload mode (live tuning)

OPTIONS:
  --system=<alpha|omega>       Select gesture detection system
  --backend=<backend>          Select executor backend
  --profile=<filename>         Load specific profile
  --debug                      Show ALL raw key events

ENVIRONMENT:
  GESTURE_SYSTEM=omega           Set default gesture system
  MACRO_BACKEND=teensy           Set default executor backend
  ENABLE_CALIBRATION_SERVER=true Enable hot-reload server
`);
    process.exit(0);
  }

  // Show available backends
  if (args.includes("--backends")) {
    await MacroAgent.showBackends();
    process.exit(0);
  }

  // Parse options
  let backend: ExecutorBackend | undefined;
  const backendArg = args.find((a) => a.startsWith("--backend="));
  if (backendArg) {
    backend = backendArg.split("=")[1] as ExecutorBackend;
  } else if (process.env.MACRO_BACKEND) {
    backend = process.env.MACRO_BACKEND as ExecutorBackend;
  }

  let profileName: string | undefined;
  const profileArg = args.find((a) => a.startsWith("--profile="));
  if (profileArg) {
    profileName = profileArg.split("=")[1];
  }

  let system: GestureSystem | undefined;
  const systemArg = args.find((a) => a.startsWith("--system="));
  if (systemArg) {
    const value = systemArg.split("=")[1].toLowerCase();
    if (value === "omega" || value === "alpha") {
      system = value;
    }
  }

  const debugMode = args.includes("--debug");

  const agent = new MacroAgent();
  agent.setDebugMode(debugMode);
  if (profileName) {
    agent.setPreferredProfile(profileName);
  }

  // Handle graceful shutdown
  let isShuttingDown = false;
  const shutdown = async () => {
    if (isShuttingDown) return;
    isShuttingDown = true;

    // Print queue pressure analysis report only in software mode
    const activeBackend = backend || agent.getBackend();
    if (activeBackend !== "teensy") {
      console.log("\n📊 Generating Queue Pressure Report...\n");
      const pressureMonitor = getQueuePressureMonitor();
      pressureMonitor.printSummary();
    } else {
      console.log(
        "\n🔌 Teensy mode - no queue pressure report (no contention)",
      );
      // Disconnect Teensy serial port
      try {
        const { disconnectTeensy } = await import("./teensyExecutor.js");
        await disconnectTeensy();
      } catch {
        // Ignore - teensy module may not be loaded
      }
    }

    agent.stop();
    setTimeout(() => process.exit(0), 150); // Extra time for report output
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
  process.on("exit", shutdown);

  // Start the agent
  await agent.start(backend, system);
}

main().catch(console.error);
