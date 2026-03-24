// ============================================================================
// INPUT LISTENER - Global keyboard/mouse capture
// ============================================================================
//
// This module provides both a test listener (stdin) and a production global
// listener using node-global-key-listener.
//
// INSTALLATION (for production use):
//   npm install node-global-key-listener
//
// The GlobalInputListener will automatically detect if the package is
// available and fall back to stdin mode if not.
//
// ============================================================================

import { InputKey, INPUT_KEYS } from "./types.js";

export interface KeyEvent {
  key: string;
  type: "down" | "up";
  timestamp: number;
}

export interface MouseEvent {
  button: "LEFT_CLICK" | "RIGHT_CLICK" | "MIDDLE_CLICK";
  type: "down" | "up";
  timestamp: number;
}

export type InputCallback = (event: KeyEvent | MouseEvent) => void;

// Key name mapping from node-global-key-listener to our InputKey format
const KEY_NAME_MAP: Record<string, string> = {
  SPACE: "SPACEBAR",
  " ": "SPACEBAR",
  RETURN: "ENTER",
  ESCAPE: "ESCAPE",
  // Azeron joystick keys
  "NUMPAD 4": "NUMPAD4",
  "NUMPAD 5": "NUMPAD5",
  "NUMPAD 6": "NUMPAD6",
  // Semicolon for forward movement (replaces NUMPAD8)
  SEMICOLON: ";",
  OEM_1: ";", // Windows virtual key for semicolon
  // Venus mouse middle click
  "MOUSE MIDDLE": "MIDDLE_CLICK",
  // Equals key variants
  EQUAL: "=",
  EQUALS: "=",
  OEM_PLUS: "=", // Windows virtual key name
  // Group member keys (for config mode)
  F10: "F10",
  F11: "F11",
  F12: "F12",
  INSERT: "INSERT",
  // Letters are already uppercase
};

// Interface for the listener
export interface IInputListener {
  start(): void;
  stop(): void;
  isActive(): boolean;
}

// ============================================================================
// STDIN-BASED INPUT LISTENER (for testing)
// ============================================================================

export class StdinInputListener implements IInputListener {
  private callback: InputCallback;
  private isListening: boolean = false;

  constructor(callback: InputCallback) {
    this.callback = callback;
  }

  start(): void {
    if (this.isListening) return;
    this.isListening = true;

    console.log("\n🎧 Input Listener started (stdin mode - for testing)");
    console.log("   Press keys to test gesture detection");
    console.log("   Press Ctrl+C to exit\n");

    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
      process.stdin.resume();
      process.stdin.setEncoding("utf8");

      process.stdin.on("data", (data: string) => {
        const key = data.toString();

        if (key === "\u0003") {
          console.log("\n👋 Exiting...");
          process.exit();
        }

        const upperKey = key.toUpperCase();

        this.callback({
          key: upperKey,
          type: "down",
          timestamp: Date.now(),
        });

        setTimeout(() => {
          this.callback({
            key: upperKey,
            type: "up",
            timestamp: Date.now(),
          });
        }, 50);
      });
    } else {
      console.log("⚠️  stdin not in TTY mode, using line-based input");
      process.stdin.resume();
      process.stdin.setEncoding("utf8");

      process.stdin.on("data", (data: string) => {
        const key = data.toString().trim().toUpperCase();
        if (!key) return;

        this.callback({ key, type: "down", timestamp: Date.now() });
        setTimeout(() => {
          this.callback({ key, type: "up", timestamp: Date.now() });
        }, 50);
      });
    }
  }

  stop(): void {
    this.isListening = false;
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(false);
    }
    console.log("🛑 Input Listener stopped");
  }

  isActive(): boolean {
    return this.isListening;
  }
}

// ============================================================================
// GLOBAL INPUT LISTENER (using node-global-key-listener)
// ============================================================================

export type HotkeyCallback = (hotkey: string) => void;

/**
 * Modifier state for traffic control
 */
