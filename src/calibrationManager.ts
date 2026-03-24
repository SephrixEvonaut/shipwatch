// ============================================================================
// CALIBRATION MANAGER - Statistical analysis and threshold calculation
// ============================================================================
//
// This module provides:
// - Statistical analysis of timing data (mean, median, std dev, percentiles)
// - Outlier detection and removal using standard deviation method
// - Threshold calculation with safety margins
// - Confidence scoring based on data quality
// - Validation to ensure no threshold overlaps
//
// ============================================================================

import {
  InputKey,
  GestureSettings,
  RawCalibrationData,
  CalibrationStatistics,
  CalibrationData,
  CalculatedThresholds,
  KeyProfile,
  CalibrationConfig,
  DEFAULT_CALIBRATION_CONFIG,
  ThresholdValidationResult,
  getSpecialKeyConfig,
} from "./calibrationTypes.js";

// ============================================================================
// STATISTICAL FUNCTIONS
// ============================================================================

/**
 * Calculate the mean (average) of an array of numbers
 */
export function calculateMean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/**
 * Calculate the median of an array of numbers
 */
export function calculateMedian(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Calculate the standard deviation of an array of numbers
 */
export function calculateStdDev(values: number[], mean?: number): number {
  if (values.length < 2) return 0;
  const m = mean ?? calculateMean(values);
  const squaredDiffs = values.map((v) => Math.pow(v - m, 2));
  const variance =
    squaredDiffs.reduce((sum, v) => sum + v, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

/**
 * Calculate a percentile value from an array
 */
export function calculatePercentile(
  values: number[],
  percentile: number,
): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = (percentile / 100) * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower);
}

/**
 * Remove outliers using standard deviation method
 * Returns array of values within threshold standard deviations of mean
 */
export function removeOutliers(
  values: number[],
  stdDevThreshold: number = 2,
): { cleaned: number[]; outlierCount: number } {
  if (values.length < 3) {
    return { cleaned: [...values], outlierCount: 0 };
  }

  const mean = calculateMean(values);
  const stdDev = calculateStdDev(values, mean);

  if (stdDev === 0) {
    return { cleaned: [...values], outlierCount: 0 };
  }

  const lowerBound = mean - stdDevThreshold * stdDev;
  const upperBound = mean + stdDevThreshold * stdDev;

  const cleaned = values.filter((v) => v >= lowerBound && v <= upperBound);
  const outlierCount = values.length - cleaned.length;

  return { cleaned, outlierCount };
}

/**
 * Calculate comprehensive statistics for a dataset
 */
export function calculateStatistics(
  values: number[],
  config: CalibrationConfig = DEFAULT_CALIBRATION_CONFIG,
): CalibrationStatistics {
  const { cleaned, outlierCount } = removeOutliers(
    values,
    config.outlierStdDevThreshold,
  );

  const mean = calculateMean(cleaned);
  const median = calculateMedian(cleaned);
  const stdDev = calculateStdDev(cleaned, mean);
  const min = cleaned.length > 0 ? Math.min(...cleaned) : 0;
  const max = cleaned.length > 0 ? Math.max(...cleaned) : 0;
  const percentile10 = calculatePercentile(cleaned, 10);
  const percentile90 = calculatePercentile(cleaned, 90);

  return {
    mean,
    median,
    stdDev,
    min,
    max,
    percentile10,
    percentile90,
    sampleCount: cleaned.length,
    outlierCount,
  };
}

// ============================================================================
// THRESHOLD CALCULATION
// ============================================================================

/**
 * Calculate optimal thresholds from raw calibration data
 */
export function calculateThresholds(
  data: RawCalibrationData,
  config: CalibrationConfig = DEFAULT_CALIBRATION_CONFIG,
): CalculatedThresholds {
  const reasoning: string[] = [];
  let totalOutliers = 0;
  let totalSamples = 0;

  // Analyze single tap data
  const singleStats = calculateStatistics(data.singleTaps, config);
  totalOutliers += singleStats.outlierCount;
  totalSamples += data.singleTaps.length;

  // Analyze long hold data
  const longStats = calculateStatistics(data.longHolds, config);
  totalOutliers += longStats.outlierCount;
  totalSamples += data.longHolds.length;

  // Analyze super long hold data
  const superLongStats = calculateStatistics(data.superLongHolds, config);
  totalOutliers += superLongStats.outlierCount;
  totalSamples += data.superLongHolds.length;

  // Combine all multi-tap gaps for window calculation
  const allGaps = [
    ...data.doubleTapGaps,
    ...data.tripleTapGaps,
    ...data.quadrupleTapGaps,
  ];
  const gapStats = calculateStatistics(allGaps, config);
  totalOutliers += gapStats.outlierCount;
  totalSamples += allGaps.length;

  // ========================================================================
  // CALCULATE THRESHOLDS
  // ========================================================================

  // Single tap max: highest tap duration + 3 std devs + safety buffer
  // This ensures all quick taps are captured with generous headroom
  let singleTapMax = Math.round(singleStats.max + 3 * singleStats.stdDev + 20);
  reasoning.push(
    `Single tap max (${singleTapMax}ms): max(${singleStats.max}ms) + 3×stdDev(${Math.round(singleStats.stdDev)}ms) + 20ms buffer`,
  );

  // Long press min: lowest long hold - safety margin
  // Starts just below the user's fastest intentional long press
  let longPressMin = Math.round(longStats.min - config.safetyMarginMs);
  reasoning.push(
    `Long press min (${longPressMin}ms): min long hold(${longStats.min}ms) - ${config.safetyMarginMs}ms safety margin`,
  );

  // Ensure no overlap between single tap and long press
  if (longPressMin <= singleTapMax) {
    const gap = config.minThresholdGapMs;
    const midpoint = Math.round((singleTapMax + longPressMin) / 2);
    singleTapMax = midpoint - Math.ceil(gap / 2);
    longPressMin = midpoint + Math.floor(gap / 2);
    reasoning.push(
      `Adjusted single/long boundary: singleMax=${singleTapMax}ms, longMin=${longPressMin}ms (added ${gap}ms gap)`,
    );
  }

  // Long press max: highest long hold + safety margin
  let longPressMax = Math.round(longStats.max + config.safetyMarginMs);
  reasoning.push(
    `Long press max (${longPressMax}ms): max long hold(${longStats.max}ms) + ${config.safetyMarginMs}ms safety margin`,
  );

  // Super long min: immediately after long press max (seamless transition)
  let superLongMin = longPressMax + 1;
  reasoning.push(
    `Super long min (${superLongMin}ms): long press max + 1ms (seamless transition)`,
  );

  // Super long max: highest super long hold + larger safety margin
  let superLongMax = Math.round(superLongStats.max + config.safetyMarginMs * 2);
  reasoning.push(
    `Super long max (${superLongMax}ms): max super long hold(${superLongStats.max}ms) + ${config.safetyMarginMs * 2}ms safety margin`,
  );

  // Ensure super long range is valid
  if (superLongMax <= superLongMin) {
    superLongMax = superLongMin + 300; // Default 300ms range
    reasoning.push(
      `Adjusted super long max to ${superLongMax}ms (minimum 300ms range)`,
    );
  }

  // Cancel threshold: immediately after super long max
  const cancelThreshold = superLongMax + 1;
  reasoning.push(
    `Cancel threshold (${cancelThreshold}ms): super long max + 1ms`,
  );

  // Multi-press window: 2.5× mean gap + buffer
  // This ensures comfortable timing for multi-tap sequences
  let multiPressWindow = Math.round(
    config.multiPressWindowMultiplier * gapStats.mean + config.safetyMarginMs,
  );

  // Ensure minimum window of 200ms for usability
  if (multiPressWindow < 200) {
    multiPressWindow = 200;
    reasoning.push(
      `Multi-press window set to minimum (200ms) - calculated value was too low`,
    );
  } else {
    reasoning.push(
      `Multi-press window (${multiPressWindow}ms): ${config.multiPressWindowMultiplier}× mean gap(${Math.round(gapStats.mean)}ms) + ${config.safetyMarginMs}ms buffer`,
    );
  }

  // Extension window: 80% of multi-press window
  const extensionWindow = Math.round(multiPressWindow * 0.8);
  reasoning.push(
    `Extension window (${extensionWindow}ms): 80% of multi-press window`,
  );

  // Calculate confidence score
  const confidence = calculateConfidenceScore(
    data,
    singleStats,
    longStats,
    superLongStats,
    gapStats,
    config,
  );

  return {
    key: data.key,
    singleTapMax,
    longPressMin,
    longPressMax,
    superLongMin,
    superLongMax,
    cancelThreshold,
    multiPressWindow,
    extensionWindow,
    debounceDelay: 10, // Constant
    confidence,
    sampleSize: totalSamples,
    outlierCount: totalOutliers,
    reasoning,
  };
}

/**
 * Calculate confidence score based on data quality
 */
function calculateConfidenceScore(
  data: RawCalibrationData,
  singleStats: CalibrationStatistics,
  longStats: CalibrationStatistics,
  superLongStats: CalibrationStatistics,
  gapStats: CalibrationStatistics,
  config: CalibrationConfig,
): number {
  let score = 100;

  const expectedSamples = config.quickMode
    ? config.quickModeSamples
    : config.samplesPerStep;

  // Deduct for missing samples
  const categories = [
    {
      name: "single tap",
      count: data.singleTaps.length,
      expected: expectedSamples,
    },
    {
      name: "long hold",
      count: data.longHolds.length,
      expected: expectedSamples,
    },
    {
      name: "super long",
      count: data.superLongHolds.length,
      expected: expectedSamples,
    },
    {
      name: "multi-tap gaps",
      count:
        data.doubleTapGaps.length +
        data.tripleTapGaps.length +
        data.quadrupleTapGaps.length,
      expected: expectedSamples * 3,
    },
  ];

  for (const cat of categories) {
    const missing = Math.max(0, cat.expected - cat.count);
    if (missing > 0) {
      const deduction = missing * 2; // -2 points per missing sample
      score -= deduction;
    }
  }

  // Deduct for high variance (std dev > 30% of mean)
  const statsToCheck = [
    { name: "single tap", stats: singleStats },
    { name: "long hold", stats: longStats },
    { name: "super long", stats: superLongStats },
    { name: "multi-tap gap", stats: gapStats },
  ];

  for (const { name, stats } of statsToCheck) {
    if (stats.mean > 0) {
      const varianceRatio = stats.stdDev / stats.mean;
      if (varianceRatio > 0.3) {
        score -= 5; // -5 points for high variance
      }
    }
  }

  // Deduct for excessive outliers (> 10% of samples)
  const totalSamples =
    data.singleTaps.length +
    data.longHolds.length +
    data.superLongHolds.length +
    data.doubleTapGaps.length +
    data.tripleTapGaps.length +
    data.quadrupleTapGaps.length;
  const totalOutliers =
    singleStats.outlierCount +
    longStats.outlierCount +
    superLongStats.outlierCount +
    gapStats.outlierCount;

  if (totalSamples > 0 && totalOutliers / totalSamples > 0.1) {
    score -= 10; // -10 points for excessive outliers
  }

  // Deduct for overlapping ranges (before adjustment)
  if (singleStats.max >= longStats.min) {
    score -= 15; // -15 points for single/long overlap
  }
  if (longStats.max >= superLongStats.min) {
    score -= 15; // -15 points for long/super_long overlap
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}

// ============================================================================
// THRESHOLD VALIDATION
// ============================================================================

/**
 * Validate calculated thresholds for consistency and safety
 */
export function validateThresholds(
  thresholds: CalculatedThresholds,
): ThresholdValidationResult {
  const warnings: string[] = [];
  const errors: string[] = [];
  const adjustments: string[] = [];

  // Check for valid ranges
  if (thresholds.longPressMin <= thresholds.singleTapMax) {
    errors.push(
      `Long press min (${thresholds.longPressMin}ms) must be greater than single tap max (${thresholds.singleTapMax}ms)`,
    );
  }

  if (thresholds.superLongMin <= thresholds.longPressMax) {
    errors.push(
      `Super long min (${thresholds.superLongMin}ms) must be greater than long press max (${thresholds.longPressMax}ms)`,
    );
  }

  if (thresholds.cancelThreshold <= thresholds.superLongMax) {
    errors.push(
      `Cancel threshold (${thresholds.cancelThreshold}ms) must be greater than super long max (${thresholds.superLongMax}ms)`,
    );
  }

  // Check for reasonable ranges
  if (thresholds.longPressMax - thresholds.longPressMin < 100) {
    warnings.push(
      `Long press range is narrow (${thresholds.longPressMax - thresholds.longPressMin}ms). May be difficult to hit consistently.`,
    );
  }

  if (thresholds.superLongMax - thresholds.superLongMin < 100) {
    warnings.push(
      `Super long range is narrow (${thresholds.superLongMax - thresholds.superLongMin}ms). May be difficult to hit consistently.`,
    );
  }

  if (thresholds.multiPressWindow < 200) {
    warnings.push(
      `Multi-press window (${thresholds.multiPressWindow}ms) is short. May make multi-taps difficult.`,
    );
  }

  if (thresholds.multiPressWindow > 500) {
    warnings.push(
      `Multi-press window (${thresholds.multiPressWindow}ms) is long. May cause delayed gesture detection.`,
    );
  }

  // Check confidence
  if (thresholds.confidence < 70) {
    warnings.push(
      `Low confidence score (${thresholds.confidence}%). Consider recalibrating with more consistent samples.`,
    );
  }

  return {
    valid: errors.length === 0,
    warnings,
    errors,
    adjustments,
  };
}

// ============================================================================
// PROFILE CONVERSION
// ============================================================================

/**
 * Convert calculated thresholds to a KeyProfile
 */
export function thresholdsToKeyProfile(
  thresholds: CalculatedThresholds,
): KeyProfile {
  const specialConfig = getSpecialKeyConfig(thresholds.key);

  const profile: KeyProfile = {
    multiPressWindow: thresholds.multiPressWindow,
    debounceDelay: thresholds.debounceDelay,
    longPressMin: thresholds.longPressMin,
    longPressMax: thresholds.longPressMax,
    superLongMin: thresholds.superLongMin,
    superLongMax: thresholds.superLongMax,
    cancelThreshold: thresholds.cancelThreshold,
    calibrationData: {
      calibratedAt: new Date().toISOString(),
      sampleSize: thresholds.sampleSize,
      outlierCount: thresholds.outlierCount,
      confidence: thresholds.confidence,
      averages: {
        singleTap: 0, // Filled in separately
        longHold: 0,
        superLongHold: 0,
        multiTapGap: 0,
      },
      stdDeviations: {
        singleTap: 0,
        longHold: 0,
        superLongHold: 0,
        multiTapGap: 0,
      },
      ranges: {
        singleTap: [0, thresholds.singleTapMax],
        longHold: [thresholds.longPressMin, thresholds.longPressMax],
        superLongHold: [thresholds.superLongMin, thresholds.superLongMax],
        multiTapGap: [0, thresholds.multiPressWindow],
      },
      reasoning: thresholds.reasoning,
    },
  };

  if (specialConfig?.skipMultiTap) {
    profile.specialBehavior = "singleGesturesOnly";
    profile.multiPressWindow = 0; // Disable multi-tap
  }

  return profile;
}

/**
 * Convert KeyProfile to GestureSettings (for use in GestureDetector)
 */
export function keyProfileToGestureSettings(
  profile: KeyProfile,
): GestureSettings {
  return {
    multiPressWindow: profile.multiPressWindow,
    debounceDelay: profile.debounceDelay,
    longPressMin: profile.longPressMin,
    longPressMax: profile.longPressMax,
    superLongMin: profile.superLongMin,
    superLongMax: profile.superLongMax,
    cancelThreshold: profile.cancelThreshold,
  };
}

// ============================================================================
// CALIBRATION MANAGER CLASS
// ============================================================================

/**
 * Main calibration manager for handling calibration sessions
 */
export class CalibrationManager {
  private config: CalibrationConfig;
  private rawData: Map<InputKey, RawCalibrationData> = new Map();
  private calculatedThresholds: Map<InputKey, CalculatedThresholds> = new Map();
  private keyProfiles: Map<InputKey, KeyProfile> = new Map();

  constructor(config: Partial<CalibrationConfig> = {}) {
    this.config = { ...DEFAULT_CALIBRATION_CONFIG, ...config };
  }

  /**
   * Start collecting data for a key
   */
  startKeyCalibration(key: InputKey): void {
    this.rawData.set(key, {
      key,
      singleTaps: [],
      longHolds: [],
      superLongHolds: [],
      doubleTapGaps: [],
      tripleTapGaps: [],
      quadrupleTapGaps: [],
      collectedAt: new Date().toISOString(),
    });
  }

  /**
   * Record a single tap sample
   */
  recordSingleTap(key: InputKey, durationMs: number): void {
    const data = this.rawData.get(key);
    if (data) {
      data.singleTaps.push(durationMs);
    }
  }

  /**
   * Record a long hold sample
   */
  recordLongHold(key: InputKey, durationMs: number): void {
    const data = this.rawData.get(key);
    if (data) {
      data.longHolds.push(durationMs);
    }
  }

  /**
   * Record a super long hold sample
   */
  recordSuperLongHold(key: InputKey, durationMs: number): void {
    const data = this.rawData.get(key);
    if (data) {
      data.superLongHolds.push(durationMs);
    }
  }

  /**
   * Record a double tap gap sample
   */
  recordDoubleTapGap(key: InputKey, gapMs: number): void {
    const data = this.rawData.get(key);
    if (data) {
      data.doubleTapGaps.push(gapMs);
    }
  }

  /**
   * Record triple tap gaps (2 gaps per triple tap)
   */
  recordTripleTapGaps(key: InputKey, gaps: number[]): void {
    const data = this.rawData.get(key);
    if (data) {
      data.tripleTapGaps.push(...gaps);
    }
  }

  /**
   * Record quadruple tap gaps (3 gaps per quadruple tap)
   */
  recordQuadrupleTapGaps(key: InputKey, gaps: number[]): void {
    const data = this.rawData.get(key);
    if (data) {
      data.quadrupleTapGaps.push(...gaps);
    }
  }

  /**
   * Get current sample counts for a key
   */
  getSampleCounts(key: InputKey): Record<string, number> | null {
    const data = this.rawData.get(key);
    if (!data) return null;

    return {
      singleTaps: data.singleTaps.length,
      longHolds: data.longHolds.length,
      superLongHolds: data.superLongHolds.length,
      doubleTapGaps: data.doubleTapGaps.length,
      tripleTapGaps: data.tripleTapGaps.length,
      quadrupleTapGaps: data.quadrupleTapGaps.length,
    };
  }

  /**
   * Get raw data for a key
   */
  getRawData(key: InputKey): RawCalibrationData | null {
    return this.rawData.get(key) ?? null;
  }

  /**
   * Analyze collected data and calculate thresholds
   */
  analyzeKey(key: InputKey): CalculatedThresholds | null {
    const data = this.rawData.get(key);
    if (!data) return null;

    const thresholds = calculateThresholds(data, this.config);
    this.calculatedThresholds.set(key, thresholds);

    const profile = thresholdsToKeyProfile(thresholds);

    // Fill in statistics
    if (profile.calibrationData) {
      const singleStats = calculateStatistics(data.singleTaps, this.config);
      const longStats = calculateStatistics(data.longHolds, this.config);
      const superLongStats = calculateStatistics(
        data.superLongHolds,
        this.config,
      );
      const allGaps = [
        ...data.doubleTapGaps,
        ...data.tripleTapGaps,
        ...data.quadrupleTapGaps,
      ];
      const gapStats = calculateStatistics(allGaps, this.config);

      profile.calibrationData.averages = {
        singleTap: Math.round(singleStats.mean * 10) / 10,
        longHold: Math.round(longStats.mean * 10) / 10,
        superLongHold: Math.round(superLongStats.mean * 10) / 10,
        multiTapGap: Math.round(gapStats.mean * 10) / 10,
      };

      profile.calibrationData.stdDeviations = {
        singleTap: Math.round(singleStats.stdDev * 10) / 10,
        longHold: Math.round(longStats.stdDev * 10) / 10,
        superLongHold: Math.round(superLongStats.stdDev * 10) / 10,
        multiTapGap: Math.round(gapStats.stdDev * 10) / 10,
      };

      profile.calibrationData.ranges = {
        singleTap: [Math.round(singleStats.min), Math.round(singleStats.max)],
        longHold: [Math.round(longStats.min), Math.round(longStats.max)],
        superLongHold: [
          Math.round(superLongStats.min),
          Math.round(superLongStats.max),
        ],
        multiTapGap: [Math.round(gapStats.min), Math.round(gapStats.max)],
      };
    }

    this.keyProfiles.set(key, profile);

    return thresholds;
  }

  /**
   * Get calculated thresholds for a key
   */
  getThresholds(key: InputKey): CalculatedThresholds | null {
    return this.calculatedThresholds.get(key) ?? null;
  }

  /**
   * Get key profile
   */
  getKeyProfile(key: InputKey): KeyProfile | null {
    return this.keyProfiles.get(key) ?? null;
  }

  /**
   * Get all key profiles
   */
  getAllKeyProfiles(): Map<InputKey, KeyProfile> {
    return new Map(this.keyProfiles);
  }

  /**
   * Import existing key profile
   */
  importKeyProfile(key: InputKey, profile: KeyProfile): void {
    this.keyProfiles.set(key, profile);
  }

  /**
   * Clear all data
   */
  reset(): void {
    this.rawData.clear();
    this.calculatedThresholds.clear();
    this.keyProfiles.clear();
  }

  /**
   * Clear data for a specific key
   */
  resetKey(key: InputKey): void {
    this.rawData.delete(key);
    this.calculatedThresholds.delete(key);
    this.keyProfiles.delete(key);
  }

  /**
   * Get configuration
   */
  getConfig(): CalibrationConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<CalibrationConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Export all profiles to JSON format compatible with existing profile structure
   */
  exportProfiles(globalDefaults: GestureSettings, existingProfile?: any): any {
    const keyProfiles: Record<string, KeyProfile> = {};

    for (const [key, profile] of this.keyProfiles) {
      keyProfiles[key] = profile;
    }

    const output = {
      ...(existingProfile || {}),
      calibrationVersion: "1.0.0",
      calibratedAt: new Date().toISOString(),
      calibrationToolVersion: "1.0.0",
      gestureSettings: globalDefaults,
      keyProfiles,
    };

    return output;
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let calibrationManagerInstance: CalibrationManager | null = null;

export function getCalibrationManager(
  config?: Partial<CalibrationConfig>,
): CalibrationManager {
  if (!calibrationManagerInstance) {
    calibrationManagerInstance = new CalibrationManager(config);
  } else if (config) {
    calibrationManagerInstance.updateConfig(config);
  }
  return calibrationManagerInstance;
}

export function resetCalibrationManager(): void {
  if (calibrationManagerInstance) {
    calibrationManagerInstance.reset();
    calibrationManagerInstance = null;
  }
}

export default CalibrationManager;
