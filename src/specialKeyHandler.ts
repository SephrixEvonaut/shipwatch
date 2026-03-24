// ============================================================================
// SPECIAL KEY HANDLER - Processes direct key outputs from Omega detector
// ============================================================================
//
// This module handles the special key output events from the Omega gesture
// detector, including:
// - D key continuous output mode
// - S key secondary toggle mode
// - C key double-tap detection
// - = key double-tap detection
//
// ============================================================================

import { SpecialKeyOutputEvent } from "./omegaGestureDetector.js";
import { getHumanDelay, getHumanKeyDownDuration } from "./humanRandomizer.js";
import { getQueuePressureMonitor } from "./queuePressureMonitor.js";
import { type BackendMode } from "./keyOutputAdapter.js";
import { type TeensyExecutor } from "./teensyExecutor.js";

/**
 * Key press callback for executing actual key outputs
 */
export type KeyPressCallback = (
  key: string,
  holdDurationMs: number,
) => Promise<void>;

/**
 * Configuration for special key handler
 */
export interface SpecialKeyHandlerConfig {
  /** Callback to press a key with specified hold duration */
  onKeyPress: KeyPressCallback;

  /** Callback to suppress a key in the gesture detector (prevents echo) */
  onSuppressKey?: (key: string, durationMs: number) => void;

  /** Enable debug logging */
  debug?: boolean;

  /** Backend mode - 'software' enables pressure monitoring, 'teensy' disables it */
  backendMode?: BackendMode;
}

/**
 * Special Key Handler
 * Processes SpecialKeyOutputEvents from the Omega gesture detector
 */
export class SpecialKeyHandler {
  private config: SpecialKeyHandlerConfig;
  private isExecuting: boolean = false;
  private pendingQueue: SpecialKeyOutputEvent[] = [];
  private isShutdown: boolean = false;

  // D key stream state - simple flag to block Rs after release
  private dStreamActive: boolean = false;

  // TTS state
  private sayModule: any = null;
  private ttsAvailable: boolean = false;
  private ttsSpeaking: boolean = false;

  constructor(config: SpecialKeyHandlerConfig) {
    this.config = config;
    this.initializeTTS();
  }

  /**
   * Initialize TTS module (say package)
   */
  private async initializeTTS(): Promise<void> {
    try {
      const sayImport = await import("say");
      this.sayModule = sayImport.default || sayImport;
      this.ttsAvailable = true;
      console.log("[SpecialKey] TTS module loaded successfully");
    } catch {
      console.warn("[SpecialKey] TTS module (say) not available");
      this.ttsAvailable = false;
    }
  }

  /**
   * Speak a TTS message. Returns a promise that resolves when done speaking.
   */
  private speakTTS(message: string): void {
    if (!this.ttsAvailable || !this.sayModule) {
      console.log(`[SpecialKey][TTS DISABLED] Would speak: "${message}"`);
      return;
    }
    try {
      this.ttsSpeaking = true;
      this.sayModule.speak(message, undefined, undefined, () => {
        this.ttsSpeaking = false;
      });
    } catch (error) {
      console.error(`[SpecialKey] TTS error:`, error);
      this.ttsSpeaking = false;
    }
  }

  /**
   * Check if TTS is currently speaking
   */
  isTTSSpeaking(): boolean {
    return this.ttsSpeaking;
  }

  /**
   * Handle a special key output event
   */
  async handleEvent(event: SpecialKeyOutputEvent): Promise<void> {
    if (this.isShutdown) return;

    // D release MUST be handled immediately - sets flag to block future Rs
    if (event.source === "d_release") {
      this.handleDRelease();
      return;
    }

    // D stream start - mark as active
    if (event.source === "d_stream") {
      this.dStreamActive = true;
    }

    // Queue events if currently executing
    if (this.isExecuting) {
      // Don't queue d_stream if D was already released
      if (event.source === "d_stream" && !this.dStreamActive) {
        console.log(`[SpecialKey] R blocked - D already released`);
        return;
      }
      this.pendingQueue.push(event);
      return;
    }

    await this.processEvent(event);
  }