export interface ModifierState {
  shift: boolean;
  alt: boolean;
  ctrl: boolean;
}

export class GlobalInputListener implements IInputListener {
  private callback: InputCallback;
  private isListening: boolean = false;
  private isStopped: boolean = false; // Guard against events after stop
  private listener: any = null;
  private rawEventCallback:
    | ((rawName: string, state: string, rawEvent: any) => void)
    | null = null;
  private hotkeyCallback: HotkeyCallback | null = null;

  // Track current modifier state
  private currentModifierState: ModifierState = {
    shift: false,
    alt: false,
    ctrl: false,
  };

  constructor(callback: InputCallback) {
    this.callback = callback;
  }

  /**
   * Set a callback to receive ALL raw key events (for debugging peripherals)
   */
  setRawEventCallback(
    cb: (rawName: string, state: string, rawEvent: any) => void,
  ): void {
    this.rawEventCallback = cb;
  }

  /**
   * Set a callback for special hotkey combinations (e.g., CTRL+SHIFT+G)
   */
  setHotkeyCallback(cb: HotkeyCallback): void {
    this.hotkeyCallback = cb;
  }

  /**
   * Get current modifier state (for traffic control)
   */
  getModifierState(): ModifierState {
    return { ...this.currentModifierState };
  }

  async start(): Promise<void> {
    if (this.isListening) return;

    try {
      // Dynamic import of node-global-key-listener (optional dependency)
      const { GlobalKeyboardListener } =
        await import("node-global-key-listener");

      this.listener = new GlobalKeyboardListener();

      this.listener.addListener((e: any, down: Record<string, boolean>) => {
        // CRITICAL: Ignore ALL events after stop() is called
        if (this.isStopped) {
          return;
        }

        // Update modifier state from the down record
        this.currentModifierState = {
          shift: !!(down["LEFT SHIFT"] || down["RIGHT SHIFT"]),
          alt: !!(down["LEFT ALT"] || down["RIGHT ALT"]),
          ctrl: !!(down["LEFT CTRL"] || down["RIGHT CTRL"]),
        };

        // If raw event callback is set, forward ALL events for debugging
        if (this.rawEventCallback) {
          this.rawEventCallback(e.name, e.state, e);
        }

        // Check for hotkeys (CTRL+SHIFT+G for config mode)
        if (this.hotkeyCallback && e.state === "DOWN") {
          const ctrlHeld = down["LEFT CTRL"] || down["RIGHT CTRL"];
          const shiftHeld = down["LEFT SHIFT"] || down["RIGHT SHIFT"];

          if (ctrlHeld && shiftHeld && e.name === "G") {
            this.hotkeyCallback("CTRL+SHIFT+G");
            return; // Don't process further
          }

          // ENTER key toggles gesture system pause (for chat typing)
          if (e.name === "RETURN" || e.name === "ENTER") {
            this.hotkeyCallback("ENTER_TOGGLE");
            return; // Don't process further
          }
        }

        // Early exit filter: check if event name is in INPUT_KEYS (saves 80% of processing)
        const keyName = KEY_NAME_MAP[e.name] || e.name;
        const upperName = keyName.toUpperCase();
        if (!INPUT_KEYS.includes(upperName as InputKey)) {
          return; // Ignore keys we don't track
        }

        const eventType = e.state === "DOWN" ? "down" : "up";

        this.callback({
          key: upperName,
          type: eventType,
          timestamp: Date.now(),
        });
      });

      this.isListening = true;
      console.log(
        "\n🎧 Global Input Listener started (node-global-key-listener)",
      );
      console.log("   Listening for global keyboard events...");
      console.log("   Recognized keys:", INPUT_KEYS.slice(0, 18).join(", "));
      console.log("   Press Ctrl+C to exit\n");
    } catch (error: any) {
      console.error("❌ Failed to start global listener:", error.message);
      console.log("");
      console.log(
        "📦 To enable global key capture, install node-global-key-listener:",
      );
      console.log("   npm install node-global-key-listener");
      console.log("");
      console.log(
        "⚠️  Falling back to stdin mode (only works when terminal is focused)",
      );
      console.log("");

      // Fall back to stdin listener
      const fallback = new StdinInputListener(this.callback);
      fallback.start();
      this.isListening = true;
    }
  }

