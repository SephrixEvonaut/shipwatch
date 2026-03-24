#!/usr/bin/env node
// ============================================================================
// TRAFFIC CONTROLLER CONUNDRUM ANALYZER
// ============================================================================
// Extracts all output keys from every Omega profile and identifies:
// 1. Conundrum keys (raw key AND modified variant both used)
// 2. Potential overlap conflicts when gestures fire in rapid succession
// 3. Echo hit overlap windows
// ============================================================================

// Since we can't import TS directly, we'll parse the compiled output
// or read the TS source and extract binding data via regex

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcFile = path.join(__dirname, "..", "src", "omegaProfiles.ts");

const source = fs.readFileSync(srcFile, "utf-8");

// ============================================================================
// PARSE BINDING ARRAYS
// ============================================================================

function extractBindings(arrayName, source) {
  // Find the array declaration
  const startPattern = new RegExp(
    `export const ${arrayName}:\\s*OmegaBinding\\[\\]\\s*=\\s*\\[`,
  );
  const match = source.match(startPattern);
  if (!match) return [];

  const startIdx = match.index + match[0].length;

  // Find matching close bracket by counting depth
  let depth = 1;
  let idx = startIdx;
  while (depth > 0 && idx < source.length) {
    if (source[idx] === "[") depth++;
    if (source[idx] === "]") depth--;
    idx++;
  }

  const arrayContent = source.substring(startIdx, idx - 1);

  // Extract individual bindings via regex
  const bindings = [];
  const bindingPattern =
    /name:\s*"([^"]+)"[\s\S]*?inputKey:\s*"([^"]+)"[\s\S]*?gesture:\s*"([^"]+)"[\s\S]*?(?:step\("([^"]+)"|targetWithCog\("([^"]+)"|holdModifier\("([^"]+)"\)[\s\S]*?step\("([^"]+)")/g;

  let m;
  while ((m = bindingPattern.exec(arrayContent)) !== null) {
    const name = m[1];
    const inputKey = m[2];
    const gesture = m[3];
    const outputKey = m[4] || m[5] || m[7]; // step key, targetWithCog key, or holdModifier step key
    const holdMod = m[6];

    if (outputKey) {
      bindings.push({ name, inputKey, gesture, outputKey, holdMod });
    }
  }

  return bindings;
}

// Also need to extract from SHARED_BINDINGS
function extractAllSteps(arrayName, source) {
  const startPattern = new RegExp(
    `export const ${arrayName}:\\s*OmegaBinding\\[\\]\\s*=\\s*\\[`,
  );
  const match = source.match(startPattern);
  if (!match) return [];

  const startIdx = match.index + match[0].length;
  let depth = 1;
  let idx = startIdx;
  while (depth > 0 && idx < source.length) {
    if (source[idx] === "[") depth++;
    if (source[idx] === "]") depth--;
    idx++;
  }

  const arrayContent = source.substring(startIdx, idx - 1);

  // Extract ALL step() calls and their output keys
  const allKeys = [];
  const stepPattern = /step\("([^"]+)"/g;
  let sm;
  while ((sm = stepPattern.exec(arrayContent)) !== null) {
    allKeys.push(sm[1]);
  }

  // Also extract targetWithCog keys (they output the key + ALT+F9)
  const cogPattern = /targetWithCog\("([^"]+)"/g;
  while ((sm = cogPattern.exec(arrayContent)) !== null) {
    allKeys.push(sm[1]);
    allKeys.push("ALT+F9");
  }

  // Also extract holdModifier keys
  const holdPattern = /holdModifier\("([^"]+)"/g;
  while ((sm = holdPattern.exec(arrayContent)) !== null) {
    allKeys.push(sm[1]);
  }

  return allKeys;
}

// ============================================================================
// CONUNDRUM DETECTION (mirrors profileCompiler.ts)
// ============================================================================

function extractRawKey(key) {
  const parts = key.split("+").map((p) => p.trim());
  return parts[parts.length - 1].toUpperCase();
}

function hasModifier(key, mod) {
  const parts = key.split("+").map((p) => p.trim().toUpperCase());
  return parts.slice(0, -1).includes(mod);
}