  /**
   * Process a single event
   */
  private async processEvent(event: SpecialKeyOutputEvent): Promise<void> {
    if (this.isShutdown) return;

    this.isExecuting = true;

    try {
      switch (event.source) {
        case "d_stream":
          await this.processDStreamOutput(event);
          break;
        case "d_release":
          this.handleDRelease();
          break;
        case "d_toggle_tts":
          this.processDToggleTTS(event);
          break;
        case "s_group_member":
        case "s_target_of_target":
          await this.processGroupMemberOutput(event);
          break;
        case "c_escape":
          await this.processEscapeOutput(event);
          break;
        case "equals_smash":
          await this.processSmashOutput(event);
          break;
        case "middle_click_zoom_out":
          await this.processMiddleClickZoomOut(event);
          break;
        default:
          // Handle any direct_output with keys
          if (event.keys && event.keys.length > 0) {
            await this.processGroupMemberOutput(event);
          }
          // Handle TTS on any event with ttsMessage
          if (event.ttsMessage) {
            this.speakTTS(event.ttsMessage);
          }
          break;
      }
    } catch (error) {
      console.error(`Special key handler error:`, error);
    } finally {
      this.isExecuting = false;

      // Process any queued events
      if (this.pendingQueue.length > 0) {
        const nextEvent = this.pendingQueue.shift()!;
        await this.processEvent(nextEvent);
      }
    }
  }

  /**
   * Handle D key release - IMMEDIATELY stop all R processing
   */
  private handleDRelease(): void {
    this.dStreamActive = false;

    // Clear all pending d_stream events from queue
    this.pendingQueue = this.pendingQueue.filter(
      (e) => e.source !== "d_stream",
    );
  }

  /**
   * Process D toggle TTS event ("on on on" / "off off off")
   */
  private processDToggleTTS(event: SpecialKeyOutputEvent): void {
    if (event.ttsMessage) {
      console.log(`[SpecialKey] D Toggle TTS: "${event.ttsMessage}"`);
      this.speakTTS(event.ttsMessage);
    }

    // Also process any keys if present
    if (event.keys && event.keys.length > 0) {
      this.processGroupMemberOutput(event);
    }
  }

  /**
   * Process D key stream output - sends a single R
   * Called every 290ms by the interval in omegaGestureDetector (after 120ms initial delay)
   * Each R is held for 36-41ms (randomized)
   */
  private async processDStreamOutput(
    event: SpecialKeyOutputEvent,
  ): Promise<void> {
    // Safety check - don't send if D was released
    if (!this.dStreamActive) {
      return;
    }

    if (event.keys.length === 0) {
      return;
    }

    // Get hold duration from event timings (36-41ms)
    const keyDownRange = event.timings?.keyDownMs ?? [36, 41];
    const holdDuration = getHumanDelay(
      keyDownRange[0],
      keyDownRange[1],
      "d_stream_hold",
    );

    // Final safety check before pressing
    if (!this.dStreamActive) {
      return;
    }

    // Press the R key
    await this.config.onKeyPress("R", holdDuration);

    // Record R stream output for pressure monitoring (software mode only)
    if (this.config.backendMode !== "teensy") {
      const pressureMonitor = getQueuePressureMonitor();
      pressureMonitor.recordOutput("R_Stream", "R", holdDuration);
    }
  }

