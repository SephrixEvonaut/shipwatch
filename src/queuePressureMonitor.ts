// ============================================================================
// QUEUE PRESSURE MONITOR - Predictive Input Queue Analysis
// ============================================================================
//
// Since we can't directly access the Windows input queue, we MODEL it based on:
// 1. Output events we send (timestamps, durations, blocking time)
// 2. Theoretical queue drain rate (~125 events/sec for USB HID)
// 3. Accumulated pressure over time windows
//
// This allows us to:
// - Track which abilities contribute most to queue pressure
// - Detect pressure spikes before they cause noticeable stutter
// - Pre-emptively add delays when pressure is building
// - Generate reports on problematic sequences
//
// ============================================================================

export interface OutputEvent {
  timestamp: number;
  abilityName: string;
  keyPressed: string;
  blockingDurationMs: number; // How long RobotJS blocked
  isEchoHit: boolean;
  isRStream: boolean;
  pressureContribution: number; // Calculated pressure units
}

export interface PressureSnapshot {
  timestamp: number;
  currentPressure: number;
  peakPressure: number;
  outputsInWindow: number;
  estimatedRecoveryMs: number;
  topContributors: { ability: string; contribution: number }[];
}

export interface AbilityPressureStats {
  abilityName: string;
  totalOutputs: number;
  totalPressure: number;
  avgPressurePerOutput: number;
  maxSinglePressure: number;
  appearsInSpikes: number; // How often this ability appears during pressure spikes
}

export interface SequencePattern {
  abilities: string[];
  occurrences: number;
  avgPressureGenerated: number;
  spikeCorrelation: number; // 0-1, how often this sequence precedes a spike
}

export interface PressureReport {
  sessionDuration: number;
  totalOutputs: number;
  totalPressure: number;
  peakPressure: number;
  peakTimestamp: number;
  spikeCount: number;
  avgPressure: number;
  abilityStats: AbilityPressureStats[];
  problematicSequences: SequencePattern[];
  recommendedGaps: { afterAbility: string; gapMs: number; reason: string }[];
}

// ============================================================================
// CONSTANTS - Based on USB HID and Windows input processing
// ============================================================================

// USB HID keyboards typically poll at 125Hz (8ms) to 1000Hz (1ms)
// We assume 125Hz for conservative estimates
const USB_POLL_RATE_HZ = 125;
const MS_PER_POLL = 1000 / USB_POLL_RATE_HZ; // 8ms

// Windows processes input queue events ~1000/sec when not blocked
// But RobotJS SendInput competes with real inputs
const QUEUE_DRAIN_RATE_PER_SEC = 1000;
const QUEUE_DRAIN_PER_MS = QUEUE_DRAIN_RATE_PER_SEC / 1000;

// Each keypress adds ~2-3 events (down + up, sometimes with modifiers)
const EVENTS_PER_KEYPRESS = 2.5;

// Pressure thresholds
const PRESSURE_WARNING_THRESHOLD = 50; // Start being careful
const PRESSURE_SPIKE_THRESHOLD = 100; // Definite stutter territory
const PRESSURE_CRITICAL_THRESHOLD = 200; // Severe backup

// Analysis windows
const PRESSURE_WINDOW_MS = 500; // Rolling window for pressure calculation
const SEQUENCE_WINDOW_MS = 2000; // Window for detecting ability sequences
const RECOVERY_SAMPLE_WINDOW_MS = 100; // How often to sample for recovery

// ============================================================================
// QUEUE PRESSURE MONITOR CLASS
// ============================================================================

export class QueuePressureMonitor {
  private events: OutputEvent[] = [];
  private snapshots: PressureSnapshot[] = [];
  private sessionStartTime: number = Date.now();

  // Rolling pressure state
  private currentPressure: number = 0;
  private peakPressure: number = 0;
  private peakTimestamp: number = 0;
  private lastDrainTime: number = Date.now();

  // Spike tracking
  private spikeCount: number = 0;
  private inSpike: boolean = false;
  private spikeStartTime: number = 0;
  private spikeAbilities: string[] = [];

  // Sequence tracking
  private recentAbilities: { name: string; timestamp: number }[] = [];
  private sequencePatterns: Map<string, SequencePattern> = new Map();