  stop(): void {
    // Set flag FIRST to block any in-flight events immediately
    this.isStopped = true;
    if (this.listener) {
      // GlobalKeyboardListener doesn't have a stop method, it's garbage collected
      this.listener = null;
    }
    this.isListening = false;
    console.log("🛑 Global Input Listener stopped");
  }

  isActive(): boolean {
    return this.isListening;
  }
}

// ============================================================================
// INPUT LISTENER FACTORY
// ============================================================================

export type ListenerMode = "auto" | "global" | "stdin";

export async function createInputListener(
  callback: InputCallback,
  mode: ListenerMode = "auto",
): Promise<IInputListener> {
  if (mode === "stdin") {
    return new StdinInputListener(callback);
  }

  if (mode === "global" || mode === "auto") {
    // Try to create global listener
    try {
      await import("node-global-key-listener");
      return new GlobalInputListener(callback);
    } catch {
      if (mode === "global") {
        console.warn(
          "⚠️  node-global-key-listener not available, install with:",
        );
        console.warn("   npm install node-global-key-listener");
      }
      return new StdinInputListener(callback);
    }
  }

  return new StdinInputListener(callback);
}

// Default export for backward compatibility
export class InputListener implements IInputListener {
  private delegate: IInputListener;
  private callback: InputCallback;
  private initialized: boolean = false;
  private rawEventCallback:
    | ((rawName: string, state: string, rawEvent: any) => void)
    | null = null;
  private hotkeyCallback: HotkeyCallback | null = null;
  private forceStdin: boolean;

  constructor(callback: InputCallback) {
    this.callback = callback;
    this.delegate = new StdinInputListener(callback);
    // Check environment variable to force stdin mode
    this.forceStdin =
      process.env.INPUT_MODE === "stdin" || process.argv.includes("--stdin");
  }

  /**
   * Enable raw event debugging - shows ALL key events including unrecognized ones
   */
  setRawEventCallback(
    cb: (rawName: string, state: string, rawEvent: any) => void,
  ): void {
    this.rawEventCallback = cb;
  }

  /**
   * Set callback for special hotkeys (e.g., CTRL+SHIFT+G for config mode)
   */
  setHotkeyCallback(cb: HotkeyCallback): void {
    this.hotkeyCallback = cb;
  }

  /**
   * Get current modifier state (for traffic control)
   * Returns shift/alt state from the underlying GlobalInputListener
   */
  getModifierState(): ModifierState {
    if (this.delegate instanceof GlobalInputListener) {
      return this.delegate.getModifierState();
    }
    // Stdin mode doesn't track modifiers
    return { shift: false, alt: false, ctrl: false };
  }

  async start(): Promise<void> {
    if (!this.initialized) {
      const mode = this.forceStdin ? "stdin" : "auto";
      this.delegate = await createInputListener(this.callback, mode);
      this.initialized = true;

      // If raw callback was set before start, apply it to the GlobalInputListener
      if (
        this.rawEventCallback &&
        this.delegate instanceof GlobalInputListener
      ) {
        this.delegate.setRawEventCallback(this.rawEventCallback);
      }

      // If hotkey callback was set before start, apply it to the GlobalInputListener
      if (this.hotkeyCallback && this.delegate instanceof GlobalInputListener) {
        this.delegate.setHotkeyCallback(this.hotkeyCallback);
      }
    }

    if ("start" in this.delegate) {
      const startFn = this.delegate.start.bind(this.delegate);
      if (startFn.constructor.name === "AsyncFunction") {
        await startFn();
      } else {
        startFn();
      }
    }
  }

  stop(): void {
    this.delegate.stop();
  }

  isActive(): boolean {
    return this.delegate.isActive();
  }
}
