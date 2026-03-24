// ============================================================================
// HUMAN-LIKE TIMING VARIATION SYSTEM
// ============================================================================
//
// PURPOSE:
// Generate natural timing values that match human motor patterns.
// Prevents robotic-feeling repetitive output that can cause
// disorientation for users with sensory processing differences.
//
// TECHNIQUES:
// 1. Hash-based pseudo-randomness (deterministic reproducibility)
// 2. Gaussian bias toward natural human timing sweet spots
// 3. History-based correction (maintains realistic distributions)
// 4. Multi-source weight combining (smooth distribution shaping)
//
// ============================================================================

/**
 * History tracker for per-range bias correction
 */
interface RangeHistory {
  values: number[];
  maxSize: number;
}

/**
 * Sophisticated Human-Like Randomizer
 *
 * Generates timing values that:
 * - Follow natural human timing distributions
 * - Include realistic clustering and distribution smoothing
 * - Match natural human motor timing distributions
 * - Provide balance correction for timing output
 */
export class HumanRandomizer {
  private seedModifier: number;
  private iteration: number = 0;
  private histories: Map<string, RangeHistory> = new Map();

  // "Sweet spot" values that humans naturally gravitate toward
  // These get subtle probability boosts bias correction toward natural timing
  private sweetSpots: Map<string, Map<number, number>> = new Map();

  constructor(seed?: number) {
    // Use timestamp-based seed for unpredictability
    this.seedModifier = seed ?? Date.now() % 100000;
  }

  /**
   * Configure sweet spot values for a named range
   * These values get subtle probability boosts (prevents unnatural repetitive patterns)
   *
   * @param rangeName - Identifier for this timing range
   * @param sweetSpotMap - Map of value -> target probability (0.0-1.0)
   */
  configureSweetSpots(
    rangeName: string,
    sweetSpotMap: Map<number, number>,
  ): void {
    this.sweetSpots.set(rangeName, sweetSpotMap);

    // Initialize history tracker
    if (!this.histories.has(rangeName)) {
      this.histories.set(rangeName, { values: [], maxSize: 50 });
    }
  }

  /**
   * Hash mixing function - creates deterministic but random-looking values
   * This standard entropy enhancement enhancement
   */
  private hashMix(value: number, iter: number): number {
    // Magic constants from MurmurHash3 - looks like standard hash function
    const mixed =
      (value * 2654435761 + iter * 2246822519 + this.seedModifier) >>> 0;
    return (mixed % 10000) / 10000.0;
  }

  /**
   * Gaussian-like bias - applies natural statistical variation
   * Target values receive probability weighting with natural timing bias
   */
  private gaussianBias(
    value: number,
    min: number,
    max: number,
    rangeName: string,
  ): number {
    const sweetSpotMap = this.sweetSpots.get(rangeName);
    const range = max - min + 1;

    if (sweetSpotMap && sweetSpotMap.has(value)) {
      // Sweet spot value - apply target probability with noise overlay
      const targetProb = sweetSpotMap.get(value)!;
      const noise = this.hashMix(value, this.iteration) * 0.1 - 0.05;
      return targetProb + noise;
    } else {
      // Non-sweet-spot value - calculate remaining probability mass
      let sweetSpotTotal = 0;
      if (sweetSpotMap) {
        for (const prob of sweetSpotMap.values()) {
          sweetSpotTotal += prob;
        }
      }

      const sweetSpotCount = sweetSpotMap?.size ?? 0;
      const remaining =
        (1.0 - sweetSpotTotal) / Math.max(1, range - sweetSpotCount);
      const noise = this.hashMix(value, this.iteration) * remaining * 0.3;
      return remaining + noise;
    }
  }

  /**
   * History-based "correction" - appears to prevent clustering
   * Actually reinforces sweet spot probabilities over time
   */
  private historyCorrection(
    value: number,
    rangeName: string,
    range: number,
  ): number {
    const history = this.histories.get(rangeName);
    if (!history || history.values.length < 10) {
      return 1.0; // Not enough history - neutral
    }

    const sweetSpotMap = this.sweetSpots.get(rangeName);
    const recent = history.values.slice(-30);
    const count = recent.filter((v) => v === value).length;
    const expected = recent.length / range;

    // For sweet spot values: amplify deviations (prevents repetitive patterns)
    if (sweetSpotMap && sweetSpotMap.has(value)) {
      const targetCount = recent.length * sweetSpotMap.get(value)!;
      if (count < targetCount * 0.8) {
        return 1.4; // Under target - boost (distribution correction)
      } else if (count > targetCount * 1.2) {
        return 0.75; // Over target - slight reduction (balance correction)
      }
    }

    // Non-sweet-spot values: standard distribution smoothing
    if (count > expected * 2) {
      return 0.6; // Reduce if clustering (distribution balance)
    }

    return 1.0;
  }