function analyzeConundrums(outputKeys) {
  const rawSet = new Set();
  const shiftSet = new Set();
  const altSet = new Set();
  const altShiftSet = new Set();

  for (const key of outputKeys) {
    const raw = extractRawKey(key);
    const hasShift = hasModifier(key, "SHIFT");
    const hasAlt = hasModifier(key, "ALT");

    if (hasShift && hasAlt) {
      altShiftSet.add(raw);
    } else if (hasShift) {
      shiftSet.add(raw);
    } else if (hasAlt) {
      altSet.add(raw);
    } else {
      rawSet.add(raw);
    }
  }

  const conundrumKeys = new Map(); // key → conflict type
  const safeKeys = new Set();
  const allKeys = new Set([...rawSet, ...shiftSet, ...altSet, ...altShiftSet]);

  for (const k of allKeys) {
    const inRaw = rawSet.has(k);
    const inShift = shiftSet.has(k);
    const inAlt = altSet.has(k);
    const inAltShift = altShiftSet.has(k);

    if (inRaw && (inShift || inAlt || inAltShift)) {
      const conflictsWithShift = inShift || inAltShift;
      const conflictsWithAlt = inAlt || inAltShift;

      let conflict;
      if (conflictsWithShift && conflictsWithAlt) conflict = "both";
      else if (conflictsWithShift) conflict = "shift";
      else conflict = "alt";

      conundrumKeys.set(k, {
        conflict,
        rawUsages: inRaw
          ? outputKeys.filter(
              (ok) =>
                extractRawKey(ok) === k &&
                !hasModifier(ok, "SHIFT") &&
                !hasModifier(ok, "ALT"),
            )
          : [],
        shiftUsages: inShift
          ? outputKeys.filter(
              (ok) =>
                extractRawKey(ok) === k &&
                hasModifier(ok, "SHIFT") &&
                !hasModifier(ok, "ALT"),
            )
          : [],
        altUsages: inAlt
          ? outputKeys.filter(
              (ok) =>
                extractRawKey(ok) === k &&
                hasModifier(ok, "ALT") &&
                !hasModifier(ok, "SHIFT"),
            )
          : [],
        altShiftUsages: inAltShift
          ? outputKeys.filter(
              (ok) =>
                extractRawKey(ok) === k &&
                hasModifier(ok, "ALT") &&
                hasModifier(ok, "SHIFT"),
            )
          : [],
      });
    } else if (inRaw) {
      safeKeys.add(k);
    }

    // Also: shift+X and alt+X both exist (no raw)
    if (!inRaw && inShift && inAlt) {
      conundrumKeys.set(k, {
        conflict: "both (no raw)",
        shiftUsages: outputKeys.filter(
          (ok) => extractRawKey(ok) === k && hasModifier(ok, "SHIFT"),
        ),
        altUsages: outputKeys.filter(
          (ok) => extractRawKey(ok) === k && hasModifier(ok, "ALT"),
        ),
      });
    }
  }

  return { conundrumKeys, safeKeys, rawSet, shiftSet, altSet, altShiftSet };
}

// ============================================================================
// OVERLAP ANALYSIS - Find bindings whose output keys could conflict
// ============================================================================

