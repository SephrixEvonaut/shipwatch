#!/usr/bin/env node
// ============================================================================
// KEY DIAGNOSTIC TOOL - Discover all keys from Azeron/Venus peripherals
// ============================================================================
//
// This tool logs ALL raw key events from node-global-key-listener, including:
// - Key name (as reported by the driver)
// - Scan code (hardware-level key identifier)
// - Virtual key code (Windows VK code)
// - State (DOWN/UP)
//
// Usage: node scripts/keyDiagnostic.mjs
//
// ============================================================================

console.log("🔧 Key Diagnostic Tool - Peripheral Key Discovery");
console.log("================================================\n");

// Track unique keys seen
const seenKeys = new Map(); // name -> { scanCode, vKey, count, firstTimestamp }
const simultaneousKeys = new Set(); // Currently held keys

try {
  const { GlobalKeyboardListener } = await import("node-global-key-listener");

  const listener = new GlobalKeyboardListener();

  console.log("✅ Global keyboard listener initialized");
  console.log("📋 Press keys on your Azeron Cyborg and UTech Venus");
  console.log("📋 Each unique key will be logged with its identifiers");
  console.log("📋 Press Ctrl+C when done to see summary\n");
  console.log("─".repeat(70));
  console.log("");

  listener.addListener((e, down) => {
    const keyName = e.name;
    const scanCode = e.scanCode || "N/A";
    const vKey = e.vKey || "N/A";
    const state = e.state; // "DOWN" or "UP"
    const timestamp = Date.now();

    // Track simultaneous presses
    if (state === "DOWN") {
      simultaneousKeys.add(keyName);
    } else {
      simultaneousKeys.delete(keyName);
    }

    // Log every event with simultaneous key info
    const simultaneous =
      simultaneousKeys.size > 1
        ? ` [SIMULTANEOUS: ${[...simultaneousKeys].join(" + ")}]`
        : "";

    console.log(
      `${state === "DOWN" ? "🔽" : "🔼"} ${state.padEnd(4)} | ` +
        `name="${keyName.padEnd(15)}" | ` +
        `scanCode=${String(scanCode).padEnd(6)} | ` +
        `vKey=${String(vKey).padEnd(6)}` +
        `${simultaneous}`
    );

    // Track unique keys (only on DOWN to avoid double counting)
    if (state === "DOWN") {
      if (!seenKeys.has(keyName)) {
        seenKeys.set(keyName, {
          scanCode,
          vKey,
          count: 1,
          firstTimestamp: timestamp,
        });
        console.log(`   └─ 🆕 NEW KEY DISCOVERED: "${keyName}"`);
      } else {
        const entry = seenKeys.get(keyName);
        entry.count++;
      }
    }
  });

  // Handle Ctrl+C gracefully
  process.on("SIGINT", () => {
    console.log("\n\n" + "═".repeat(70));
    console.log("📊 KEY DISCOVERY SUMMARY");
    console.log("═".repeat(70) + "\n");

    console.log(`Total unique keys discovered: ${seenKeys.size}\n`);

    // KEY_NAME_MAP mirrors inputListener.ts mappings
    const KEY_NAME_MAP = {
      "NUMPAD 8": "NUMPAD8",
      "NUMPAD 4": "NUMPAD4",
      "NUMPAD 5": "NUMPAD5",
      "NUMPAD 6": "NUMPAD6",
      "MOUSE MIDDLE": "MIDDLE_CLICK",
    };

    // Group by what's in INPUT_KEYS vs what's not
    const INPUT_KEYS = [
      "W",
      "A",
      "S",
      "D",
      "B",
      "I",
      "Y",
      "U",
      "T",
      "C",
      "H",
      "P",
      "F2",
      "1",
      "2",
      "3",
      "4",
      "5",
      "6",
      "7",
      "8",
      "9",
      "MIDDLE_CLICK",
    ];

    const recognized = [];
    const unrecognized = [];

    for (const [name, info] of seenKeys) {
      // Apply KEY_NAME_MAP transformation
      const mappedName = KEY_NAME_MAP[name] || name.toUpperCase();
      if (INPUT_KEYS.includes(mappedName)) {
        recognized.push({ name, mappedName, ...info });
      } else {
        unrecognized.push({ name, ...info });
      }
    }

    if (recognized.length > 0) {
      console.log("✅ RECOGNIZED KEYS (in INPUT_KEYS):");
      console.log("─".repeat(60));
      for (const key of recognized) {
        const mapNote =
          key.mappedName !== key.name.toUpperCase()
            ? ` → ${key.mappedName}`
            : "";
        console.log(
          `   ${key.name.padEnd(15)}${mapNote.padEnd(18)} | scanCode=${String(
            key.scanCode
          ).padEnd(6)} | ` +
            `vKey=${String(key.vKey).padEnd(6)} | presses=${key.count}`
        );
      }
      console.log("");
    }

    if (unrecognized.length > 0) {
      console.log("❓ UNRECOGNIZED KEYS (need to add to INPUT_KEYS):");
      console.log("─".repeat(50));
      for (const key of unrecognized) {
        console.log(
          `   ${key.name.padEnd(15)} | scanCode=${String(key.scanCode).padEnd(
            6
          )} | ` + `vKey=${String(key.vKey).padEnd(6)} | presses=${key.count}`
        );
      }
      console.log("");
      console.log("💡 To add these keys, update INPUT_KEYS in src/types.ts");
      console.log(
        "   and add mappings in KEY_NAME_MAP in src/inputListener.ts if needed."
      );
    }

    if (recognized.length > 0 && unrecognized.length === 0) {
      console.log("🎉 All keys are already recognized!");
    }

    console.log("\n👋 Diagnostic complete. Exiting...\n");
    process.exit(0);
  });
} catch (error) {
  console.error(
    "❌ Failed to initialize global keyboard listener:",
    error.message
  );
  console.log("");
  console.log("📦 Install the required package:");
  console.log("   npm install node-global-key-listener");
  process.exit(1);
}
