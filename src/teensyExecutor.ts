// ============================================================================
// TEENSY EXECUTOR - USB HID Keyboard via Teensy 4.0 Serial
// ============================================================================
//
// Sends keypress commands to a Teensy 4.0 over USB serial.
// The Teensy acts as a real USB HID keyboard, eliminating RobotJS SendInput
// competition with mouse movement that causes stutter.
//
// Protocol: "KEY:keyname:duration[:modifiers]"
// Examples: "KEY:n:45", "KEY:j:50:shift", "KEY:m:40:alt"
//
// ============================================================================

import { SerialPort } from "serialport";
import { ReadlineParser } from "@serialport/parser-readline";

interface TeensyConfig {
  baudRate?: number;
  timeout?: number;
}

interface PendingCommand {
  resolve: (value: string) => void;
  reject: (reason: Error) => void;
  timeout: NodeJS.Timeout;
}

export class TeensyExecutor {
  private port: SerialPort | null = null;
  private parser: ReadlineParser | null = null;
  private isReady: boolean = false;
  private pendingCommands: Map<string, PendingCommand> = new Map();
  private config: Required<TeensyConfig>;
  private commandId: number = 0;

  // Reconnect state
  private reconnectInProgress: boolean = false;
  private readonly MAX_RECONNECT_ATTEMPTS = 5;
  private readonly RECONNECT_DELAY_MS = 2000;

  constructor(config: TeensyConfig = {}) {
    this.config = {
      baudRate: config.baudRate ?? 115200,
      timeout: config.timeout ?? 500,
    };
  }

  async connect(): Promise<void> {
    const portPath = await this.findTeensyPort();
    if (!portPath) {
      throw new Error("Teensy not found. Check USB connection.");
    }

    return new Promise((resolve, reject) => {
      // Track whether the promise has settled so runtime handlers
      // don't call reject/resolve on an already-settled promise.
      let settled = false;

      this.port = new SerialPort({
        path: portPath,
        baudRate: this.config.baudRate,
      });

      this.parser = this.port.pipe(new ReadlineParser({ delimiter: "\n" }));

      this.port.on("error", (err) => {
        if (!settled) {
          console.error("[Teensy] Port error:", err.message);
          settled = true;
          reject(err);
        } else {
          // Runtime error after initial connect — trigger reconnect
          console.error("[Teensy] Runtime port error:", err.message);
          this.handleRuntimeDisconnect("Port error: " + err.message);
        }
      });

      // Runtime close event — fires when the USB cable is unplugged mid-session
      this.port.on("close", () => {
        if (settled && this.isReady) {
          console.warn(
            "[Teensy] Port closed unexpectedly — scheduling reconnect",
          );
          this.handleRuntimeDisconnect("Port closed");
        }
      });

      this.parser.on("data", (line: string) => {
        const trimmed = line.trim();
        this.handleResponse(trimmed);
      });

      this.port.on("open", () => {
        console.log("[Teensy] Port opened, waiting for ready signal...");
      });

      // Listen for READY on every line, not just the first one.
      // The Teensy may emit boot text before sending "READY", so
      // parser.once() would miss it if it wasn't the first line.
      const readyTimeout = setTimeout(() => {
        if (!this.isReady && !settled) {
          // Hard fail — never heard anything useful in 5 seconds
          settled = true;
          reject(new Error("Teensy did not send ready signal"));
        }
      }, 5000);

      const assumeReadyTimeout = setTimeout(() => {
        if (!this.isReady) {
          this.isReady = true;
          settled = true;
          clearTimeout(readyTimeout);
          console.log(
            "[Teensy] Assuming ready (timeout — no READY line received)",
          );
          resolve();
        }
      }, 2000);

      const onData = (line: string) => {
        if (!this.isReady && line.includes("READY")) {
          clearTimeout(readyTimeout);
          clearTimeout(assumeReadyTimeout);
          this.isReady = true;
          settled = true;
          this.parser!.removeListener("data", onData);
          console.log("[Teensy] Ready:", line.trim());
          resolve();
        }
      };
      this.parser.on("data", onData);
    });
  }

  /**
   * Called when the port drops unexpectedly after a successful initial connect.
   * Clears pending commands and starts a background reconnect loop.
   */
  private handleRuntimeDisconnect(reason: string): void {
    this.isReady = false;
    this.clearPendingCommands(reason);
    this.port = null;
    this.parser = null;
    this.scheduleReconnect();
  }

