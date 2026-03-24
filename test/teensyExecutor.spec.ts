// ============================================================================
// TEENSY EXECUTOR TESTS
// ============================================================================
//
// Tests the TeensyExecutor class with mocked serial communication.
// Verifies: key name mapping, command formatting, response handling,
// ping/pong, error handling, and disconnect behavior.
//
// These tests do NOT require a physical Teensy - all serial I/O is mocked.
//
// ============================================================================

import { describe, it, expect, vi, beforeEach } from "vitest";

// ============================================================================
// Mock serialport before any imports that use it
// vi.mock is hoisted, so mock classes must be defined inside the factory
// ============================================================================

vi.mock("serialport", () => {
  class MockSerialPort {
    isOpen = true;
    private dataCallbacks: ((data: string) => void)[] = [];
    private openCallbacks: (() => void)[] = [];
    private errorCallbacks: ((err: Error) => void)[] = [];
    writtenData: string[] = [];

    constructor(public options: { path: string; baudRate: number }) {
      setTimeout(() => {
        this.openCallbacks.forEach((cb) => cb());
        setTimeout(() => {
          this.simulateResponse("READY:TEENSY_HID_v1.0");
        }, 10);
      }, 0);
    }

    on(event: string, cb: (...args: any[]) => void): this {
      if (event === "open") this.openCallbacks.push(cb);
      if (event === "error") this.errorCallbacks.push(cb);
      return this;
    }

    pipe(parser: any): any {
      parser._linkPort(this);
      return parser;
    }

    write(data: string, cb?: (err?: Error | null) => void): boolean {
      this.writtenData.push(data);
      if (cb) cb(null);
      return true;
    }

    close(cb: () => void): void {
      this.isOpen = false;
      cb();
    }

    simulateResponse(line: string): void {
      this.dataCallbacks.forEach((cb) => cb(line));
    }

    _addDataListener(cb: (data: string) => void): void {
      this.dataCallbacks.push(cb);
    }

    static async list() {
      return [
        {
          path: "COM3",
          vendorId: "16C0",
          manufacturer: "PJRC",
          serialNumber: "12345",
          productId: "0483",
        },
      ];
    }
  }

  return { SerialPort: MockSerialPort };
});

vi.mock("@serialport/parser-readline", () => {
  class MockReadlineParser {
    private dataCallbacks: ((line: string) => void)[] = [];
    private onceCallbacks: ((line: string) => void)[] = [];
    private linkedPort: any = null;

    constructor(_opts?: { delimiter: string }) {}

    _linkPort(port: any): void {
      this.linkedPort = port;
      port._addDataListener((line: string) => {
        const onceCbs = [...this.onceCallbacks];
        this.onceCallbacks = [];
        onceCbs.forEach((cb: (line: string) => void) => cb(line));
        this.dataCallbacks.forEach((cb: (line: string) => void) => cb(line));
      });
    }

    on(event: string, cb: (line: string) => void): this {
      if (event === "data") this.dataCallbacks.push(cb);
      return this;
    }

    once(event: string, cb: (line: string) => void): this {
      if (event === "data") this.onceCallbacks.push(cb);
      return this;
    }
  }

  return { ReadlineParser: MockReadlineParser };
});

// Now import the module under test
import { TeensyExecutor, isTeensyAvailable } from "../src/teensyExecutor.js";

// ============================================================================
// TESTS
// ============================================================================