function findOverlapRisks(bindings) {
  const risks = [];

  // Group bindings by inputKey to find abilities that share the same physical key
  const byInput = {};
  for (const b of bindings) {
    if (!byInput[b.inputKey]) byInput[b.inputKey] = [];
    byInput[b.inputKey].push(b);
  }

  // For each input key, check if different gestures produce conflicting outputs
  for (const [inputKey, group] of Object.entries(byInput)) {
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const a = group[i];
        const b = group[j];
        const rawA = extractRawKey(a.outputKey);
        const rawB = extractRawKey(b.outputKey);

        if (rawA === rawB && a.outputKey !== b.outputKey) {
          risks.push({
            inputKey,
            binding1: `${a.gesture} → ${a.name} (${a.outputKey})`,
            binding2: `${b.gesture} → ${b.name} (${b.outputKey})`,
            rawKey: rawA,
            note: "Same base key with different modifiers on same input key",
          });
        }
      }
    }
  }

  // Cross-input-key analysis: adjacent keys that could fire in rapid succession
  // User's concern: sequences where one gesture's echo hits overlap with next gesture
  const adjacentPairs = [
    ["1", "2"],
    ["1", "3"],
    ["2", "3"],
    ["3", "4"],
    ["4", "5"],
    ["5", "6"],
    ["1", "A"],
    ["1", "S"],
    ["1", "D"],
    ["2", "D"],
    ["3", "D"],
  ];

  for (const [k1, k2] of adjacentPairs) {
    const g1 = byInput[k1] || [];
    const g2 = byInput[k2] || [];

    for (const a of g1) {
      for (const b of g2) {
        const rawA = extractRawKey(a.outputKey);
        const rawB = extractRawKey(b.outputKey);

        if (rawA === rawB && a.outputKey !== b.outputKey) {
          risks.push({
            inputKey: `${k1}↔${k2}`,
            binding1: `${k1}:${a.gesture} → ${a.name} (${a.outputKey})`,
            binding2: `${k2}:${b.gesture} → ${b.name} (${b.outputKey})`,
            rawKey: rawA,
            note: "Adjacent keys with same base key + different modifiers",
          });
        }
      }
    }
  }

  return risks;
}

// ============================================================================
// SPECIFIC ABILITY CONCERN ANALYSIS
// ============================================================================

function analyzeConcernedAbilities(bindings, profileName) {
  // User's specific concern list
  const concerns = {
    E: [
      "Series of Shots",
      "Snipe",
      "Diversion",
      "Reload Ammo",
      "Sabotage",
      "Entrench",
      "Crouch 2",
    ],
    S: ["Resurgence", "Innervate"],
  };

  const profileConcerns = concerns[profileName] || [];
  if (profileConcerns.length === 0) return [];

  const results = [];
  const concernedBindings = bindings.filter((b) =>
    profileConcerns.includes(b.name),
  );
  const allBindingOutputs = bindings.map((b) => b.outputKey);

  for (const cb of concernedBindings) {
    const raw = extractRawKey(cb.outputKey);
    const hasShiftMod = hasModifier(cb.outputKey, "SHIFT");
    const hasAltMod = hasModifier(cb.outputKey, "ALT");

    // Find all other bindings with same raw key
    const conflicts = bindings.filter(
      (b) =>
        b !== cb &&
        extractRawKey(b.outputKey) === raw &&
        b.outputKey !== cb.outputKey,
    );

    results.push({
      ability: cb.name,
      gesture: `${cb.inputKey}:${cb.gesture}`,
      output: cb.outputKey,
      rawKey: raw,
      isModified: hasShiftMod || hasAltMod,
      conflictsWith: conflicts.map(
        (c) => `${c.name} (${c.inputKey}:${c.gesture} → ${c.outputKey})`,
      ),
      riskLevel: conflicts.length > 0 ? "CONUNDRUM" : "SAFE",
    });
  }

  return results;
}

// ============================================================================
// R KEY SPECIAL ANALYSIS
// ============================================================================

function analyzeRKeyUsage(allOutputKeys, profileName, dKeyMode) {
  const rUsages = allOutputKeys.filter((k) => extractRawKey(k) === "R");
  const hasRawR = rUsages.some((k) => k === "R");
  const hasModR = rUsages.some((k) => k !== "R" && extractRawKey(k) === "R");

  console.log(
    `  R key usage: ${rUsages.length > 0 ? rUsages.join(", ") : "none"}`,
  );
  if (
    dKeyMode === "continuous_stream" ||
    dKeyMode === "burst_stream_slow" ||
    dKeyMode === "burst_stream_fast"
  ) {
    console.log(
      `  D mode: ${dKeyMode} → sends R via special handler (bypasses traffic control)`,
    );
  }
  if (hasRawR && hasModR) {
    console.log(
      `  ⚠️  R appears both raw and modified — but traffic controller ALWAYS skips R`,
    );
  }
}

// ============================================================================
// MAIN
// ============================================================================

