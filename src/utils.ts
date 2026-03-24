// ============================================================================
// UTILITIES - Shared helper functions
// ============================================================================

/**
 * Get random integer between min and max (inclusive)
 */
export function randomRange(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Sleep for specified milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Extract raw key from a key string (removes modifiers)
 * Examples:
 *  - "SHIFT+Z" -> "Z"
 *  - "ALT+NUMPAD7" -> "NUMPAD7"
 *  - "K" -> "K"
 */
export function extractRawKey(key: string): string {
  const parts = key.split("+").map((p) => p.trim());
  return parts[parts.length - 1].toUpperCase();
}

/**
 * Parse a key string into base key and modifiers
 * @param key Key string like "SHIFT+K" or "ALT+NUMPAD7"
 * @returns Object with normalized key and modifier array
 */
export function parseKeyWithModifiers(key: string): {
  key: string;
  modifiers: string[];
} {
  const parts = key.split("+").map((p) => p.trim());
  const modifiers: string[] = [];
  let base = parts[parts.length - 1];

  // Collect modifiers (all parts except last)
  for (let i = 0; i < parts.length - 1; i++) {
    const m = parts[i].toUpperCase();
    if (m === "SHIFT") modifiers.push("shift");
    else if (m === "ALT") modifiers.push("alt");
    else if (m === "CTRL" || m === "CONTROL") modifiers.push("control");
    else modifiers.push(m.toLowerCase());
  }

  // Normalize base key
  base = base.toUpperCase();
  // Map common patterns (NUMPADx -> numpadx, F6 -> f6)
  if (base.startsWith("NUMPAD")) {
    base = base.replace("NUMPAD", "numpad").toLowerCase();
  } else {
    base = base.toLowerCase();
  }

  return { key: base, modifiers };
}