  // Ability statistics
  private abilityPressure: Map<string, AbilityPressureStats> = new Map();

  // Adaptive throttling state
  private adaptiveGapMs: number = 0;
  private consecutiveHighPressure: number = 0;

  constructor() {
    // Start the drain simulation
    this.startDrainSimulation();
  }

  /**
   * Simulate queue draining over time
   * Called periodically to reduce pressure as the system catches up
   */
  private startDrainSimulation(): void {
    setInterval(() => {
      const now = Date.now();
      const elapsed = now - this.lastDrainTime;
      this.lastDrainTime = now;

      // Drain pressure based on elapsed time
      const drainAmount = elapsed * QUEUE_DRAIN_PER_MS * 0.1; // Scale factor
      this.currentPressure = Math.max(0, this.currentPressure - drainAmount);

      // Track consecutive high pressure
      if (this.currentPressure > PRESSURE_WARNING_THRESHOLD) {
        this.consecutiveHighPressure++;
      } else {
        this.consecutiveHighPressure = 0;
      }

      // Check for spike end
      if (this.inSpike && this.currentPressure < PRESSURE_WARNING_THRESHOLD) {
        this.endSpike();
      }

      // Take periodic snapshots for analysis
      if (now % 1000 < 50) {
        // Roughly every second
        this.takeSnapshot();
      }
    }, RECOVERY_SAMPLE_WINDOW_MS);
  }

  /**
   * Record an output event and calculate its pressure contribution
   */
  recordOutput(
    abilityName: string,
    keyPressed: string,
    blockingDurationMs: number,
    isEchoHit: boolean = false,
    isRStream: boolean = false,
  ): void {
    const now = Date.now();

    // Calculate pressure contribution
    // Factors: blocking time, modifier complexity, rapid succession
    let pressureContribution = blockingDurationMs * 0.5; // Base: 0.5 pressure per ms blocked

    // Modifiers add extra pressure (more events in queue)
    if (keyPressed.includes("+")) {
      const modifierCount = keyPressed.split("+").length - 1;
      pressureContribution *= 1 + modifierCount * 0.3;
    }

    // Echo hits and R streams in rapid succession add compounding pressure
    if (isEchoHit || isRStream) {
      pressureContribution *= 1.2;
    }

    // Recent activity multiplier (more pressure if queue already busy)
    const recentEvents = this.events.filter(
      (e) => now - e.timestamp < 200,
    ).length;
    if (recentEvents > 3) {
      pressureContribution *= 1 + recentEvents * 0.1;
    }

    // Record event
    const event: OutputEvent = {
      timestamp: now,
      abilityName,
      keyPressed,
      blockingDurationMs,
      isEchoHit,
      isRStream,
      pressureContribution,
    };
    this.events.push(event);

    // Update current pressure
    this.currentPressure += pressureContribution;

    // Track peak
    if (this.currentPressure > this.peakPressure) {
      this.peakPressure = this.currentPressure;
      this.peakTimestamp = now;
    }

    // Check for spike start
    if (!this.inSpike && this.currentPressure >= PRESSURE_SPIKE_THRESHOLD) {
      this.startSpike(now);
    }

    // Track ability statistics
    this.updateAbilityStats(abilityName, pressureContribution);

    // Track sequences
    this.trackSequence(abilityName, now);

    // Prune old events (keep last 60 seconds)
    this.pruneOldEvents(now - 60000);
  }

  /**
   * Start tracking a pressure spike
   */
  private startSpike(timestamp: number): void {
    this.inSpike = true;
    this.spikeStartTime = timestamp;
    this.spikeCount++;
    this.spikeAbilities = [];

    // Record abilities that led to spike (last 500ms)
    const recentAbilities = this.events
      .filter((e) => timestamp - e.timestamp < 500)
      .map((e) => e.abilityName);
    this.spikeAbilities = [...new Set(recentAbilities)];

    console.log(
      `⚠️ PRESSURE SPIKE #${this.spikeCount} detected! Pressure: ${this.currentPressure.toFixed(1)}`,
    );
    console.log(`   Contributing abilities: ${this.spikeAbilities.join(", ")}`);
  }