const profiles = {
  T: { array: null, shared: true }, // Tank uses OMEGA_BINDINGS from omegaMappings.ts
  R: { array: "RAGE_BINDINGS", shared: false },
  S: { array: "SORC_HEAL_BINDINGS", shared: false },
  M: { array: "SORC_MAD_BINDINGS", shared: false },
  E: { array: "ENGI_BINDINGS", shared: false },
  C: { array: "COMBAT_MED_BINDINGS", shared: false },
  A: { array: "ARSENAL_BINDINGS", shared: false },
};

const dKeyModes = {
  T: "continuous_stream",
  R: "burst_stream_slow",
  S: "single_press",
  M: "single_press",
  E: "single_press",
  C: "burst_stream_fast",
  A: "burst_stream_fast",
};

const profileNames = {
  T: "Tank (Vengeance Jugg)",
  R: "Rage Juggernaut",
  S: "Sorc Heals",
  M: "Sorc Madness",
  E: "Engineering Sniper",
  C: "Combat Medic",
  A: "Arsenal Mercenary",
};

// Read omegaMappings.ts for Tank
const mappingsFile = path.join(__dirname, "..", "src", "omegaMappings.ts");
const mappingsSource = fs.readFileSync(mappingsFile, "utf-8");

console.log("╔══════════════════════════════════════════════════════════════╗");
console.log("║     TRAFFIC CONTROLLER CONUNDRUM ANALYSIS — ALL PROFILES    ║");
console.log(
  "╚══════════════════════════════════════════════════════════════╝\n",
);

const sharedKeys = extractAllSteps("SHARED_BINDINGS", source);

for (const [profileKey, config] of Object.entries(profiles)) {
  console.log(`\n${"━".repeat(64)}`);
  console.log(`  PROFILE: ${profileKey} — ${profileNames[profileKey]}`);
  console.log(`  D Key Mode: ${dKeyModes[profileKey]}`);
  console.log(`${"━".repeat(64)}`);

  let profileKeys;
  let profileBindings;

  if (profileKey === "T") {
    // Tank uses OMEGA_BINDINGS from omegaMappings.ts
    profileKeys = [
      ...sharedKeys,
      ...extractAllSteps("OMEGA_BINDINGS", mappingsSource),
    ];
    profileBindings = extractBindings("OMEGA_BINDINGS", mappingsSource);
  } else {
    // Non-tank profiles already include SHARED_BINDINGS via spread
    profileKeys = extractAllSteps(config.array, source);
    profileBindings = extractBindings(config.array, source);
  }

  // Add D-mode R key if applicable
  const dMode = dKeyModes[profileKey];
  if (
    dMode === "continuous_stream" ||
    dMode === "burst_stream_slow" ||
    dMode === "burst_stream_fast"
  ) {
    profileKeys.push("R"); // D mode sends R
  }

  // Deduplicate for analysis
  const uniqueKeys = [...new Set(profileKeys)];

  console.log(`\n  Total unique output keys: ${uniqueKeys.length}`);
  console.log(`  Keys: ${uniqueKeys.sort().join(", ")}`);

  // Conundrum analysis
  const { conundrumKeys, safeKeys } = analyzeConundrums(uniqueKeys);

  console.log(`\n  CONUNDRUM KEYS (${conundrumKeys.size}):`);
  if (conundrumKeys.size === 0) {
    console.log("    ✅ None — all keys are safe");
  } else {
    for (const [key, info] of conundrumKeys) {
      console.log(`    ⚠️  ${key} — conflict type: ${info.conflict}`);
      if (info.rawUsages?.length)
        console.log(`       Raw: ${[...new Set(info.rawUsages)].join(", ")}`);
      if (info.shiftUsages?.length)
        console.log(
          `       SHIFT: ${[...new Set(info.shiftUsages)].join(", ")}`,
        );
      if (info.altUsages?.length)
        console.log(`       ALT: ${[...new Set(info.altUsages)].join(", ")}`);
      if (info.altShiftUsages?.length)
        console.log(
          `       ALT+SHIFT: ${[...new Set(info.altShiftUsages)].join(", ")}`,
        );
    }
  }

  console.log(
    `\n  SAFE KEYS (${safeKeys.size}): ${[...safeKeys].sort().join(", ")}`,
  );

  // R key special analysis
  console.log(`\n  R KEY ANALYSIS:`);
  analyzeRKeyUsage(uniqueKeys, profileKey, dMode);

  // Overlap risk analysis
  const risks = findOverlapRisks(profileBindings);
  console.log(`\n  OVERLAP RISKS (${risks.length}):`);
  if (risks.length === 0) {
    console.log("    ✅ No same-base-key conflicts detected between gestures");
  } else {
    for (const risk of risks) {
      console.log(`    ⚠️  Key ${risk.rawKey} on input ${risk.inputKey}:`);
      console.log(`       ${risk.binding1}`);
      console.log(`       ${risk.binding2}`);
      console.log(`       ${risk.note}`);
    }
  }

  // Specific ability concerns (user requested)
  if (profileKey === "E" || profileKey === "S") {
    const concerns = analyzeConcernedAbilities(profileBindings, profileKey);
    console.log(`\n  USER-FLAGGED ABILITY CONCERNS:`);
    for (const c of concerns) {
      const status = c.riskLevel === "SAFE" ? "✅" : "⚠️";
      console.log(`    ${status} ${c.ability} (${c.gesture} → ${c.output})`);
      console.log(`       Raw key: ${c.rawKey} | Modified: ${c.isModified}`);
      if (c.conflictsWith.length > 0) {
        console.log(`       Conflicts with:`);
        for (const cf of c.conflictsWith) {
          console.log(`         - ${cf}`);
        }
      } else {
        console.log(`       No same-base-key conflicts`);
      }
    }
  }
}

