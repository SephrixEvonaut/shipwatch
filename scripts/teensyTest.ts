#!/usr/bin/env node
// ============================================================================
// TEENSY HARDWARE VALIDATION SCRIPT
// ============================================================================
//
// Run this BEFORE starting the full app to verify your Teensy 4.0 is:
// 1. Detected on USB (VID 16C0 / PJRC)
// 2. Responding to PING/PONG
// 3. Sending keystrokes correctly
// 4. Meeting latency requirements
//
// Usage:
//   npx tsx scripts/teensyTest.ts              # Quick test (ping + detection)
//   npx tsx scripts/teensyTest.ts --full        # Full test (+ key output)
//   npx tsx scripts/teensyTest.ts --latency     # Latency benchmark (100 pings)
//
// IMPORTANT: Close Arduino IDE Serial Monitor before running this!
// Only one program can have the serial port open at a time.
//
// ============================================================================

const args = process.argv.slice(2);
const fullTest = args.includes("--full");
const latencyTest = args.includes("--latency");

async function main() {
  console.log("╔══════════════════════════════════════════════════════╗");
  console.log("║         TEENSY 4.0 HARDWARE VALIDATION TEST         ║");
  console.log("╚══════════════════════════════════════════════════════╝");
  console.log();

  // Step 1: Check if serialport is available
  console.log("━━━ Step 1: Check serialport module ━━━");
  let SerialPort: any;
  let ReadlineParser: any;
  try {
    const sp = await import("serialport");
    SerialPort = sp.SerialPort;
    const rl = await import("@serialport/parser-readline");
    ReadlineParser = rl.ReadlineParser;
    console.log("  ✅ serialport module loaded");
  } catch (err: any) {
    console.log("  ❌ serialport module not found");
    console.log("     Run: npm install serialport");
    process.exit(1);
  }

  // Step 2: List all serial ports
  console.log("\n━━━ Step 2: Scan USB ports ━━━");
  const ports = await SerialPort.list();

  if (ports.length === 0) {
    console.log("  ❌ No serial ports found");
    console.log(
      "     Is the Teensy plugged in via a DATA cable (not charge-only)?",
    );
    process.exit(1);
  }

  console.log(`  Found ${ports.length} port(s):`);
  let teensyPort: any = null;

  for (const port of ports) {
    const isTeensy =
      port.vendorId?.toLowerCase() === "16c0" ||
      port.manufacturer?.toLowerCase().includes("teensy") ||
      port.manufacturer?.toLowerCase().includes("pjrc");

    const icon = isTeensy ? "🟢" : "⚪";
    console.log(
      `  ${icon} ${port.path} - ${port.manufacturer || "Unknown"} (VID: ${port.vendorId || "N/A"}, PID: ${port.productId || "N/A"})`,
    );

    if (isTeensy && !teensyPort) {
      teensyPort = port;
    }
  }

  if (!teensyPort) {
    console.log("\n  ❌ No Teensy (VID 16C0 / PJRC) detected");
    console.log("     Troubleshooting:");
    console.log("     1. Is the Teensy plugged in?");
    console.log("     2. Is Arduino IDE Serial Monitor open? (close it first)");
    console.log("     3. Try a different USB port or cable");
    console.log("     4. Check Device Manager for the Teensy COM port");
    process.exit(1);
  }

  console.log(`\n  ✅ Teensy detected at ${teensyPort.path}`);

  // Step 3: Open serial connection
  console.log("\n━━━ Step 3: Open serial connection ━━━");

  const port = new SerialPort({
    path: teensyPort.path,
    baudRate: 115200,
  });

  const parser = port.pipe(new ReadlineParser({ delimiter: "\n" }));

  // Wait for connection
  await new Promise<void>((resolve, reject) => {
    port.on("open", () => {
      console.log("  ✅ Serial port opened");
      resolve();
    });
    port.on("error", (err: Error) => {
      console.log(`  ❌ Failed to open: ${err.message}`);
      if (err.message.includes("Access denied")) {
        console.log("     Close Arduino IDE Serial Monitor and try again");
      }
      reject(err);
    });
  });

  // Step 4: Wait for READY signal
  console.log("\n━━━ Step 4: Wait for READY signal ━━━");

  const ready = await new Promise<string>((resolve) => {
    const timeout = setTimeout(() => {
      console.log("  ⚠️  No READY signal within 3s (trying PING anyway)");
      resolve("TIMEOUT");
    }, 3000);

    parser.on("data", function readyHandler(line: string) {
      const trimmed = line.trim();
      if (trimmed.includes("READY")) {
        clearTimeout(timeout);
        parser.removeListener("data", readyHandler);
        resolve(trimmed);
      }
    });
  });

  if (ready !== "TIMEOUT") {
    console.log(`  ✅ Received: ${ready}`);
  }

  // Step 5: PING/PONG test
  console.log("\n━━━ Step 5: PING/PONG test ━━━");

  const pingResult = await sendAndWait(port, parser, "PING", "PONG", 1000);
  if (pingResult.success) {
    console.log(`  ✅ PONG received in ${pingResult.latencyMs}ms`);
  } else {
    console.log("  ❌ No PONG response within 1 second");
    console.log("     The sketch may not be uploaded. Check Arduino IDE.");
    cleanup(port);
    process.exit(1);
  }

  // Step 6: Latency benchmark (if requested)
  if (latencyTest) {
    console.log("\n━━━ Step 6: Latency Benchmark (100 pings) ━━━");

    const latencies: number[] = [];
    for (let i = 0; i < 100; i++) {
      const result = await sendAndWait(port, parser, "PING", "PONG", 500);
      if (result.success) {
        latencies.push(result.latencyMs);
      }
      // Small gap between pings
      await sleep(10);
    }

    if (latencies.length > 0) {
      const avg = latencies.reduce((a, b) => a + b, 0) / latencies.length;
      const min = Math.min(...latencies);
      const max = Math.max(...latencies);
      const sorted = [...latencies].sort((a, b) => a - b);
      const p50 = sorted[Math.floor(sorted.length * 0.5)];
      const p95 = sorted[Math.floor(sorted.length * 0.95)];
      const p99 = sorted[Math.floor(sorted.length * 0.99)];

      console.log(`  Successful pings: ${latencies.length}/100`);
      console.log(`  Average latency:  ${avg.toFixed(2)}ms`);
      console.log(`  Min latency:      ${min}ms`);
      console.log(`  Max latency:      ${max}ms`);
      console.log(`  P50:              ${p50}ms`);
      console.log(`  P95:              ${p95}ms`);
      console.log(`  P99:              ${p99}ms`);

      if (avg < 5) {
        console.log("  ✅ Excellent latency - well within requirements");
      } else if (avg < 15) {
        console.log("  ✅ Good latency - acceptable for macro execution");
      } else {
        console.log(
          "  ⚠️  High latency - check USB cable or try different port",
        );
      }
    } else {
      console.log("  ❌ All pings failed");
    }
  }

  // Step 7: Key output test (if --full)
  if (fullTest) {
    console.log("\n━━━ Step 7: Key Output Test ━━━");
    console.log(
      "  ⚠️  This will type characters! Focus a text editor (Notepad).",
    );
    console.log("  Waiting 3 seconds...");
    await sleep(3000);

    // Test basic key
    const keyResult = await sendAndWait(port, parser, "KEY:n:50", "OK:n", 1000);
    if (keyResult.success) {
      console.log(
        `  ✅ KEY:n:50 → ${keyResult.response} (${keyResult.latencyMs}ms)`,
      );
    } else {
      console.log("  ❌ KEY:n:50 failed");
    }

    await sleep(200);

    // Test modified key
    const shiftResult = await sendAndWait(
      port,
      parser,
      "KEY:j:50:shift",
      "OK:j",
      1000,
    );
    if (shiftResult.success) {
      console.log(
        `  ✅ KEY:j:50:shift → ${shiftResult.response} (${shiftResult.latencyMs}ms)`,
      );
    } else {
      console.log("  ❌ KEY:j:50:shift failed");
    }

    await sleep(200);

    // Test release all
    const relResult = await sendAndWait(port, parser, "REL", "OK:REL", 1000);
    if (relResult.success) {
      console.log(
        `  ✅ REL → ${relResult.response} (${relResult.latencyMs}ms)`,
      );
    } else {
      console.log("  ❌ REL failed");
    }

    console.log('\n  Check Notepad: you should see "nJ" typed');
  }

  // Summary
  console.log("\n╔══════════════════════════════════════════════════════╗");
  console.log("║                    TEST COMPLETE                     ║");
  console.log("╠══════════════════════════════════════════════════════╣");
  console.log("║  ✅ Teensy detected and responding                   ║");
  console.log("║                                                      ║");
  console.log("║  Next steps:                                         ║");
  console.log("║  • npm run start:teensy   (run with Teensy backend)  ║");
  console.log("║  • npm run start:software (run with RobotJS backend) ║");
  console.log("╚══════════════════════════════════════════════════════╝");

  cleanup(port);
}

// ============================================================================
// HELPERS
// ============================================================================

interface SendResult {
  success: boolean;
  response: string;
  latencyMs: number;
}

function sendAndWait(
  port: any,
  parser: any,
  command: string,
  expectPrefix: string,
  timeoutMs: number,
): Promise<SendResult> {
  return new Promise((resolve) => {
    const startTime = performance.now();

    const timeout = setTimeout(() => {
      parser.removeListener("data", handler);
      resolve({ success: false, response: "", latencyMs: 0 });
    }, timeoutMs);

    function handler(line: string) {
      const trimmed = line.trim();
      if (trimmed.startsWith(expectPrefix) || trimmed === expectPrefix) {
        clearTimeout(timeout);
        parser.removeListener("data", handler);
        const latencyMs = Math.round(performance.now() - startTime);
        resolve({ success: true, response: trimmed, latencyMs });
      }
    }

    parser.on("data", handler);
    port.write(command + "\n");
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function cleanup(port: any) {
  try {
    if (port && port.isOpen) {
      port.close();
    }
  } catch {
    // Ignore cleanup errors
  }
}

main().catch((err) => {
  console.error("Fatal error:", err.message);
  process.exit(1);
});