  /**
   * End spike tracking and analyze
   */
  private endSpike(): void {
    if (!this.inSpike) return;

    const spikeDuration = Date.now() - this.spikeStartTime;
    console.log(
      `✅ Spike #${this.spikeCount} resolved after ${spikeDuration}ms`,
    );

    // Mark abilities involved in spikes
    for (const ability of this.spikeAbilities) {
      const stats = this.abilityPressure.get(ability);
      if (stats) {
        stats.appearsInSpikes++;
      }
    }

    // Analyze sequence that led to spike
    this.analyzeSequenceForSpike();

    this.inSpike = false;
    this.spikeAbilities = [];
  }

  /**
   * Update statistics for an ability
   */
  private updateAbilityStats(
    abilityName: string,
    pressureContribution: number,
  ): void {
    let stats = this.abilityPressure.get(abilityName);
    if (!stats) {
      stats = {
        abilityName,
        totalOutputs: 0,
        totalPressure: 0,
        avgPressurePerOutput: 0,
        maxSinglePressure: 0,
        appearsInSpikes: 0,
      };
      this.abilityPressure.set(abilityName, stats);
    }

    stats.totalOutputs++;
    stats.totalPressure += pressureContribution;
    stats.avgPressurePerOutput = stats.totalPressure / stats.totalOutputs;
    stats.maxSinglePressure = Math.max(
      stats.maxSinglePressure,
      pressureContribution,
    );
  }

  /**
   * Track ability sequences for pattern detection
   */
  private trackSequence(abilityName: string, timestamp: number): void {
    // Add to recent abilities
    this.recentAbilities.push({ name: abilityName, timestamp });

    // Prune old entries
    this.recentAbilities = this.recentAbilities.filter(
      (a) => timestamp - a.timestamp < SEQUENCE_WINDOW_MS,
    );

    // Look for sequences of 2-4 abilities
    if (this.recentAbilities.length >= 2) {
      const lastThree = this.recentAbilities.slice(-3).map((a) => a.name);
      const sequenceKey = lastThree.join("→");

      let pattern = this.sequencePatterns.get(sequenceKey);
      if (!pattern) {
        pattern = {
          abilities: lastThree,
          occurrences: 0,
          avgPressureGenerated: 0,
          spikeCorrelation: 0,
        };
        this.sequencePatterns.set(sequenceKey, pattern);
      }

      pattern.occurrences++;

      // Calculate pressure generated by this sequence
      const sequenceEvents = this.events.filter(
        (e) =>
          timestamp - e.timestamp < 500 && lastThree.includes(e.abilityName),
      );
      const sequencePressure = sequenceEvents.reduce(
        (sum, e) => sum + e.pressureContribution,
        0,
      );
      pattern.avgPressureGenerated =
        (pattern.avgPressureGenerated * (pattern.occurrences - 1) +
          sequencePressure) /
        pattern.occurrences;
    }
  }

  /**
   * Analyze the sequence that led to a spike
   */
  private analyzeSequenceForSpike(): void {
    const spikeTriggerAbilities = this.recentAbilities
      .slice(-5)
      .map((a) => a.name);

    for (const [key, pattern] of this.sequencePatterns) {
      const patternInSpike = pattern.abilities.every((a) =>
        spikeTriggerAbilities.includes(a),
      );
      if (patternInSpike) {
        // This pattern appeared right before spike
        pattern.spikeCorrelation =
          (pattern.spikeCorrelation * (this.spikeCount - 1) + 1) /
          this.spikeCount;
      }
    }
  }

