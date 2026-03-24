import { performance } from "perf_hooks";
const { GestureDetector } = await import("../dist/gestureDetector.js");
const { DEFAULT_GESTURE_SETTINGS } = await import("../dist/profileLoader.js");

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function profileSingleHold(holdMs, iterations = 1000) {
  const latencies = [];
  let pending = 0;

  const detector = new GestureDetector(DEFAULT_GESTURE_SETTINGS, (ev) => {
    // compute latency from last recorded keyUp
    const now = performance.now();
    if (lastKeyUpTime !== null) {
      latencies.push(now - lastKeyUpTime);
    }
    pending--;
  });

  let lastKeyUpTime = null;

  for (let i = 0; i < iterations; i++) {
    pending++;
    detector.handleKeyDown("1");
    await sleep(holdMs);
    lastKeyUpTime = performance.now();
    detector.handleKeyUp("1");
    // small gap between iterations
    await sleep(5);
  }

  // wait for pending callbacks
  while (pending > 0) {
    await sleep(10);
  }

  latencies.sort((a, b) => a - b);
  const p50 = latencies[Math.floor(latencies.length * 0.5)];
  const p95 = latencies[Math.floor(latencies.length * 0.95)];
  const p99 = latencies[Math.floor(latencies.length * 0.99)];
  const avg = latencies.reduce((a, b) => a + b, 0) / latencies.length;
  return { avg, p50, p95, p99, count: latencies.length };
}

(async () => {
  console.log("Profiling gesture detector latency (ms)");
  const normals = await profileSingleHold(50, 200);
  console.log("Normal (50ms) ->", normals);
  const longs = await profileSingleHold(100, 200);
  console.log("Long (100ms) ->", longs);
  const supers = await profileSingleHold(160, 200);
  console.log("Super (160ms) ->", supers);
})();
