// ═══════════════════════════════════════════════════════════════════
// Statistical Tests — Real implementations for timing verification
// ═══════════════════════════════════════════════════════════════════

/**
 * Standard normal CDF approximation (Abramowitz & Stegun 26.2.17)
 */
function normalCDF(x: number): number {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x) / Math.SQRT2;
  const t = 1.0 / (1.0 + p * x);
  const y =
    1.0 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  return 0.5 * (1.0 + sign * y);
}

/**
 * Kolmogorov-Smirnov test — compares empirical CDF of samples against
 * a theoretical CDF. Returns approximated p-value.
 *
 * @param samples  Raw numeric sample array
 * @param expectedCDF  Theoretical CDF function (value → probability)
 * @returns  Approximate p-value (higher = more consistent with expected distribution)
 */
export function kolmogorovSmirnovTest(
  samples: number[],
  expectedCDF: (x: number) => number,
): number {
  if (samples.length === 0) return 1;

  const sorted = [...samples].sort((a, b) => a - b);
  const n = sorted.length;
  let dMax = 0;

  for (let i = 0; i < n; i++) {
    const empiricalAbove = (i + 1) / n;
    const empiricalBelow = i / n;
    const theoretical = expectedCDF(sorted[i]);

    const d1 = Math.abs(empiricalAbove - theoretical);
    const d2 = Math.abs(empiricalBelow - theoretical);
    dMax = Math.max(dMax, d1, d2);
  }

  // Kolmogorov distribution p-value approximation
  const sqrtN = Math.sqrt(n);
  const lambda = (sqrtN + 0.12 + 0.11 / sqrtN) * dMax;

  // Asymptotic series for KS distribution survival function
  let pValue = 0;
  for (let k = 1; k <= 100; k++) {
    const term = Math.exp(-2 * k * k * lambda * lambda);
    pValue += k % 2 === 1 ? term : -term;
  }
  return Math.max(0, Math.min(1, 2 * pValue));
}

/**
 * Chi-squared goodness-of-fit test.
 *
 * @param observed  Array of observed counts per bin
 * @param expected  Array of expected counts per bin (same length)
 * @returns  Approximate p-value
 */
export function chiSquaredTest(observed: number[], expected: number[]): number {
  if (observed.length !== expected.length || observed.length === 0) return 1;

  let chiSq = 0;
  const k = observed.length;

  for (let i = 0; i < k; i++) {
    if (expected[i] > 0) {
      chiSq += (observed[i] - expected[i]) ** 2 / expected[i];
    }
  }

  const df = k - 1;
  if (df <= 0) return 1;

  // Regularized incomplete gamma function approximation for p-value
  // P(X > chiSq) where X ~ chi-squared(df)
  return 1 - regularizedGammaP(df / 2, chiSq / 2);
}

/**
 * Regularized lower incomplete gamma function P(a, x) = γ(a,x) / Γ(a)
 * Using series expansion for moderate values.
 */
function regularizedGammaP(a: number, x: number): number {
  if (x < 0) return 0;
  if (x === 0) return 0;

  // For x < a + 1, use the series expansion
  if (x < a + 1) {
    let sum = 1 / a;
    let term = 1 / a;
    for (let n = 1; n < 200; n++) {
      term *= x / (a + n);
      sum += term;
      if (Math.abs(term) < 1e-12 * Math.abs(sum)) break;
    }
    return sum * Math.exp(-x + a * Math.log(x) - lnGamma(a));
  }

  // For x >= a + 1, use the continued fraction (complement)
  return 1 - regularizedGammaQ(a, x);
}

/**
 * Upper regularized incomplete gamma function Q(a, x) = 1 - P(a, x)
 * Using Lentz's continued fraction.
 */
function regularizedGammaQ(a: number, x: number): number {
  let f = 1e-30;
  let c = 1e-30;
  let d = 1 / (x + 1 - a);
  let h = d;

  for (let i = 1; i < 200; i++) {
    const an = -i * (i - a);
    const bn = x + 2 * i + 1 - a;
    d = bn + an * d;
    if (Math.abs(d) < 1e-30) d = 1e-30;
    c = bn + an / c;
    if (Math.abs(c) < 1e-30) c = 1e-30;
    d = 1 / d;
    const delta = d * c;
    h *= delta;
    if (Math.abs(delta - 1) < 1e-12) break;
  }

  return Math.exp(-x + a * Math.log(x) - lnGamma(a)) * h;
}