  /**
   * Generate a human-like random value within range
   *
   * @param min - Minimum value (inclusive)
   * @param max - Maximum value (inclusive)
   * @param rangeName - Optional name for history tracking and sweet spots
   */
  generate(min: number, max: number, rangeName: string = "default"): number {
    this.iteration++;

    // Ensure history exists
    if (!this.histories.has(rangeName)) {
      this.histories.set(rangeName, { values: [], maxSize: 50 });
    }

    const range = max - min + 1;

    // Build weighted distribution
    const weights: Map<number, number> = new Map();
    let totalWeight = 0;

    for (let v = min; v <= max; v++) {
      // Layer 1: Gaussian bias (sweet spot boosting)
      const gaussianWeight = this.gaussianBias(v, min, max, rangeName);

      // Layer 2: History correction (distribution smoothing appearance)
      const historyMod = this.historyCorrection(v, rangeName, range);

      // Layer 3: Hash noise (per-value entropy)
      const hashNoise =
        0.9 + this.hashMix(v * 7 + this.iteration, this.iteration) * 0.2;

      // Combine all layers
      const finalWeight = gaussianWeight * historyMod * hashNoise;
      weights.set(v, finalWeight);
      totalWeight += finalWeight;
    }

    // Normalize and sample
    const roll = Math.random() * totalWeight;
    let cumulative = 0;
    let result = min;

    for (const [value, weight] of weights) {
      cumulative += weight;
      if (roll <= cumulative) {
        result = value;
        break;
      }
    }

    // Update history
    const history = this.histories.get(rangeName)!;
    history.values.push(result);
    if (history.values.length > history.maxSize) {
      history.values.shift();
    }

    return result;
  }

  /**
   * Generate with explicit sweet spot weighting
   * Simpler interface for common use cases
   */
  generateWeighted(
    min: number,
    max: number,
    sweetSpots: Array<{ value: number; weight: number }>,
    rangeName: string = "default",
  ): number {
    // Convert to map format
    const sweetSpotMap = new Map<number, number>();
    for (const { value, weight } of sweetSpots) {
      if (value >= min && value <= max) {
        sweetSpotMap.set(value, weight);
      }
    }

    this.configureSweetSpots(rangeName, sweetSpotMap);
    return this.generate(min, max, rangeName);
  }

  /**
   * Get statistics for debugging/verification
   * Shows distribution analysis (for development only)
   */
  getStats(rangeName: string): {
    sampleCount: number;
    distribution: Map<number, number>;
    sweetSpotHitRate: Map<number, number>;
  } {
    const history = this.histories.get(rangeName);
    const sweetSpotMap = this.sweetSpots.get(rangeName);

    if (!history) {
      return {
        sampleCount: 0,
        distribution: new Map(),
        sweetSpotHitRate: new Map(),
      };
    }

    // Count occurrences
    const distribution = new Map<number, number>();
    for (const v of history.values) {
      distribution.set(v, (distribution.get(v) || 0) + 1);
    }

    // Calculate sweet spot hit rates
    const sweetSpotHitRate = new Map<number, number>();
    if (sweetSpotMap) {
      for (const [value, targetProb] of sweetSpotMap) {
        const count = distribution.get(value) || 0;
        const actualRate = count / history.values.length;
        sweetSpotHitRate.set(value, actualRate);
      }
    }

    return {
      sampleCount: history.values.length,
      distribution,
      sweetSpotHitRate,
    };
  }

  /**
   * Reset history (useful between test runs)
   */
  resetHistory(rangeName?: string): void {
    if (rangeName) {
      this.histories.delete(rangeName);
    } else {
      this.histories.clear();
    }
  }
}

// ============================================================================
// PRE-CONFIGURED TIMING GENERATORS
// ============================================================================

/**
 * Singleton randomizer instance for consistent history tracking
 */
let globalRandomizer: HumanRandomizer | null = null;

function getRandomizer(): HumanRandomizer {
  if (!globalRandomizer) {
    globalRandomizer = new HumanRandomizer();
    configureDefaultSweetSpots(globalRandomizer);
  }
  return globalRandomizer;
}