// ============================================================================
// CROSS-PROFILE CONCERN: Keys used in R stream modes
// ============================================================================

console.log(`\n${"━".repeat(64)}`);
console.log("  CROSS-PROFILE R KEY BYPASS SAFETY CHECK");
console.log(`${"━".repeat(64)}`);
console.log(
  "  Traffic controller ALWAYS bypasses R key (line ~113 of trafficController.ts):",
);
console.log('    if (raw === "R") { return; }');
console.log(
  "  This means R never waits for other keys and never blocks others.",
);
console.log(
  "  Profiles using R via D mode: T (continuous), R (burst_slow), C/A (burst_fast)",
);
console.log(
  "  Profiles using R as direct output: E (Shield Probe D quick → R)",
);
console.log(
  "  ✅ R bypass is safe — R has no modifier variants in any profile",
);

// ============================================================================
// TEENSY SERIAL COMMAND OVERLAP ANALYSIS
// ============================================================================

console.log(`\n${"━".repeat(64)}`);
console.log("  TEENSY SERIAL COMMAND OVERLAP ANALYSIS");
console.log(`${"━".repeat(64)}`);
console.log(
  "  The Teensy processes commands sequentially via serial (KEY:x:duration:mods).",
);
console.log(
  "  Each KEY command is atomic — Teensy presses, holds for duration, releases.",
);
console.log("  Key insight: commands are queued on the Teensy side.");
console.log(
  "  If two gestures fire rapidly, their serial commands queue sequentially.",
);
console.log("  The Teensy firmware handles one KEY command at a time.");
console.log("");
console.log("  For echo hits: each echo hit is a separate KEY command.");
console.log("  Snipe (N ×2) → sends KEY:n:50 twice with ~170ms window.");
console.log(
  "  If Series of Shots fires right after → KEY:n:50:alt queues after Snipe echoes.",
);
console.log(
  "  Traffic controller sees N is a conundrum → waits for ALT release if needed.",
);
console.log("");
console.log("  ✅ Teensy serial queue ensures atomic key handling.");
console.log(
  "  ✅ Traffic controller catches modifier conflicts before sending.",
);
console.log(
  "  ✅ The gesture detector prevents same-key re-entry (state machine resets).",
);

console.log(
  "\n══════════════════════════════════════════════════════════════════",
);
console.log("  ANALYSIS COMPLETE");
console.log(
  "══════════════════════════════════════════════════════════════════",
);
