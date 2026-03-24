/**
 * MANIFEST SYNC - YAML ↔ JSON Profile Synchronization
 *
 * This script synchronizes the gesture-manifest.yaml with JSON profile files.
 * Edit the YAML manifest, run this script, and changes propagate to profiles.
 *
 * Usage:
 *   npx ts-node scripts/manifestSync.ts --export    # YAML → JSON
 *   npx ts-node scripts/manifestSync.ts --import    # JSON → YAML
 *   npx ts-node scripts/manifestSync.ts --validate  # Validate YAML only
 */

import * as fs from "fs";
import * as path from "path";
import * as yaml from "yaml";
import { fileURLToPath } from "url";

// ES Module compatibility
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

const GESTURE_TYPES = [
  "single",
  "single_long",
  "single_super_long",
  "double",
  "double_long",
  "double_super_long",
  "triple",
  "triple_long",
  "triple_super_long",
  "quadruple",
  "quadruple_long",
  "quadruple_super_long",
] as const;

type GestureType = (typeof GESTURE_TYPES)[number];

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
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "=",
  "MIDDLE_CLICK",
] as const;

type InputKey = (typeof INPUT_KEYS)[number];

const BUFFER_TIERS = ["low", "medium", "high"] as const;
type BufferTier = (typeof BUFFER_TIERS)[number];

interface SequenceStep {
  key?: string;
  name?: string;
  bufferTier?: BufferTier;
  minDelay?: number;
  maxDelay?: number;
  dualKey?: string;
  dualKeyOffsetMs?: number;
  echoHits?: number;
  keyDownDuration?: [number, number];
  dualKeyDownDuration?: [number, number];
  scrollDirection?: "up" | "down";
  scrollMagnitude?: number;
}

interface MacroBinding {
  name: string;
  trigger: {
    key: InputKey;
    gesture: GestureType;
  };
  sequence: SequenceStep[];
  enabled: boolean;
}

interface GestureSettings {
  multiPressWindow: number;
  debounceDelay: number;
  longPressMin: number;
  longPressMax: number;
  superLongMin: number;
  superLongMax: number;
  cancelThreshold: number;
}

interface MacroProfile {
  name: string;
  description: string;
  gestureSettings: GestureSettings;
  macros: MacroBinding[];
}

interface YamlGestureEntry {
  name: string | null;
  icon?: string;
  discord?: { action: string; level?: string };
  timer?: { tts: string; delay: number };
  focusTarget?: boolean;
  customDelay?: boolean;
  sequence: (string | YamlSequenceStep)[];
}

interface YamlSequenceStep {
  key?: string;
  buffer?: BufferTier;
  dualKey?: string;
  dualKeyOffset?: number;
  delay?: string; // "1200-1210" format
  name?: string; // step name for display
  scrollDirection?: "up" | "down";
  scrollMagnitude?: number;
}

interface ValidationError {
  key: string;
  gesture: string;
  field: string;
  message: string;
  severity: "error" | "warning";
}

// ============================================================================
// PATHS
// ============================================================================

const PROFILES_DIR = path.join(__dirname, "..", "profiles");
const MANIFEST_PATH = path.join(PROFILES_DIR, "gesture-manifest.yaml");
const DEFAULT_PROFILE = "swtor-vengeance-jugg.json";

// ============================================================================
// PARSING UTILITIES
// ============================================================================

/**
 * Parse a sequence step from YAML format to JSON format
 * Handles formats like:
 *   - "N"                           → { key: "N", bufferTier: "low" }
 *   - "L [+6ms→ NUMPAD_MULTIPLY]"   → { key: "L", dualKey: "NUMPAD_MULTIPLY", dualKeyOffsetMs: 6 }
 *   - "SHIFT+R [+6ms→ N]"           → { key: "SHIFT+R", dualKey: "N", dualKeyOffsetMs: 6 }
 */