  /**
   * Reject all in-flight commands with a given reason and clear the map.
   */
  private clearPendingCommands(reason: string): void {
    for (const [, pending] of this.pendingCommands) {
      clearTimeout(pending.timeout);
      pending.reject(new Error(reason));
    }
    this.pendingCommands.clear();
  }

  /**
   * Background reconnect loop — tries up to MAX_RECONNECT_ATTEMPTS times
   * with RECONNECT_DELAY_MS between each attempt.  Never throws.
   */
  private async scheduleReconnect(): Promise<void> {
    if (this.reconnectInProgress) return;
    this.reconnectInProgress = true;

    for (let attempt = 1; attempt <= this.MAX_RECONNECT_ATTEMPTS; attempt++) {
      console.log(
        `[Teensy] Reconnect attempt ${attempt}/${this.MAX_RECONNECT_ATTEMPTS} (waiting ${this.RECONNECT_DELAY_MS}ms)...`,
      );
      await new Promise<void>((r) => setTimeout(r, this.RECONNECT_DELAY_MS));

      try {
        await this.connect();
        console.log("[Teensy] ✅ Reconnected successfully");
        this.reconnectInProgress = false;
        return;
      } catch (err) {
        console.warn(
          `[Teensy] Reconnect attempt ${attempt} failed: ${(err as Error).message}`,
        );
      }
    }

    console.error(
      "[Teensy] ❌ All reconnect attempts exhausted — running without Teensy until next restart",
    );
    this.reconnectInProgress = false;
  }

  private async findTeensyPort(): Promise<string | null> {
    const ports = await SerialPort.list();

    for (const port of ports) {
      const isTeensy =
        port.vendorId?.toLowerCase() === "16c0" ||
        port.manufacturer?.toLowerCase().includes("teensy") ||
        port.manufacturer?.toLowerCase().includes("pjrc");

      if (isTeensy) {
        console.log(`[Teensy] Found at ${port.path}`);
        return port.path;
      }
    }

    console.log(
      "[Teensy] Available ports:",
      ports.map((p) => ({
        path: p.path,
        manufacturer: p.manufacturer,
        vendorId: p.vendorId,
      })),
    );

    return null;
  }

  private handleResponse(response: string): void {
    if (response.startsWith("OK:") || response.startsWith("ERR:")) {
      const keyMatch = response.match(/^(?:OK|ERR):([^:]+)/);
      if (keyMatch) {
        const key = keyMatch[1];
        const pending = this.pendingCommands.get(key);
        if (pending) {
          clearTimeout(pending.timeout);
          this.pendingCommands.delete(key);
          if (response.startsWith("ERR:")) {
            pending.reject(new Error(response));
          } else {
            pending.resolve(response);
          }
        }
      }
    } else if (response === "PONG") {
      const pending = this.pendingCommands.get("PING");
      if (pending) {
        clearTimeout(pending.timeout);
        this.pendingCommands.delete("PING");
        pending.resolve(response);
      }
    }
  }

  private async sendCommand(
    command: string,
    expectKey?: string,
  ): Promise<string> {
    if (!this.port || !this.isReady) {
      throw new Error("Teensy not connected");
    }

    return new Promise((resolve, reject) => {
      const key = expectKey || command.split(":")[1] || command;

      const timeout = setTimeout(() => {
        this.pendingCommands.delete(key);
        reject(new Error(`Timeout waiting for response to: ${command}`));
      }, this.config.timeout);

      this.pendingCommands.set(key, { resolve, reject, timeout });

      this.port!.write(command + "\n", (err) => {
        if (err) {
          clearTimeout(timeout);
          this.pendingCommands.delete(key);
          reject(err);
        }
      });
    });
  }

  /**
   * Press a key for a given duration with optional modifiers.
   * This is the primary method used by the sequence executor.
   * If Teensy is disconnected and a reconnect is in progress the keypress
   * is silently skipped rather than crashing the app.
   */
  async pressKey(
    key: string,
    durationMs: number = 50,
    modifiers: string[] = [],
  ): Promise<void> {
    if (!this.connected) {
      if (this.reconnectInProgress) {
        console.warn(
          `[Teensy] pressKey(${key}) skipped — reconnect in progress`,
        );
        return;
      }
      throw new Error("Teensy not connected");
    }
    const teensyKey = this.mapKeyName(key);
    let command = `KEY:${teensyKey}:${durationMs}`;

    if (modifiers.length > 0) {
      // Map modifier names to teensy format
      const teensyMods = modifiers.map((m) => {
        if (m === "control") return "ctrl";
        return m;
      });
      command += ":" + teensyMods.join("+");
    }

    await this.sendCommand(command, teensyKey);
  }