  /**
   * Take a pressure snapshot for historical analysis
   */
  private takeSnapshot(): void {
    const now = Date.now();
    const recentEvents = this.events.filter(
      (e) => now - e.timestamp < PRESSURE_WINDOW_MS,
    );

    // Calculate top contributors in this window
    const contributionByAbility = new Map<string, number>();
    for (const event of recentEvents) {
      const current = contributionByAbility.get(event.abilityName) || 0;
      contributionByAbility.set(
        event.abilityName,
        current + event.pressureContribution,
      );
    }

    const topContributors = Array.from(contributionByAbility.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([ability, contribution]) => ({ ability, contribution }));

    // Estimate recovery time
    const estimatedRecoveryMs =
      this.currentPressure > 0
        ? this.currentPressure / (QUEUE_DRAIN_PER_MS * 0.1)
        : 0;

    const snapshot: PressureSnapshot = {
      timestamp: now,
      currentPressure: this.currentPressure,
      peakPressure: this.peakPressure,
      outputsInWindow: recentEvents.length,
      estimatedRecoveryMs,
      topContributors,
    };

    this.snapshots.push(snapshot);

    // Keep last 5 minutes of snapshots
    const fiveMinutesAgo = now - 300000;
    this.snapshots = this.snapshots.filter((s) => s.timestamp > fiveMinutesAgo);
  }

  /**
   * Remove old events to prevent memory growth
   */
  private pruneOldEvents(cutoffTime: number): void {
    this.events = this.events.filter((e) => e.timestamp > cutoffTime);
  }

  /**
   * Get current pressure level (0-1 normalized)
   */
  getCurrentPressureLevel(): number {
    return Math.min(1, this.currentPressure / PRESSURE_CRITICAL_THRESHOLD);
  }

  /**
   * Get recommended additional delay based on current pressure
   * Returns 0 if no additional delay needed
   */
  getAdaptiveDelay(): number {
    if (this.currentPressure < PRESSURE_WARNING_THRESHOLD) {
      return 0;
    }

    if (this.currentPressure < PRESSURE_SPIKE_THRESHOLD) {
      // Warning zone: small delay
      return 30 + (this.currentPressure - PRESSURE_WARNING_THRESHOLD);
    }

    if (this.currentPressure < PRESSURE_CRITICAL_THRESHOLD) {
      // Spike zone: moderate delay
      return 80 + (this.currentPressure - PRESSURE_SPIKE_THRESHOLD);
    }

    // Critical: substantial delay
    return 150 + (this.currentPressure - PRESSURE_CRITICAL_THRESHOLD) * 0.5;
  }

  /**
   * Check if we should skip/delay a duplicate ability
   * Returns delay in ms, or -1 to skip entirely
   */
  shouldThrottleAbility(abilityName: string): number {
    const stats = this.abilityPressure.get(abilityName);

    // If this ability frequently causes spikes, add extra delay
    if (stats && stats.appearsInSpikes > 2) {
      const spikeRatio =
        stats.appearsInSpikes / Math.max(1, stats.totalOutputs);
      if (spikeRatio > 0.1) {
        // Appears in >10% of outputs during spikes
        return 50 + spikeRatio * 200;
      }
    }

    // If pressure is high and this ability has high avg pressure, delay more
    if (this.currentPressure > PRESSURE_WARNING_THRESHOLD && stats) {
      if (stats.avgPressurePerOutput > 30) {
        return 40;
      }
    }

    return 0;
  }

  /**
   * Generate a comprehensive pressure report
   */
  generateReport(): PressureReport {
    const now = Date.now();
    const sessionDuration = now - this.sessionStartTime;

    // Sort abilities by spike correlation
    const abilityStats = Array.from(this.abilityPressure.values()).sort(
      (a, b) => b.appearsInSpikes - a.appearsInSpikes,
    );

    // Find problematic sequences
    const problematicSequences = Array.from(this.sequencePatterns.values())
      .filter((p) => p.spikeCorrelation > 0.3 || p.avgPressureGenerated > 50)
      .sort((a, b) => b.spikeCorrelation - a.spikeCorrelation)
      .slice(0, 10);

    // Generate recommendations
    const recommendedGaps: {
      afterAbility: string;
      gapMs: number;
      reason: string;
    }[] = [];

    for (const stats of abilityStats.slice(0, 5)) {
      if (stats.appearsInSpikes > 2) {
        recommendedGaps.push({
          afterAbility: stats.abilityName,
          gapMs: Math.round(stats.avgPressurePerOutput * 2),
          reason: `Appears in ${stats.appearsInSpikes} spikes (${((stats.appearsInSpikes / stats.totalOutputs) * 100).toFixed(1)}% spike rate)`,
        });
      }
    }

    for (const seq of problematicSequences.slice(0, 3)) {
      if (seq.spikeCorrelation > 0.5) {
        recommendedGaps.push({
          afterAbility: seq.abilities[seq.abilities.length - 2],
          gapMs: Math.round(seq.avgPressureGenerated),
          reason: `Sequence "${seq.abilities.join("→")}" has ${(seq.spikeCorrelation * 100).toFixed(0)}% spike correlation`,
        });
      }
    }

    // Calculate average pressure
    const avgPressure =
      this.snapshots.length > 0
        ? this.snapshots.reduce((sum, s) => sum + s.currentPressure, 0) /
          this.snapshots.length
        : 0;

    return {
      sessionDuration,
      totalOutputs: this.events.length,
      totalPressure: this.events.reduce(
        (sum, e) => sum + e.pressureContribution,
        0,
      ),
      peakPressure: this.peakPressure,
      peakTimestamp: this.peakTimestamp,
      spikeCount: this.spikeCount,
      avgPressure,
      abilityStats,
      problematicSequences,
      recommendedGaps,
    };
  }