  /**
   * Process S key Group Member output
   * Outputs target key followed by cog key
   */
  private async processGroupMemberOutput(
    event: SpecialKeyOutputEvent,
  ): Promise<void> {
    const { keys } = event;
    const usePressureMonitor = this.config.backendMode !== "teensy";
    const pressureMonitor = usePressureMonitor
      ? getQueuePressureMonitor()
      : null;

    if (this.config.debug) {
      console.log(`[SpecialKey] Group Member: ${keys.join(" → ")}`);
    }

    // Press each key in sequence with short delays
    for (let i = 0; i < keys.length; i++) {
      if (this.isShutdown) break;

      const key = keys[i];
      const holdDuration = getHumanKeyDownDuration();

      // Suppress synthetic key to prevent re-detection by gesture detector
      // Parse base key from modifier combos like "CTRL+V" → suppress "V"
      const baseKey = key.includes("+") ? key.split("+").pop()! : key;
      if (this.config.onSuppressKey) {
        this.config.onSuppressKey(baseKey, holdDuration + 100);
      }

      await this.config.onKeyPress(key, holdDuration);
      if (pressureMonitor) {
        pressureMonitor.recordOutput("S_GroupMember", key, holdDuration);
      }

      // Short gap between keys
      if (i < keys.length - 1) {
        const gap = getHumanDelay(30, 50, "s_group_gap");
        await this.sleep(gap);
      }
    }
  }

  /**
   * Process C key ESCAPE output
   */
  private async processEscapeOutput(
    event: SpecialKeyOutputEvent,
  ): Promise<void> {
    if (this.config.debug) {
      console.log(`[SpecialKey] Escape: ESCAPE`);
    }

    const holdDuration = getHumanKeyDownDuration();
    await this.config.onKeyPress("ESCAPE", holdDuration);

    // Record for pressure monitoring (software mode only)
    if (this.config.backendMode !== "teensy") {
      const pressureMonitor = getQueuePressureMonitor();
      pressureMonitor.recordOutput("C_Escape", "ESCAPE", holdDuration);
    }
  }

  /**
   * Process = key Smash output (handled via gesture, but could be direct)
   */
  private async processSmashOutput(
    event: SpecialKeyOutputEvent,
  ): Promise<void> {
    if (this.config.debug) {
      console.log(`[SpecialKey] Smash: ] (via gesture binding)`);
    }

    const holdDuration = getHumanKeyDownDuration();
    await this.config.onKeyPress("]", holdDuration);

    // Record for pressure monitoring (software mode only)
    if (this.config.backendMode !== "teensy") {
      const pressureMonitor = getQueuePressureMonitor();
      pressureMonitor.recordOutput("Equals_Smash", "]", holdDuration);
    }
  }