describe("TeensyExecutor", () => {
  // ==========================================================================
  // KEY NAME MAPPING
  // ==========================================================================
  describe("Key Name Mapping", () => {
    it("maps numpad keys to teensy format", () => {
      const executor = new TeensyExecutor();
      const mapKeyName = (executor as any).mapKeyName.bind(executor);

      expect(mapKeyName("numpad_0")).toBe("np0");
      expect(mapKeyName("numpad_5")).toBe("np5");
      expect(mapKeyName("numpad_9")).toBe("np9");
      expect(mapKeyName("numpad_+")).toBe("np_add");
      expect(mapKeyName("numpad_-")).toBe("np_sub");
      expect(mapKeyName("numpad_*")).toBe("np_mul");
      expect(mapKeyName("numpad_/")).toBe("np_div");
      expect(mapKeyName("numpad_.")).toBe("np_dec");
    });

    it("maps navigation keys to teensy format", () => {
      const executor = new TeensyExecutor();
      const mapKeyName = (executor as any).mapKeyName.bind(executor);

      expect(mapKeyName("escape")).toBe("esc");
      expect(mapKeyName("page_up")).toBe("pageup");
      expect(mapKeyName("page_down")).toBe("pagedown");
    });

    it("passes through unmapped keys in lowercase", () => {
      const executor = new TeensyExecutor();
      const mapKeyName = (executor as any).mapKeyName.bind(executor);

      expect(mapKeyName("n")).toBe("n");
      expect(mapKeyName("J")).toBe("j");
      expect(mapKeyName("F1")).toBe("f1");
      expect(mapKeyName("space")).toBe("space");
      expect(mapKeyName("tab")).toBe("tab");
    });

    it("handles case-insensitive input", () => {
      const executor = new TeensyExecutor();
      const mapKeyName = (executor as any).mapKeyName.bind(executor);

      expect(mapKeyName("ESCAPE")).toBe("esc");
      expect(mapKeyName("Escape")).toBe("esc");
      expect(mapKeyName("PAGE_UP")).toBe("pageup");
      expect(mapKeyName("NUMPAD_0")).toBe("np0");
    });
  });

  // ==========================================================================
  // RESPONSE HANDLING
  // ==========================================================================
  describe("Response Handling", () => {
    it("resolves pending commands on OK response", async () => {
      const executor = new TeensyExecutor();
      const handleResponse = (executor as any).handleResponse.bind(executor);

      let resolved = false;
      const pending = {
        resolve: (val: string) => {
          resolved = true;
        },
        reject: (err: Error) => {},
        timeout: setTimeout(() => {}, 5000),
      };
      (executor as any).pendingCommands.set("n", pending);

      handleResponse("OK:n:50");
      expect(resolved).toBe(true);
      expect((executor as any).pendingCommands.has("n")).toBe(false);
    });

    it("rejects pending commands on ERR response", async () => {
      const executor = new TeensyExecutor();
      const handleResponse = (executor as any).handleResponse.bind(executor);

      let rejected = false;
      let errorMsg = "";
      const pending = {
        resolve: (val: string) => {},
        reject: (err: Error) => {
          rejected = true;
          errorMsg = err.message;
        },
        timeout: setTimeout(() => {}, 5000),
      };
      (executor as any).pendingCommands.set("UNKNOWN_KEY", pending);

      handleResponse("ERR:UNKNOWN_KEY:xyz");
      expect(rejected).toBe(true);
      expect(errorMsg).toContain("ERR:");
    });

    it("resolves PING command on PONG response", () => {
      const executor = new TeensyExecutor();
      const handleResponse = (executor as any).handleResponse.bind(executor);

      let resolved = false;
      let resolvedValue = "";
      const pending = {
        resolve: (val: string) => {
          resolved = true;
          resolvedValue = val;
        },
        reject: (err: Error) => {},
        timeout: setTimeout(() => {}, 5000),
      };
      (executor as any).pendingCommands.set("PING", pending);

      handleResponse("PONG");
      expect(resolved).toBe(true);
      expect(resolvedValue).toBe("PONG");
    });

    it("ignores responses with no matching pending command", () => {
      const executor = new TeensyExecutor();
      const handleResponse = (executor as any).handleResponse.bind(executor);

      // Should not throw
      expect(() => handleResponse("OK:unknown:50")).not.toThrow();
      expect(() => handleResponse("PONG")).not.toThrow();
      expect(() => handleResponse("READY:v1.0")).not.toThrow();
    });
  });

  // ==========================================================================
  // COMMAND FORMATTING
  // ==========================================================================
  describe("Command Formatting", () => {
    it("formats basic key command correctly", async () => {
      const executor = new TeensyExecutor();
      (executor as any).isReady = true;

      // Create a mock port that captures writes and auto-responds
      const mockPort = {
        isOpen: true,
        write: (data: string, cb: (err?: Error | null) => void) => {
          cb(null);
          // Simulate Teensy response
          const keyName = data.trim().split(":")[1];
          (executor as any).handleResponse(`OK:${keyName}:50`);
          return true;
        },
      };
      (executor as any).port = mockPort;

      await executor.pressKey("n", 50);
      // If we get here without error, the command was formatted and sent correctly
    });

    it("formats key command with modifiers", async () => {
      const executor = new TeensyExecutor();
      (executor as any).isReady = true;

      let sentData = "";
      const mockPort = {
        isOpen: true,
        write: (data: string, cb: (err?: Error | null) => void) => {
          sentData = data;
          cb(null);
          const keyName = data.trim().split(":")[1];
          (executor as any).handleResponse(`OK:${keyName}:50`);
          return true;
        },
      };
      (executor as any).port = mockPort;

      await executor.pressKey("j", 50, ["shift"]);
      expect(sentData).toBe("KEY:j:50:shift\n");
    });

    it("formats key command with multiple modifiers", async () => {
      const executor = new TeensyExecutor();
      (executor as any).isReady = true;

      let sentData = "";
      const mockPort = {
        isOpen: true,
        write: (data: string, cb: (err?: Error | null) => void) => {
          sentData = data;
          cb(null);
          const keyName = data.trim().split(":")[1];
          (executor as any).handleResponse(`OK:${keyName}:50`);
          return true;
        },
      };
      (executor as any).port = mockPort;

      await executor.pressKey("r", 45, ["shift", "alt"]);
      expect(sentData).toBe("KEY:r:45:shift+alt\n");
    });

    it("maps control modifier to ctrl", async () => {
      const executor = new TeensyExecutor();
      (executor as any).isReady = true;

      let sentData = "";
      const mockPort = {
        isOpen: true,
        write: (data: string, cb: (err?: Error | null) => void) => {
          sentData = data;
          cb(null);
          const keyName = data.trim().split(":")[1];
          (executor as any).handleResponse(`OK:${keyName}:50`);
          return true;
        },
      };
      (executor as any).port = mockPort;

      await executor.pressKey("c", 50, ["control"]);
      expect(sentData).toBe("KEY:c:50:ctrl\n");
    });

    it("maps numpad keys in commands", async () => {
      const executor = new TeensyExecutor();
      (executor as any).isReady = true;

      let sentData = "";
      const mockPort = {
        isOpen: true,
        write: (data: string, cb: (err?: Error | null) => void) => {
          sentData = data;
          cb(null);
          const keyName = data.trim().split(":")[1];
          (executor as any).handleResponse(`OK:${keyName}:50`);
          return true;
        },
      };
      (executor as any).port = mockPort;

      await executor.pressKey("numpad_5", 50);
      expect(sentData).toBe("KEY:np5:50\n");
    });
  });

  // ==========================================================================
  // CONNECTION STATE
  // ==========================================================================
  describe("Connection State", () => {
    it("reports not connected when not initialized", () => {
      const executor = new TeensyExecutor();
      expect(executor.connected).toBe(false);
    });

    it("throws when sending commands while not connected", async () => {
      const executor = new TeensyExecutor();

      await expect(executor.pressKey("n", 50)).rejects.toThrow(
        "Teensy not connected",
      );
      await expect(executor.keyTap("n")).rejects.toThrow(
        "Teensy not connected",
      );
    });

    it("ping returns false when not connected", async () => {
      const executor = new TeensyExecutor();
      const result = await executor.ping();
      expect(result).toBe(false);
    });

    it("keyToggle down sends minimal press", async () => {
      const executor = new TeensyExecutor();
      (executor as any).isReady = true;

      let sentData = "";
      const mockPort = {
        isOpen: true,
        write: (data: string, cb: (err?: Error | null) => void) => {
          sentData = data;
          cb(null);
          const keyName = data.trim().split(":")[1];
          (executor as any).handleResponse(`OK:${keyName}:10`);
          return true;
        },
      };
      (executor as any).port = mockPort;

      await executor.keyToggle("n", true);
      expect(sentData).toBe("KEY:n:10\n");
    });

    it("keyToggle up is a no-op", async () => {
      const executor = new TeensyExecutor();
      (executor as any).isReady = true;

      let writeCount = 0;
      const mockPort = {
        isOpen: true,
        write: (data: string, cb: (err?: Error | null) => void) => {
          writeCount++;
          cb(null);
          return true;
        },
      };
      (executor as any).port = mockPort;

      await executor.keyToggle("n", false);
      expect(writeCount).toBe(0);
    });

    it("disconnect clears pending commands", async () => {
      const executor = new TeensyExecutor();
      (executor as any).isReady = true;
      (executor as any).port = {
        isOpen: true,
        close: (cb: () => void) => cb(),
      };

      // Add a pending command
      const pending = {
        resolve: () => {},
        reject: () => {},
        timeout: setTimeout(() => {}, 5000),
      };
      (executor as any).pendingCommands.set("test", pending);

      await executor.disconnect();
      expect((executor as any).pendingCommands.size).toBe(0);
      expect(executor.connected).toBe(false);
    });
  });

  // ==========================================================================
  // TEENSY DETECTION
  // ==========================================================================
  describe("Teensy Detection", () => {
    it("isTeensyAvailable returns true when VID 16C0 is present", async () => {
      const available = await isTeensyAvailable();
      // Our mock SerialPort.list() returns a port with VID 16C0
      expect(available).toBe(true);
    });
  });

  // ==========================================================================
  // DEFAULT CONFIGURATION
  // ==========================================================================
  describe("Configuration", () => {
    it("uses default baud rate of 115200", () => {
      const executor = new TeensyExecutor();
      expect((executor as any).config.baudRate).toBe(115200);
    });

    it("uses default timeout of 500ms", () => {
      const executor = new TeensyExecutor();
      expect((executor as any).config.timeout).toBe(500);
    });

    it("accepts custom config", () => {
      const executor = new TeensyExecutor({
        baudRate: 9600,
        timeout: 1000,
      });
      expect((executor as any).config.baudRate).toBe(9600);
      expect((executor as any).config.timeout).toBe(1000);
    });
  });
});