function parseSequenceStep(
  stepStr: string,
  commentBuffer?: BufferTier,
): SequenceStep {
  const step: SequenceStep = { key: "" };

  // Check for dual key pattern: "KEY [+Xms→ KEY2]"
  const dualKeyMatch = stepStr.match(/^(.+?)\s*\[\+(\d+)ms→\s*(.+?)\]$/);

  if (dualKeyMatch) {
    step.key = dualKeyMatch[1].trim();
    step.dualKeyOffsetMs = parseInt(dualKeyMatch[2], 10);
    step.dualKey = dualKeyMatch[3].trim().replace(/["\[\]]/g, "");
  } else {
    step.key = stepStr.trim();
  }

  // Apply buffer tier from comment if provided
  if (commentBuffer) {
    step.bufferTier = commentBuffer;
  } else {
    step.bufferTier = "low"; // Default
  }

  return step;
}

/**
 * Extract buffer tier from inline YAML comment
 */
function extractBufferFromComment(line: string): BufferTier | undefined {
  const match = line.match(/#\s*(low|medium|high)/i);
  if (match) {
    return match[1].toLowerCase() as BufferTier;
  }
  return undefined;
}

/**
 * Parse custom delay from comment (e.g., "⏱️ 1200-1210ms delay")
 */
function extractCustomDelay(
  line: string,
): { minDelay: number; maxDelay: number } | undefined {
  const match = line.match(/(\d+)-(\d+)ms\s*delay/i);
  if (match) {
    return {
      minDelay: parseInt(match[1], 10),
      maxDelay: parseInt(match[2], 10),
    };
  }
  return undefined;
}

// ============================================================================
// YAML PARSING
// ============================================================================

interface ParsedManifest {
  profile: { name: string; description: string };
  gestureSettings: GestureSettings;
  keys: Map<string, Map<GestureType, YamlGestureEntry>>;
}

function parseManifestYaml(yamlContent: string): ParsedManifest {
  const doc = yaml.parse(yamlContent);

  const result: ParsedManifest = {
    profile: doc.profile || { name: "", description: "" },
    gestureSettings: doc.gestureSettings || {},
    keys: new Map(),
  };

  // Parse each key section
  for (const key of INPUT_KEYS) {
    const keyStr = String(key);
    const keyData = doc[keyStr] || doc[`"${keyStr}"`];

    if (keyData) {
      const gestureMap = new Map<GestureType, YamlGestureEntry>();

      for (const gesture of GESTURE_TYPES) {
        const gestureData = keyData[gesture];
        if (gestureData) {
          gestureMap.set(gesture, {
            name: gestureData.name || null,
            icon: gestureData.icon,
            discord: gestureData.discord,
            timer: gestureData.timer,
            focusTarget: gestureData.focusTarget,
            customDelay: gestureData.customDelay,
            sequence: gestureData.sequence || [],
          });
        }
      }

      result.keys.set(keyStr, gestureMap);
    }
  }

  return result;
}

// ============================================================================
// VALIDATION
// ============================================================================

function validateManifest(manifest: ParsedManifest): ValidationError[] {
  const errors: ValidationError[] = [];

  // Validate gesture settings
  const gs = manifest.gestureSettings;
  if (gs.longPressMin >= gs.longPressMax) {
    errors.push({
      key: "gestureSettings",
      gesture: "",
      field: "longPress",
      message: `longPressMin (${gs.longPressMin}) must be < longPressMax (${gs.longPressMax})`,
      severity: "error",
    });
  }

  if (gs.superLongMin <= gs.longPressMax) {
    errors.push({
      key: "gestureSettings",
      gesture: "",
      field: "superLong",
      message: `superLongMin (${gs.superLongMin}) must be > longPressMax (${gs.longPressMax})`,
      severity: "error",
    });
  }

  // Validate each key/gesture combination
  for (const [key, gestures] of manifest.keys) {
    for (const [gesture, entry] of gestures) {
      // Skip unassigned gestures
      if (!entry.name || entry.name === "~") continue;

      // Validate sequence
      if (entry.sequence.length === 0) {
        errors.push({
          key,
          gesture,
          field: "sequence",
          message: `Gesture "${entry.name}" has no sequence steps`,
          severity: "warning",
        });
      }

      // Validate sequence steps
      for (let i = 0; i < entry.sequence.length; i++) {
        const step = entry.sequence[i];

        // Handle both string and object formats
        if (typeof step === "object" && step !== null) {
          // Scroll steps don't require a key
          const isScrollStep = step.scrollDirection !== undefined;

          // Object format - validate key field (unless scroll step)
          if (!step.key && !isScrollStep) {
            errors.push({
              key,
              gesture,
              field: `sequence[${i}]`,
              message: `Missing 'key' field in sequence step object`,
              severity: "error",
            });
          }
          // Validate buffer tier if present
          if (step.buffer && !BUFFER_TIERS.includes(step.buffer)) {
            errors.push({
              key,
              gesture,
              field: `sequence[${i}].buffer`,
              message: `Invalid buffer tier "${
                step.buffer
              }". Valid: ${BUFFER_TIERS.join(", ")}`,
              severity: "error",
            });
          }
        } else if (typeof step === "string") {
          // String format - parse and validate
          try {
            const parsed = parseSequenceStep(step);
            if (!parsed.key) {
              errors.push({
                key,
                gesture,
                field: `sequence[${i}]`,
                message: `Empty key in sequence step`,
                severity: "error",
              });
            }
          } catch (e) {
            errors.push({
              key,
              gesture,
              field: `sequence[${i}]`,
              message: `Failed to parse sequence step: ${step}`,
              severity: "error",
            });
          }
        } else {
          errors.push({
            key,
            gesture,
            field: `sequence[${i}]`,
            message: `Invalid sequence step type: expected string or object, got ${typeof step}`,
            severity: "error",
          });
        }
      }

      // Validate icon references
      if (entry.icon) {
        const validIcons = ["cog", "gun", "shield", "cog+shield"];
        if (!validIcons.includes(entry.icon)) {
          errors.push({
            key,
            gesture,
            field: "icon",
            message: `Invalid icon "${entry.icon}". Valid: ${validIcons.join(
              ", ",
            )}`,
            severity: "warning",
          });
        }
      }
    }
  }

  return errors;
}

// ============================================================================
// CONVERSION: YAML → JSON
// ============================================================================

/**
 * Parse a sequence step from YAML format (string or object) to JSON SequenceStep
 */
function parseYamlSequenceStep(
  step: string | YamlSequenceStep,
  yamlLines: string[],
): SequenceStep {
  // Handle object format (preferred)
  if (typeof step === "object" && step !== null) {
    const result: SequenceStep = {};

    // Handle scroll steps (no key required)
    if (step.scrollDirection) {
      result.scrollDirection = step.scrollDirection;
      result.scrollMagnitude = step.scrollMagnitude;
      if (step.buffer) {
        result.bufferTier = step.buffer;
      }
      return result;
    }

    // Regular keypress step
    result.key = step.key;

    if (step.buffer) {
      result.bufferTier = step.buffer;
    } else {
      result.bufferTier = "low";
    }

    if (step.dualKey) {
      result.dualKey = step.dualKey;
      result.dualKeyOffsetMs = step.dualKeyOffset || 6;
    }

    if (step.delay) {
      const match = step.delay.match(/(\d+)-(\d+)/);
      if (match) {
        result.minDelay = parseInt(match[1], 10);
        result.maxDelay = parseInt(match[2], 10);
        delete result.bufferTier;
      }
    }

    if (step.name) {
      result.name = step.name;
    }

    return result;
  }

  // Handle string format (legacy/simple)
  const stepStr = String(step);

  // Find the line in YAML to get buffer tier from comment
  let bufferTier: BufferTier = "low";

  for (const line of yamlLines) {
    if (line.includes(stepStr)) {
      const extracted = extractBufferFromComment(line);
      if (extracted) bufferTier = extracted;

      // Check for custom delay
      const customDelay = extractCustomDelay(line);
      if (customDelay) {
        const result = parseSequenceStep(stepStr, undefined);
        result.minDelay = customDelay.minDelay;
        result.maxDelay = customDelay.maxDelay;
        delete result.bufferTier;
        return result;
      }
      break;
    }
  }

  return parseSequenceStep(stepStr, bufferTier);
}

function convertManifestToProfile(
  manifest: ParsedManifest,
  yamlLines: string[],
): MacroProfile {
  const macros: MacroBinding[] = [];

  for (const [key, gestures] of manifest.keys) {
    for (const [gesture, entry] of gestures) {
      // Skip unassigned gestures
      if (!entry.name || entry.name === "~" || entry.sequence.length === 0)
        continue;

      const sequenceSteps: SequenceStep[] = [];

      for (const step of entry.sequence) {
        sequenceSteps.push(parseYamlSequenceStep(step, yamlLines));
      }

      macros.push({
        name: entry.name,
        trigger: {
          key: key as InputKey,
          gesture: gesture,
        },
        sequence: sequenceSteps,
        enabled: true,
      });
    }
  }

  return {
    name: manifest.profile.name,
    description: manifest.profile.description,
    gestureSettings: manifest.gestureSettings,
    macros,
  };
}

// ============================================================================
// CONVERSION: JSON → YAML
// ============================================================================

function convertProfileToManifest(profile: MacroProfile): string {
  const lines: string[] = [];

  // Header
  lines.push(
    "# ═══════════════════════════════════════════════════════════════════════════════════════════════════════",
  );
  lines.push("# SWTOR GESTURE MANIFEST");
  lines.push(`# Profile: ${profile.name}`);
  lines.push(`# Generated: ${new Date().toISOString().split("T")[0]}`);
  lines.push(
    "# ═══════════════════════════════════════════════════════════════════════════════════════════════════════",
  );
  lines.push("#");
  lines.push("# LEGEND");
  lines.push(
    "# ───────────────────────────────────────────────────────────────────────────────────────────────────────",
  );
  lines.push(
    "# BUFFER TIERS:     ▸ low (129-163ms)  ▸ medium (229-263ms)  ▸ high (513-667ms)",
  );
  lines.push(
    "# ICONS:            🎯 cog = ALT+F9   🔫 gun = /   🛡️ shield = \\",
  );
  lines.push(
    "# DUAL KEY:         [key₁ +6ms→ key₂] = Two keys pressed near-simultaneously",
  );
  lines.push(
    "# ═══════════════════════════════════════════════════════════════════════════════════════════════════════",
  );
  lines.push("");

  // Profile section
  lines.push("profile:");
  lines.push(`  name: "${profile.name}"`);
  lines.push(`  description: "${profile.description}"`);
  lines.push("");

  // Gesture settings
  lines.push("gestureSettings:");
  lines.push(`  multiPressWindow: ${profile.gestureSettings.multiPressWindow}`);
  lines.push(`  debounceDelay: ${profile.gestureSettings.debounceDelay}`);
  lines.push(`  longPressMin: ${profile.gestureSettings.longPressMin}`);
  lines.push(`  longPressMax: ${profile.gestureSettings.longPressMax}`);
  lines.push(`  superLongMin: ${profile.gestureSettings.superLongMin}`);
  lines.push(`  superLongMax: ${profile.gestureSettings.superLongMax}`);
  lines.push(`  cancelThreshold: ${profile.gestureSettings.cancelThreshold}`);
  lines.push("");

  // Group macros by key
  const macrosByKey = new Map<string, Map<GestureType, MacroBinding>>();
  for (const macro of profile.macros) {
    const key = macro.trigger.key;
    if (!macrosByKey.has(key)) {
      macrosByKey.set(key, new Map());
    }
    macrosByKey.get(key)!.set(macro.trigger.gesture, macro);
  }

  // Output each key
  for (const key of INPUT_KEYS) {
    lines.push(
      "# ═══════════════════════════════════════════════════════════════════════════════════════════════════════",
    );
    lines.push(`#  KEY: ${key}`);
    lines.push(
      "# ═══════════════════════════════════════════════════════════════════════════════════════════════════════",
    );
    lines.push("");
    lines.push(`"${key}":`);

    const gestures = macrosByKey.get(key) || new Map();

    for (const gesture of GESTURE_TYPES) {
      const macro = gestures.get(gesture);

      lines.push(`  ${gesture}:`);

      if (!macro) {
        lines.push(
          "    name: ~                                         # ── NOT ASSIGNED ──",
        );
        lines.push("    sequence: []");
      } else {
        lines.push(`    name: "${macro.name}"`);

        if (macro.sequence.length === 0) {
          lines.push("    sequence: []");
        } else {
          lines.push("    sequence:");
          for (const step of macro.sequence) {
            // Use structured object format for reliable parsing
            let stepParts: string[] = [];
            stepParts.push(`key: "${step.key}"`);

            // Buffer tier
            if (step.bufferTier) {
              stepParts.push(`buffer: ${step.bufferTier}`);
            }

            // Dual key
            if (step.dualKey) {
              stepParts.push(`dualKey: "${step.dualKey}"`);
              stepParts.push(`dualKeyOffset: ${step.dualKeyOffsetMs || 6}`);
            }

            // Custom delay
            if (step.minDelay !== undefined && step.maxDelay !== undefined) {
              stepParts.push(`delay: "${step.minDelay}-${step.maxDelay}"`);
            }

            // Step name
            if (step.name) {
              stepParts.push(`name: "${step.name}"`);
            }

            lines.push(`      - { ${stepParts.join(", ")} }`);
          }
        }
      }
      lines.push("");
    }
  }

  lines.push(
    "# ═══════════════════════════════════════════════════════════════════════════════════════════════════════",
  );
  lines.push("# END OF MANIFEST");
  lines.push(
    "# ═══════════════════════════════════════════════════════════════════════════════════════════════════════",
  );

  return lines.join("\n");
}

// ============================================================================
// FILE I/O
// ============================================================================

function readManifest(): { content: string; lines: string[] } {
  const content = fs.readFileSync(MANIFEST_PATH, "utf-8");
  return { content, lines: content.split("\n") };
}

function writeManifest(content: string): void {
  fs.writeFileSync(MANIFEST_PATH, content, "utf-8");
}

function readProfile(filename: string = DEFAULT_PROFILE): MacroProfile {
  const filepath = path.join(PROFILES_DIR, filename);
  const content = fs.readFileSync(filepath, "utf-8");
  return JSON.parse(content);
}

function writeProfile(
  profile: MacroProfile,
  filename: string = DEFAULT_PROFILE,
): void {
  const filepath = path.join(PROFILES_DIR, filename);
  const content = JSON.stringify(profile, null, 2);
  fs.writeFileSync(filepath, content, "utf-8");
}

// ============================================================================
// MAIN COMMANDS
// ============================================================================

function exportToProfile(): void {
  console.log("📤 Exporting YAML manifest → JSON profile...\n");

  try {
    const { content, lines } = readManifest();
    const manifest = parseManifestYaml(content);

    // Validate
    console.log("🔍 Validating manifest...");
    const errors = validateManifest(manifest);

    const criticalErrors = errors.filter((e) => e.severity === "error");
    const warnings = errors.filter((e) => e.severity === "warning");

    if (warnings.length > 0) {
      console.log(`\n⚠️  ${warnings.length} warning(s):`);
      for (const w of warnings) {
        console.log(`   [${w.key}:${w.gesture}] ${w.field}: ${w.message}`);
      }
    }

    if (criticalErrors.length > 0) {
      console.log(`\n❌ ${criticalErrors.length} error(s) - cannot export:`);
      for (const e of criticalErrors) {
        console.log(`   [${e.key}:${e.gesture}] ${e.field}: ${e.message}`);
      }
      process.exit(1);
    }

    // Convert
    console.log("\n🔄 Converting manifest to profile...");
    const profile = convertManifestToProfile(manifest, lines);

    // Backup existing profile
    const backupPath = path.join(PROFILES_DIR, `${DEFAULT_PROFILE}.backup`);
    if (fs.existsSync(path.join(PROFILES_DIR, DEFAULT_PROFILE))) {
      fs.copyFileSync(path.join(PROFILES_DIR, DEFAULT_PROFILE), backupPath);
      console.log(`💾 Backup saved to: ${backupPath}`);
    }

    // Write
    writeProfile(profile);

    console.log(
      `\n✅ Exported ${profile.macros.length} macros to ${DEFAULT_PROFILE}`,
    );
    console.log("   Profile updated successfully!");
  } catch (err) {
    console.error("\n❌ Export failed:", err);
    process.exit(1);
  }
}

function importFromProfile(): void {
  console.log("📥 Importing JSON profile → YAML manifest...\n");

  try {
    const profile = readProfile();

    console.log(`🔄 Converting ${profile.macros.length} macros...`);
    const yamlContent = convertProfileToManifest(profile);

    // Backup existing manifest
    const backupPath = MANIFEST_PATH + ".backup";
    if (fs.existsSync(MANIFEST_PATH)) {
      fs.copyFileSync(MANIFEST_PATH, backupPath);
      console.log(`💾 Backup saved to: ${backupPath}`);
    }

    writeManifest(yamlContent);

    console.log(`\n✅ Imported to gesture-manifest.yaml`);
  } catch (err) {
    console.error("\n❌ Import failed:", err);
    process.exit(1);
  }
}

function validateOnly(): void {
  console.log("🔍 Validating YAML manifest...\n");

  try {
    const { content } = readManifest();
    const manifest = parseManifestYaml(content);
    const errors = validateManifest(manifest);

    const criticalErrors = errors.filter((e) => e.severity === "error");
    const warnings = errors.filter((e) => e.severity === "warning");

    // Count assigned gestures
    let assignedCount = 0;
    let unassignedCount = 0;
    for (const [, gestures] of manifest.keys) {
      for (const [, entry] of gestures) {
        if (entry.name && entry.name !== "~") {
          assignedCount++;
        } else {
          unassignedCount++;
        }
      }
    }

    console.log("📊 Manifest Summary:");
    console.log(`   Keys: ${manifest.keys.size}`);
    console.log(`   Assigned gestures: ${assignedCount}`);
    console.log(`   Unassigned slots: ${unassignedCount}`);
    console.log("");

    if (warnings.length > 0) {
      console.log(`⚠️  ${warnings.length} warning(s):`);
      for (const w of warnings) {
        console.log(`   [${w.key}:${w.gesture}] ${w.field}: ${w.message}`);
      }
      console.log("");
    }

    if (criticalErrors.length > 0) {
      console.log(`❌ ${criticalErrors.length} error(s):`);
      for (const e of criticalErrors) {
        console.log(`   [${e.key}:${e.gesture}] ${e.field}: ${e.message}`);
      }
      process.exit(1);
    }

    console.log("✅ Manifest is valid!");
  } catch (err) {
    console.error("\n❌ Validation failed:", err);
    process.exit(1);
  }
}

// ============================================================================
// CLI
// ============================================================================

const args = process.argv.slice(2);

if (args.includes("--export") || args.includes("-e")) {
  exportToProfile();
} else if (args.includes("--import") || args.includes("-i")) {
  importFromProfile();
} else if (args.includes("--validate") || args.includes("-v")) {
  validateOnly();
} else {
  console.log(`
MANIFEST SYNC - YAML ↔ JSON Profile Synchronization

Usage:
  npx ts-node scripts/manifestSync.ts [command]

Commands:
  --export, -e     Export YAML manifest → JSON profile
  --import, -i     Import JSON profile → YAML manifest  
  --validate, -v   Validate YAML manifest only

Examples:
  npx ts-node scripts/manifestSync.ts --validate
  npx ts-node scripts/manifestSync.ts --export
  `);
}
