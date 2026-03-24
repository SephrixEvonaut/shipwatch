// ============================================================================
// PROFILE LOADER - Load and validate macro profiles from JSON
// ============================================================================
// UPDATED: Now supports calibrated profiles with per-key gesture thresholds

import fs from "fs";
import path from "path";
import {
  MacroProfile,
  MacroBinding,
  GestureSettings,
  SEQUENCE_CONSTRAINTS,
  INPUT_KEYS,
  GESTURE_TYPES,
  InputKey,
  GestureType,
  CompiledProfile,
  OUTPUT_KEYS,
  OutputKey,
} from "./types.js";
import { compileProfile } from "./profileCompiler.js";
import { KeyProfile, CalibratedMacroProfile } from "./calibrationTypes.js";
import { OMEGA_GESTURE_TYPES, OmegaGestureType } from "./omegaTypes.js";

// Default gesture settings (tuned for comfortable human timing)
export const DEFAULT_GESTURE_SETTINGS: GestureSettings = {
  multiPressWindow: 350, // Initial window after first press (ms)
  debounceDelay: 30,
  longPressMin: 520, // 520-860ms = long press
  longPressMax: 860,
  superLongMin: 861, // 861-1300ms = super long press
  superLongMax: 1300,
  // Cancel/nullify threshold: >1300ms
  cancelThreshold: 1301,
};