  /**
   * Tap a key briefly (50ms default)
   */
  async keyTap(key: string, modifiers: string[] = []): Promise<void> {
    await this.pressKey(key, 50, modifiers);
  }

  /**
   * Toggle a key down or up.
   * NOTE: The Teensy sketch currently only supports press-and-release in one command.
   * For hold-through-next patterns, we send a short press on "down" -
   * full hold/release protocol would need HOLD/RELEASE commands added to the sketch.
   */
  async keyToggle(
    key: string,
    down: boolean,
    modifiers: string[] = [],
  ): Promise<void> {
    if (down) {
      // Send a minimal press to register the key down
      await this.pressKey(key, 10, modifiers);
    }
    // "up" is a no-op since Teensy auto-releases after duration
  }

  /**
   * Ping the Teensy to verify connection
   */
  async ping(): Promise<boolean> {
    try {
      const response = await this.sendCommand("PING", "PING");
      return response === "PONG";
    } catch {
      return false;
    }
  }

  /**
   * Release all currently held keys on the Teensy
   */
  async releaseAll(): Promise<void> {
    try {
      await this.sendCommand("REL", "REL");
    } catch {
      // Ignore errors during cleanup
    }
  }

  /**
   * Map our key names to Teensy-compatible key names
   */
  private mapKeyName(key: string): string {
    const keyMap: Record<string, string> = {
      numpad_0: "np0",
      numpad_1: "np1",
      numpad_2: "np2",
      numpad_3: "np3",
      numpad_4: "np4",
      numpad_5: "np5",
      numpad_6: "np6",
      numpad_7: "np7",
      numpad_8: "np8",
      numpad_9: "np9",
      "numpad_+": "np_add",
      "numpad_-": "np_sub",
      "numpad_*": "np_mul",
      "numpad_/": "np_div",
      "numpad_.": "np_dec",
      escape: "esc",
      page_up: "pageup",
      page_down: "pagedown",
    };

    return keyMap[key.toLowerCase()] || key.toLowerCase();
  }

  /**
   * Disconnect from the Teensy serial port
   */
  async disconnect(): Promise<void> {
    // Clear all pending commands
    for (const [key, pending] of this.pendingCommands) {
      clearTimeout(pending.timeout);
      pending.reject(new Error("Disconnecting"));
    }
    this.pendingCommands.clear();

    if (this.port && this.port.isOpen) {
      return new Promise((resolve) => {
        this.port!.close(() => {
          this.port = null;
          this.parser = null;
          this.isReady = false;
          console.log("[Teensy] Disconnected");
          resolve();
        });
      });
    }
  }

  /**
   * Check if the Teensy is currently connected and ready
   */
  get connected(): boolean {
    return this.isReady && this.port !== null && this.port.isOpen;
  }

  /**
   * List all available serial ports (diagnostic utility)
   */
  static async listPorts(): Promise<void> {
    const ports = await SerialPort.list();
    console.log("Available serial ports:");
    ports.forEach((port) => {
      console.log(
        `  ${port.path}: ${port.manufacturer || "Unknown"} (VID: ${port.vendorId || "N/A"})`,
      );
    });
  }
}

// ============================================================================
// SINGLETON & UTILITY FUNCTIONS
// ============================================================================

let teensyInstance: TeensyExecutor | null = null;

/**
 * Get or create the singleton TeensyExecutor instance
 */
export async function getTeensyExecutor(
  config?: TeensyConfig,
): Promise<TeensyExecutor> {
  if (!teensyInstance) {
    teensyInstance = new TeensyExecutor(config);
    await teensyInstance.connect();
  }
  return teensyInstance;
}

/**
 * Disconnect and clear the singleton instance
 */
export async function disconnectTeensy(): Promise<void> {
  if (teensyInstance) {
    await teensyInstance.disconnect();
    teensyInstance = null;
  }
}

/**
 * Check if a Teensy 4.0 is connected to any serial port
 */
export async function isTeensyAvailable(): Promise<boolean> {
  try {
    const { SerialPort: SP } = await import("serialport");
    const ports = await SP.list();
    return ports.some(
      (port) =>
        port.vendorId?.toLowerCase() === "16c0" ||
        port.manufacturer?.toLowerCase().includes("teensy") ||
        port.manufacturer?.toLowerCase().includes("pjrc"),
    );
  } catch {
    return false;
  }
}