  /**
   * Process MIDDLE_CLICK double-tap Max Zoom Out (PAGEDOWN)
   */
  private async processMiddleClickZoomOut(
    event: SpecialKeyOutputEvent,
  ): Promise<void> {
    console.log(`[SpecialKey] Middle Click Zoom Out: PAGEDOWN`);

    const holdDuration = getHumanKeyDownDuration();
    await this.config.onKeyPress("PAGEDOWN", holdDuration);

    // Record for pressure monitoring (software mode only)
    if (this.config.backendMode !== "teensy") {
      const pressureMonitor = getQueuePressureMonitor();
      pressureMonitor.recordOutput(
        "MiddleClick_ZoomOut",
        "PAGEDOWN",
        holdDuration,
      );
    }
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Shutdown the handler
   */
  shutdown(): void {
    this.isShutdown = true;
    this.dStreamActive = false;
    this.pendingQueue = [];
  }
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

/**
 * Options for creating a special key handler
 */
export interface CreateSpecialKeyHandlerOptions {
  debug?: boolean;
  /** Callback to suppress keys in gesture detector (prevents echo) */
  onSuppressKey?: (key: string, durationMs: number) => void;
  /** Backend mode - determines if pressure monitoring is active */
  backendMode?: BackendMode;
  /** Optional Teensy executor for hardware key output */
  teensyExecutor?: TeensyExecutor | null;
}

/**
 * Create a special key handler with RobotJS integration
 */
export async function createSpecialKeyHandler(
  optionsOrDebug?: boolean | CreateSpecialKeyHandlerOptions,
): Promise<SpecialKeyHandler> {
  // Support legacy boolean signature and new options object
  const options: CreateSpecialKeyHandlerOptions =
    typeof optionsOrDebug === "boolean"
      ? { debug: optionsOrDebug }
      : optionsOrDebug || {};
  // Try to import robotjs
  let robot: any;
  try {
    robot = (await import("robotjs")).default;
    robot.setKeyboardDelay(1);
  } catch {
    console.warn("RobotJS not available for special key handler");
    robot = null;
  }

  return new SpecialKeyHandler({
    debug: options.debug,
    onSuppressKey: options.onSuppressKey,
    backendMode: options.backendMode || "software",
    onKeyPress: async (key: string, holdDurationMs: number) => {
      // Map special key names to RobotJS format
      const keyMap: Record<string, string> = {
        // Punctuation keys
        GRAVE: "`",
        BACKSLASH: "\\",
        SLASH: "/",
        MINUS: "-",
        LBRACKET: "[",
        RBRACKET: "]",
        COMMA: ",",
        APOSTROPHE: "'",
        // Navigation/editing keys
        PAGEUP: "pageup",
        PAGEDOWN: "pagedown",
        DELETE: "delete",
        BACKSPACE: "backspace",
        TAB: "tab",
        // Function keys for group member targeting
        F10: "f10",
        F11: "f11",
        F12: "f12",
        INSERT: "insert",
        // Legacy numpad support
        NUMPAD1: "numpad_1",
        NUMPAD2: "numpad_2",
        NUMPAD3: "numpad_3",
        NUMPAD4: "numpad_4",
        NUMPAD5: "numpad_5",
        NUMPAD6: "numpad_6",
        NUMPAD7: "numpad_7",
        NUMPAD8: "numpad_8",
        NUMPAD9: "numpad_9",
        NUMPAD0: "numpad_0",
        NUMPAD_SUBTRACT: "numpad_-",
        NUMPAD_ADD: "numpad_+",
        NUMPAD_MULTIPLY: "numpad_*",
        NUMPAD_DECIMAL: "numpad_.",
        ESCAPE: "escape",
      };

      // Parse modifier+key combos like "CTRL+B" or "SHIFT+Q"
      const parts = key.split("+").map((p) => p.trim());
      const modifiers: string[] = [];
      let baseKey = parts[parts.length - 1];

      // Collect modifiers (all parts except last)
      for (let i = 0; i < parts.length - 1; i++) {
        const m = parts[i].toUpperCase();
        if (m === "CTRL" || m === "CONTROL") modifiers.push("control");
        else if (m === "SHIFT") modifiers.push("shift");
        else if (m === "ALT") modifiers.push("alt");
      }

      // Map the base key
      const robotKey = keyMap[baseKey] || baseKey.toLowerCase();

      // TEENSY PATH: route through hardware executor
      const teensy = options.teensyExecutor;
      if (options.backendMode === "teensy" && teensy) {
        try {
          await teensy.pressKey(robotKey, holdDurationMs, modifiers);
        } catch (error) {
          console.error(`[Teensy] Failed to press key: ${key}`, error);
        }
        return;
      }

      // SOFTWARE PATH: use RobotJS
      if (!robot) {
        console.log(`[MOCK] Key: ${key} (${holdDurationMs}ms)`);
        return;
      }

      try {
        // Press modifiers down first
        for (const mod of modifiers) {
          robot.keyToggle(mod, "down");
        }

        robot.keyToggle(robotKey, "down");
        await new Promise((resolve) => setTimeout(resolve, holdDurationMs));
        robot.keyToggle(robotKey, "up");

        // Release modifiers
        for (const mod of modifiers) {
          robot.keyToggle(mod, "up");
        }
      } catch (error) {
        // Fallback to keyTap with modifiers
        try {
          robot.keyTap(robotKey, modifiers);
        } catch {
          console.error(`Failed to press key: ${key}`);
        }
      }
    },
  });
}

export default SpecialKeyHandler;