/**
 * Log-gamma via Lanczos approximation
 */
function lnGamma(x: number): number {
  const g = 7;
  const coef = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028,
    771.32342877765313, -176.61502916214059, 12.507343278686905,
    -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
  ];

  if (x < 0.5) {
    return Math.log(Math.PI / Math.sin(Math.PI * x)) - lnGamma(1 - x);
  }

  x -= 1;
  let a = coef[0];
  const t = x + g + 0.5;
  for (let i = 1; i < coef.length; i++) {
    a += coef[i] / (x + i);
  }

  return (
    0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a)
  );
}

/**
 * Lag-k autocorrelation.
 *
 * @param samples  Raw numeric sample array
 * @param lag      Lag (default 1)
 * @returns  Autocorrelation coefficient r in [-1, 1]
 */
export function autocorrelation(samples: number[], lag = 1): number {
  const n = samples.length;
  if (n <= lag) return 0;

  const mean = samples.reduce((s, v) => s + v, 0) / n;

  let num = 0;
  let denom = 0;

  for (let i = 0; i < n; i++) {
    const d = samples[i] - mean;
    denom += d * d;
    if (i + lag < n) {
      num += d * (samples[i + lag] - mean);
    }
  }

  return denom === 0 ? 0 : num / denom;
}

/**
 * Wald-Wolfowitz runs test.
 * Tests whether the sequence of above/below-median values is random.
 *
 * @param samples  Raw numeric sample array
 * @param median   Median value to split on
 * @returns  Approximate two-sided p-value
 */
export function runsTest(samples: number[], median: number): number {
  if (samples.length < 4) return 1;

  // Classify samples as above (+) or below (-) median; skip exact median
  const signs: boolean[] = [];
  for (const v of samples) {
    if (v !== median) {
      signs.push(v > median);
    }
  }

  const n = signs.length;
  if (n < 4) return 1;

  const n1 = signs.filter(Boolean).length; // above
  const n2 = n - n1; // below

  if (n1 === 0 || n2 === 0) return 0;

  // Count runs
  let runs = 1;
  for (let i = 1; i < n; i++) {
    if (signs[i] !== signs[i - 1]) runs++;
  }

  // Expected runs and standard deviation under null hypothesis
  const expectedRuns = 1 + (2 * n1 * n2) / (n1 + n2);
  const variance =
    (2 * n1 * n2 * (2 * n1 * n2 - n1 - n2)) / ((n1 + n2) ** 2 * (n1 + n2 - 1));

  if (variance <= 0) return 1;

  const z = (runs - expectedRuns) / Math.sqrt(variance);

  // Two-sided p-value from standard normal
  return 2 * (1 - normalCDF(Math.abs(z)));
}

/**
 * Build a Gaussian CDF function for use with KS test.
 */
export function gaussianCDF(
  mean: number,
  stdDev: number,
): (x: number) => number {
  return (x: number) => normalCDF((x - mean) / stdDev);
}

/**
 * Build observed and expected histogram bin counts from samples and a
 * theoretical Gaussian, for use with the chi-squared test.
 */
export function buildHistogramBins(
  samples: number[],
  bins: number,
  mean: number,
  stdDev: number,
): { observed: number[]; expected: number[] } {
  if (samples.length === 0)
    return {
      observed: new Array(bins).fill(0),
      expected: new Array(bins).fill(0),
    };

  const sorted = [...samples].sort((a, b) => a - b);
  const lo = sorted[0];
  const hi = sorted[sorted.length - 1];
  const range = hi - lo || 1;
  const bw = range / bins;
  const n = samples.length;

  const observed = new Array(bins).fill(0);
  for (const v of samples) {
    const b = Math.min(Math.floor((v - lo) / bw), bins - 1);
    observed[b]++;
  }

  const cdf = gaussianCDF(mean, stdDev);
  const expected = new Array(bins).fill(0);
  for (let i = 0; i < bins; i++) {
    const binLo = lo + i * bw;
    const binHi = lo + (i + 1) * bw;
    expected[i] = (cdf(binHi) - cdf(binLo)) * n;
  }

  return { observed, expected };
}

/**
 * Calculate median of a numeric array.
 */
export function median(samples: number[]): number {
  if (samples.length === 0) return 0;
  const sorted = [...samples].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}