// Validation errors
interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export class ProfileLoader {
  private profileDir: string;
  private lastCompiled: CompiledProfile | null = null;
  private keyProfiles: Map<string, KeyProfile> = new Map();

  constructor(profileDir: string = "./profiles") {
    this.profileDir = profileDir;
  }

  /**
   * Validate a macro binding
   */
  private validateBinding(
    binding: MacroBinding,
    index: number,
  ): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check trigger exists
    if (!binding.trigger) {
      errors.push(`Binding ${index} "${binding.name}": Missing trigger`);
      return { valid: false, errors, warnings };
    }

    // Check trigger key
    if (!INPUT_KEYS.includes(binding.trigger.key as InputKey)) {
      errors.push(
        `Binding ${index} "${binding.name}": Invalid trigger key "${binding.trigger.key}"`,
      );
    }

    // Check gesture type (accept both Alpha and Omega gesture types)
    const isValidAlphaGesture = GESTURE_TYPES.includes(
      binding.trigger.gesture as GestureType,
    );
    const isValidOmegaGesture = OMEGA_GESTURE_TYPES.includes(
      binding.trigger.gesture as OmegaGestureType,
    );
    if (!isValidAlphaGesture && !isValidOmegaGesture) {
      errors.push(
        `Binding ${index} "${binding.name}": Invalid gesture "${binding.trigger.gesture}"`,
      );
    }

    // Check sequence
    if (!binding.sequence || binding.sequence.length === 0) {
      // Empty sequences are allowed - macro may be a placeholder or disabled
      warnings.push(`Binding ${index} "${binding.name}": Empty sequence`);
    } else {
      // Validate each step
      for (let i = 0; i < binding.sequence.length; i++) {
        const step = binding.sequence[i];

        // Scroll steps, timer-only steps, and delay-only steps don't require a key
        const isScrollStep = step.scrollDirection !== undefined;
        const isTimerOnlyStep = step.timer !== undefined;
        const isDelayOnlyStep =
          (step.minDelay !== undefined || step.maxDelay !== undefined) &&
          !step.key;

        if (
          !step.key &&
          !isScrollStep &&
          !isTimerOnlyStep &&
          !isDelayOnlyStep
        ) {
          errors.push(
            `Binding ${index} "${binding.name}" step ${i}: Missing key`,
          );
        }

        // Only validate minDelay/maxDelay if bufferTier is NOT provided
        // (bufferTier takes precedence over legacy delay settings)
        if (!step.bufferTier) {
          if (
            step.minDelay !== undefined &&
            step.minDelay < SEQUENCE_CONSTRAINTS.MIN_DELAY
          ) {
            errors.push(
              `Binding ${index} "${binding.name}" step ${i}: ` +
                `minDelay ${step.minDelay}ms < ${SEQUENCE_CONSTRAINTS.MIN_DELAY}ms minimum`,
            );
          }

          if (step.minDelay !== undefined && step.maxDelay !== undefined) {
            const variance = step.maxDelay - step.minDelay;
            if (variance < SEQUENCE_CONSTRAINTS.MIN_VARIANCE) {
              errors.push(
                `Binding ${index} "${binding.name}" step ${i}: ` +
                  `variance ${variance}ms < ${SEQUENCE_CONSTRAINTS.MIN_VARIANCE}ms minimum`,
              );
            }
          }
        }

        // Validate dual key fields
        if (step.dualKey !== undefined) {
          // Check if dualKey is in OUTPUT_KEYS
          if (!OUTPUT_KEYS.includes(step.dualKey as OutputKey)) {
            errors.push(
              `Binding ${index} "${binding.name}" step ${i}: ` +
                `Invalid dualKey "${step.dualKey}" - must be a valid OUTPUT_KEY`,
            );
          }

          // Check if dualKey equals primary key (only if step.key exists)
          if (step.key) {
            const primaryKeyNormalized = step.key.toUpperCase();
            const dualKeyNormalized = step.dualKey.toUpperCase();
            if (primaryKeyNormalized === dualKeyNormalized) {
              errors.push(
                `Binding ${index} "${binding.name}" step ${i}: ` +
                  `dualKey "${step.dualKey}" cannot be the same as primary key "${step.key}"`,
              );
            }
          }
        }

        // Validate dualKeyOffsetMs
        if (step.dualKeyOffsetMs !== undefined && step.dualKeyOffsetMs < 1) {
          errors.push(
            `Binding ${index} "${binding.name}" step ${i}: ` +
              `dualKeyOffsetMs must be >= 1ms (got ${step.dualKeyOffsetMs}ms)`,
          );
        }

        // Validate dualKeyDownDuration if provided
        if (step.dualKeyDownDuration !== undefined) {
          const [dmin, dmax] = step.dualKeyDownDuration;
          if (dmin <= 0 || dmax < dmin) {
            errors.push(
              `Binding ${index} "${binding.name}" step ${i}: ` +
                `dualKeyDownDuration must be [min,max] with min>0 and max>=min`,
            );
          }
        }
      }

      // Count unique keys (only steps with keys)
      const uniqueKeys = new Set(
        binding.sequence.filter((s) => s.key).map((s) => s.key),
      );
      if (uniqueKeys.size > SEQUENCE_CONSTRAINTS.MAX_UNIQUE_KEYS) {
        errors.push(
          `Binding ${index} "${binding.name}": ` +
            `${uniqueKeys.size} unique keys > ${SEQUENCE_CONSTRAINTS.MAX_UNIQUE_KEYS} maximum`,
        );
      }

      // Count steps per key
      const keyCounts = new Map<string, number>();
      for (const step of binding.sequence) {
        if (step.key) {
          keyCounts.set(step.key, (keyCounts.get(step.key) || 0) + 1);
        }
      }

      for (const [key, count] of keyCounts) {
        if (count > SEQUENCE_CONSTRAINTS.MAX_STEPS_PER_KEY) {
          errors.push(
            `Binding ${index} "${binding.name}": ` +
              `Key "${key}" used in ${count} steps > ${SEQUENCE_CONSTRAINTS.MAX_STEPS_PER_KEY} maximum`,
          );
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validate a complete profile
   */
  validateProfile(profile: MacroProfile): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!profile.name) {
      errors.push("Profile missing name");
    }

    if (!profile.gestureSettings) {
      warnings.push("Profile missing gestureSettings, using defaults");
    }

    if (!profile.macros || !Array.isArray(profile.macros)) {
      errors.push("Profile missing macros array");
    } else {
      // Validate each binding
      for (let i = 0; i < profile.macros.length; i++) {
        const result = this.validateBinding(profile.macros[i], i);
        errors.push(...result.errors);
        warnings.push(...result.warnings);
      }

      // Check for duplicate triggers
      const triggers = new Set<string>();
      for (const binding of profile.macros) {
        if (!binding.trigger) continue;
        const key = `${binding.trigger.key}:${binding.trigger.gesture}`;
        if (triggers.has(key)) {
          warnings.push(
            `Duplicate trigger: ${binding.trigger.key} + ${binding.trigger.gesture}`,
          );
        }
        triggers.add(key);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Load a profile from JSON file
   * Supports both legacy profiles and calibrated profiles with keyProfiles
   * Also supports Omega-style profiles with 'bindings' instead of 'macros'
   */
  loadProfile(filename: string): MacroProfile | null {
    const filepath = path.join(this.profileDir, filename);

    try {
      const content = fs.readFileSync(filepath, "utf-8");
      const profile = JSON.parse(content) as MacroProfile &
        CalibratedMacroProfile & { bindings?: any[] };

      // Apply default settings if missing
      if (!profile.gestureSettings) {
        profile.gestureSettings = DEFAULT_GESTURE_SETTINGS;
      }

      // Convert Omega-style bindings to standard macros format if needed
      if (!profile.macros && profile.bindings) {
        profile.macros = profile.bindings.map((binding: any) => ({
          name: binding.name,
          trigger: {
            key: binding.inputKey,
            gesture: binding.gesture,
          },
          sequence: binding.sequence || [],
          enabled: binding.enabled !== false,
          actionId: binding.actionId || binding.gcdAbility,
        }));
        console.log(
          `📋 JSON profile: converted ${profile.macros.length} legacy bindings to macros (reference only in Omega mode)`,
        );
      }

      // Ensure macros array exists
      if (!profile.macros) {
        profile.macros = [];
      }

      // Load per-key calibrated profiles if present
      this.keyProfiles.clear();
      if (profile.keyProfiles) {
        for (const [key, keyProfile] of Object.entries(profile.keyProfiles)) {
          this.keyProfiles.set(key, keyProfile as KeyProfile);
        }
        console.log(
          `📏 Loaded ${this.keyProfiles.size} calibrated key profiles`,
        );

        // Log calibration metadata if present
        if (profile.calibratedAt) {
          const calibratedDate = new Date(profile.calibratedAt);
          console.log(`   Calibrated: ${calibratedDate.toLocaleString()}`);
        }
        if (profile.calibrationVersion) {
          console.log(`   Version: ${profile.calibrationVersion}`);
        }

        // Log confidence stats for calibrated keys
        const confidences: number[] = [];
        for (const [key, kp] of this.keyProfiles) {
          if (kp.calibrationData?.confidence) {
            confidences.push(kp.calibrationData.confidence);
          }
        }
        if (confidences.length > 0) {
          const avgConfidence = Math.round(
            confidences.reduce((a, b) => a + b, 0) / confidences.length,
          );
          console.log(`   Avg confidence: ${avgConfidence}%`);
        }
      }

      // Apply default buffer tier based on ability name (A-K = low, L-Z = medium)
      for (const binding of profile.macros) {
        // Extract first letter of ability name
        const firstLetter = binding.name.charAt(0).toUpperCase();

        // Determine default tier for this ability
        let defaultTier: "low" | "medium" | undefined;
        if (firstLetter >= "A" && firstLetter <= "K") {
          defaultTier = "low";
        } else if (firstLetter >= "L" && firstLetter <= "Z") {
          defaultTier = "medium";
        }

        // Apply default tier to steps that don't have explicit bufferTier
        if (defaultTier) {
          for (const step of binding.sequence) {
            if (step.bufferTier === undefined) {
              step.bufferTier = defaultTier;
            }
          }
        }
      }

      // Validate
      const result = this.validateProfile(profile);

      if (result.warnings.length > 0) {
        console.log(`⚠️  Warnings for "${filename}":`);
        result.warnings.forEach((w) => console.log(`   - ${w}`));
      }

      if (!result.valid) {
        console.error(`❌ Errors in "${filename}":`);
        result.errors.forEach((e) => console.error(`   - ${e}`));
        return null;
      }

      console.log(
        `✅ Loaded profile: "${profile.name}" (${profile.macros.length} macros)`,
      );

      // Compile profile once for fast runtime checks
      try {
        const compiled = compileProfile(profile);
        this.lastCompiled = compiled;
        console.log(
          `🔎 Profile compiled: ${compiled.conflictKeys.size} conflict keys`,
        );
      } catch (err) {
        console.warn(`⚠️  Profile compilation failed: ${err}`);
      }

      return profile;
    } catch (error) {
      if (error instanceof SyntaxError) {
        console.error(`❌ Invalid JSON in "${filename}": ${error.message}`);
      } else if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        console.error(`❌ Profile file not found: "${filepath}"`);
      } else {
        console.error(`❌ Error loading "${filename}":`, error);
      }
      return null;
    }
  }

  /**
   * Get the last compiled profile (if any)
   */
  getCompiledProfile(): CompiledProfile | null {
    return this.lastCompiled;
  }

  /**
   * Get loaded key profiles for gesture detector
   */
  getKeyProfiles(): Map<string, KeyProfile> {
    return new Map(this.keyProfiles);
  }

  /**
   * Check if profile has calibration data
   */
  hasCalibrationData(): boolean {
    return this.keyProfiles.size > 0;
  }

  /**
   * Get calibration confidence for a specific key
   */
  getKeyConfidence(key: string): number | null {
    const profile = this.keyProfiles.get(key);
    return profile?.calibrationData?.confidence ?? null;
  }

  /**
   * List all available profiles
   */
  listProfiles(): string[] {
    try {
      if (!fs.existsSync(this.profileDir)) {
        fs.mkdirSync(this.profileDir, { recursive: true });
        return [];
      }

      return fs.readdirSync(this.profileDir).filter((f) => f.endsWith(".json"));
    } catch (error) {
      console.error("❌ Error listing profiles:", error);
      return [];
    }
  }

  /**
   * Save a profile to JSON file
   */
  saveProfile(profile: MacroProfile, filename: string): boolean {
    const filepath = path.join(this.profileDir, filename);

    try {
      // Validate first
      const result = this.validateProfile(profile);
      if (!result.valid) {
        console.error(`❌ Cannot save invalid profile:`);
        result.errors.forEach((e) => console.error(`   - ${e}`));
        return false;
      }

      // Ensure directory exists
      if (!fs.existsSync(this.profileDir)) {
        fs.mkdirSync(this.profileDir, { recursive: true });
      }

      // Write file
      fs.writeFileSync(filepath, JSON.stringify(profile, null, 2), "utf-8");
      console.log(`💾 Saved profile to "${filepath}"`);
      return true;
    } catch (error) {
      console.error(`❌ Error saving profile:`, error);
      return false;
    }
  }
}