  /**
   * Print a summary to console
   */
  printSummary(): void {
    const report = this.generateReport();

    console.log("\n" + "=".repeat(70));
    console.log("📊 QUEUE PRESSURE ANALYSIS REPORT");
    console.log("=".repeat(70));

    console.log(
      `\n⏱️  Session Duration: ${(report.sessionDuration / 1000 / 60).toFixed(1)} minutes`,
    );
    console.log(`📤 Total Outputs: ${report.totalOutputs}`);
    console.log(
      `📈 Peak Pressure: ${report.peakPressure.toFixed(1)} (at ${new Date(report.peakTimestamp).toLocaleTimeString()})`,
    );
    console.log(`📊 Average Pressure: ${report.avgPressure.toFixed(1)}`);
    console.log(`⚠️  Spike Count: ${report.spikeCount}`);

    console.log("\n🔥 TOP PRESSURE CONTRIBUTORS:");
    console.log("-".repeat(50));
    for (const stats of report.abilityStats.slice(0, 8)) {
      const spikeIndicator =
        stats.appearsInSpikes > 0 ? ` ⚠️${stats.appearsInSpikes} spikes` : "";
      console.log(
        `   ${stats.abilityName}: ${stats.totalOutputs} outputs, avg ${stats.avgPressurePerOutput.toFixed(1)} pressure${spikeIndicator}`,
      );
    }

    if (report.problematicSequences.length > 0) {
      console.log("\n🔗 PROBLEMATIC SEQUENCES:");
      console.log("-".repeat(50));
      for (const seq of report.problematicSequences.slice(0, 5)) {
        console.log(`   ${seq.abilities.join(" → ")}`);
        console.log(
          `      ${seq.occurrences}x, avg pressure: ${seq.avgPressureGenerated.toFixed(1)}, spike correlation: ${(seq.spikeCorrelation * 100).toFixed(0)}%`,
        );
      }
    }

    if (report.recommendedGaps.length > 0) {
      console.log("\n💡 RECOMMENDED ADDITIONAL GAPS:");
      console.log("-".repeat(50));
      for (const rec of report.recommendedGaps) {
        console.log(`   After "${rec.afterAbility}": +${rec.gapMs}ms`);
        console.log(`      Reason: ${rec.reason}`);
      }
    }

    console.log("\n" + "=".repeat(70));
  }

  /**
   * Get real-time status string
   */
  getStatusString(): string {
    const level = this.getCurrentPressureLevel();
    const indicator =
      level < 0.3 ? "🟢" : level < 0.6 ? "🟡" : level < 0.8 ? "🟠" : "🔴";
    return `${indicator} Pressure: ${(level * 100).toFixed(0)}% | Spikes: ${this.spikeCount} | Adaptive Delay: +${this.getAdaptiveDelay()}ms`;
  }
}

// Singleton instance
let monitorInstance: QueuePressureMonitor | null = null;

export function getQueuePressureMonitor(): QueuePressureMonitor {
  if (!monitorInstance) {
    monitorInstance = new QueuePressureMonitor();
  }
  return monitorInstance;
}

export function resetQueuePressureMonitor(): void {
  monitorInstance = new QueuePressureMonitor();
}