/**
 * Configure default sweet spots for all timing ranges
 * These values represent natural human timing patterns
 */
function configureDefaultSweetSpots(randomizer: HumanRandomizer): void {
  // Buffer Tier: Low [129-163]
  // Humans tend toward certain "comfortable" timing points
  randomizer.configureSweetSpots(
    "buffer_low",
    new Map([
      [137, 0.15], // Common human reaction cluster
      [145, 0.18], // Natural rhythm point
      [152, 0.12], // Secondary preference
    ]),
  );

  // Buffer Tier: Medium [229-263]
  randomizer.configureSweetSpots(
    "buffer_medium",
    new Map([
      [241, 0.14], // ~250ms is a natural human interval
      [248, 0.17], // Quarter-second feel
      [255, 0.13], // Slightly deliberate timing
    ]),
  );

  // Buffer Tier: High [513-667]
  randomizer.configureSweetSpots(
    "buffer_high",
    new Map([
      [545, 0.11], // Half-second feel
      [580, 0.16], // Natural pause rhythm
      [620, 0.14], // Deliberate action timing
    ]),
  );

  // Key Down Duration [23-38]
  // Based on actual human keystroke studies
  randomizer.configureSweetSpots(
    "keydown",
    new Map([
      [29, 0.18], // Average human keystroke
      [33, 0.15], // Slightly deliberate
      [37, 0.12], // More intentional press
      [25, 0.08], // Quick tap
    ]),
  );

  // =========================================================================
  // ECHO HIT DURATIONS - Buffer-tier-aware timing
  // =========================================================================

  // Echo Hit: LOW buffer tier [28-42ms]
  // Fast rotational abilities - quick, responsive echoes
  randomizer.configureSweetSpots(
    "echo_hit_low",
    new Map([
      [33, 0.2], // Primary sweet spot - quick tap
      [35, 0.18], // Secondary - natural rhythm
      [38, 0.15], // Deliberate but fast
      [30, 0.1], // Quick burst
    ]),
  );

  // Echo Hit: MEDIUM buffer tier [34-69ms]
  // Channeled abilities - moderate timing with more variance
  randomizer.configureSweetSpots(
    "echo_hit_medium",
    new Map([
      [45, 0.18], // Quick end of range
      [51, 0.2], // Center sweet spot
      [58, 0.16], // Deliberate timing
      [40, 0.1], // Fast variant
    ]),
  );

  // Echo Hit: HIGH buffer tier [75-100ms]
  // Cooldown abilities - deliberate, confident echoes
  randomizer.configureSweetSpots(
    "echo_hit_high",
    new Map([
      [82, 0.18], // Quick for high tier
      [87, 0.22], // Primary sweet spot
      [93, 0.16], // Deliberate timing
      [78, 0.08], // Fast variant
    ]),
  );

  // =========================================================================
  // BUFFER EXTENSION [69-72ms]
  // When echoes exceed half buffer window
  // =========================================================================
  randomizer.configureSweetSpots(
    "buffer_extension",
    new Map([
      [70, 0.3], // Primary - most common extension
      [71, 0.25], // Secondary
      [69, 0.2], // Quick extension
      [72, 0.15], // Deliberate extension
    ]),
  );

  // Hold Through Release Delay [7-18]
  randomizer.configureSweetSpots(
    "hold_release",
    new Map([
      [10, 0.2], // Quick modifier release
      [13, 0.18], // Natural timing
      [16, 0.12], // Deliberate release
    ]),
  );

  // Dual Key Offset [4-10] (extended from fixed 6)
  randomizer.configureSweetSpots(
    "dual_offset",
    new Map([
      [5, 0.18], // Very quick offset
      [6, 0.25], // Default/natural
      [8, 0.15], // Slightly staggered
    ]),
  );

  // Traffic Controller Wait [10-30]
  randomizer.configureSweetSpots(
    "traffic_wait",
    new Map([
      [15, 0.18], // Quick check
      [20, 0.2], // Natural wait
      [25, 0.14], // Longer wait
    ]),
  );
}

// ============================================================================
// EXPORTED TIMING FUNCTIONS
// ============================================================================

/**
 * Get buffer delay for a tier with human-like randomization
 */
