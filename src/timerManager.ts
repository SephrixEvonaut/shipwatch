// ============================================================================
// TIMER MANAGER - TTS Timer System
// ============================================================================

import { logger } from "./logger.js";

interface ActiveTimer {
  id: string;
  timeoutHandle: NodeJS.Timeout;
  startTime: number;
  duration: number;
  message: string;
}

/**
 * Manages multiple concurrent timers with text-to-speech announcements.
 * Prevents duplicate timers with same ID and provides cancellation.
 */
export class TimerManager {
  private activeTimers: Map<string, ActiveTimer> = new Map();
  private ttsAvailable: boolean = false;
  private sayModule: any = null;

  constructor() {
    this.initializeTTS();
  }

  /**
   * Initialize TTS module (say package)
   */
  private async initializeTTS(): Promise<void> {
    try {
      // Dynamically import 'say' package
      const sayImport = await import("say");
      // Handle both default export and named export
      this.sayModule = sayImport.default || sayImport;
      this.ttsAvailable = true;
      logger.info("TTS module loaded successfully");
    } catch (error) {
      logger.warn(
        "TTS module (say) not available. Install with: npm install say",
      );
      logger.warn("Timers will log messages instead of speaking them.");
      this.ttsAvailable = false;
    }
  }

  /**
   * Start a new timer. If timer with same ID exists, it will be cancelled first.
   * @param id Unique timer identifier (e.g., "drop", "burst", "laze")
   * @param duration Duration in seconds
   * @param message Message to speak when timer completes
   */
  startTimer(id: string, duration: number, message: string): void {
    // Validate duration
    if (!duration || duration <= 0) {
      console.error(
        `⏱️ ERROR: Invalid timer duration: ${duration} for '${id}'`,
      );
      return;
    }

    // Cancel existing timer with same ID
    if (this.activeTimers.has(id)) {
      console.log(`⏱️ Timer '${id}' already active - restarting`);
      this.cancelTimer(id);
    }

    const startTime = Date.now();
    const durationMs = duration * 1000;
    console.log(
      `⏱️ Starting timer '${id}': ${duration}s (${durationMs}ms) → "${message}"`,
    );

    // Create timeout for TTS announcement
    const timeoutHandle = setTimeout(() => {
      this.onTimerComplete(id, message);
    }, durationMs);

    // Store active timer
    this.activeTimers.set(id, {
      id,
      timeoutHandle,
      startTime,
      duration,
      message,
    });
  }

  /**
   * Cancel a specific timer by ID
   */
  cancelTimer(id: string): boolean {
    const timer = this.activeTimers.get(id);
    if (!timer) {
      return false;
    }

    clearTimeout(timer.timeoutHandle);
    this.activeTimers.delete(id);
    logger.info(`Timer '${id}' cancelled`);
    return true;
  }

  /**
   * Cancel all active timers
   */
  cancelAllTimers(): void {
    logger.info(`Cancelling all timers (${this.activeTimers.size} active)`);
    for (const timer of this.activeTimers.values()) {
      clearTimeout(timer.timeoutHandle);
    }
    this.activeTimers.clear();
  }

  /**
   * Get count of active timers
   */
  getActiveTimerCount(): number {
    return this.activeTimers.size;
  }

  /**
   * Get information about a specific timer
   */
  getTimerInfo(id: string): {
    remaining: number;
    elapsed: number;
    total: number;
  } | null {
    const timer = this.activeTimers.get(id);
    if (!timer) {
      return null;
    }

    const elapsed = (Date.now() - timer.startTime) / 1000;
    const remaining = Math.max(0, timer.duration - elapsed);

    return {
      remaining,
      elapsed,
      total: timer.duration,
    };
  }

  /**
   * Called when timer completes
   */
  private onTimerComplete(id: string, message: string): void {
    // Remove from active timers
    this.activeTimers.delete(id);

    console.log(`⏱️ Timer '${id}' complete - announcing: "${message}"`);

    // Speak the message using TTS
    if (this.ttsAvailable && this.sayModule) {
      try {
        this.sayModule.speak(message);
      } catch (error) {
        console.error(
          `TTS error for timer '${id}': ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    } else {
      // Fallback: just log the message
      console.log(`[TTS DISABLED] Would speak: "${message}"`);
    }
  }

  /**
   * Shutdown timer manager - cancel all timers
   */
  shutdown(): void {
    this.cancelAllTimers();
  }
}