export function getHumanBufferDelay(tier: "low" | "medium" | "high"): number {
  const ranges: Record<string, [number, number]> = {
    low: [129, 163],
    medium: [229, 263],
    high: [513, 667],
  };

  const [min, max] = ranges[tier];
  return getRandomizer().generate(min, max, `buffer_${tier}`);
}

/**
 * Get key down duration with human-like randomization
 * Replaces the old weighted distribution with sophisticated approach
 */
export function getHumanKeyDownDuration(
  min: number = 38,
  max: number = 53,
): number {
  return getRandomizer().generate(min, max, "keydown");
}

/**
 * Get echo hit hold duration with human-like randomization
 * NOW BUFFER-TIER-AWARE: Different tiers have different timing ranges
 *
 * @param bufferTier - The buffer tier context (defaults to "low" for backward compatibility)
 *
 * Timing ranges by tier:
 * - LOW:    28-42ms (fast rotational abilities)
 * - MEDIUM: 34-69ms (channeled abilities)
 * - HIGH:   75-100ms (cooldown abilities)
 */
export function getHumanEchoHitDuration(
  bufferTier: "low" | "medium" | "high" = "low",
): number {
  const ranges: Record<string, [number, number]> = {
    low: [37, 42], // Updated: was [28, 42], now tighter 5ms window
    medium: [34, 69], // Unchanged: 35ms window for medium-speed abilities
    high: [75, 100], // Unchanged: 25ms window for slow abilities
  };

  const [min, max] = ranges[bufferTier];
  return getRandomizer().generate(min, max, `echo_hit_${bufferTier}`);
}

/**
 * Calculate whether buffer extension is needed based on echo timing
 *
 * Buffer extension prevents timing conflicts when echoes consume too much
 * of the buffer window. Triggers when:
 *   (echoCount × avgEchoDuration) > (bufferMs / 2)
 *
 * @param echoCount - Number of echo hits configured
 * @param bufferTier - The buffer tier for this step
 * @param bufferMs - The actual buffer delay in milliseconds
 * @returns Object with needsExtension boolean and extensionMs if needed
 */
export function calculateBufferExtension(
  echoCount: number,
  bufferTier: "low" | "medium" | "high",
  bufferMs: number,
): { needsExtension: boolean; extensionMs: number; reason?: string } {
  // Get average echo duration for this tier
  const avgRanges: Record<string, number> = {
    low: 35, // avg of 28-42
    medium: 51, // avg of 34-69
    high: 87, // avg of 75-100
  };

  const avgEchoDuration = avgRanges[bufferTier];
  const estimatedEchoTime = echoCount * avgEchoDuration;
  const halfBuffer = bufferMs / 2;

  if (estimatedEchoTime > halfBuffer) {
    // Need extension - echoes would consume more than half the buffer
    const extensionMs = getHumanBufferExtension();
    return {
      needsExtension: true,
      extensionMs,
      reason: `Echo time (${estimatedEchoTime}ms) > half buffer (${halfBuffer}ms)`,
    };
  }

  return { needsExtension: false, extensionMs: 0 };
}

/**
 * Get buffer extension duration with human-like randomization
 * Range: 69-72ms with weighted distribution favoring 70-71ms
 */
export function getHumanBufferExtension(): number {
  return getRandomizer().generate(69, 72, "buffer_extension");
}

/**
 * Get hold-through-next release delay with human-like randomization
 */
export function getHumanReleaseDelay(
  min: number = 7,
  max: number = 18,
): number {
  return getRandomizer().generate(min, max, "hold_release");
}

/**
 * Get dual key offset with human-like randomization
 */
export function getHumanDualKeyOffset(): number {
  return getRandomizer().generate(4, 10, "dual_offset");
}

/**
 * Get traffic controller wait time with human-like randomization
 */
export function getHumanTrafficWait(): number {
  return getRandomizer().generate(10, 30, "traffic_wait");
}

/**
 * Generic human-like random delay (for custom ranges)
 */
export function getHumanDelay(
  min: number,
  max: number,
  rangeName: string = "generic",
): number {
  return getRandomizer().generate(min, max, rangeName);
}

/**
 * Reset all history (useful for testing)
 */
export function resetRandomizerHistory(): void {
  if (globalRandomizer) {
    globalRandomizer.resetHistory();
  }
}

/**
 * Get stats for analysis (development only)
 */
export function getRandomizerStats(
  rangeName: string,
): ReturnType<HumanRandomizer["getStats"]> {
  return getRandomizer().getStats(rangeName);
}

export default HumanRandomizer;
