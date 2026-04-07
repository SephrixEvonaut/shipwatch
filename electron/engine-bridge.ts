// ============================================================================
// ENGINE BRIDGE — Connects real gesture engine to Electron IPC
// Falls back to mock data if engine modules are unavailable
// ============================================================================

import path from "path";
import { pathToFileURL } from "url";
import fs from "fs";
import { performance } from "perf_hooks";
import { app } from "electron";

type SendEvent = (channel: string, data: unknown) => void;

// ============================================================================
// GUI PROFILE PERSISTENCE
// ============================================================================

interface PersistedProfile {
  id: string;
  name: string;
  description: string;
  active: boolean;
  inputKeys: string[];
  outputKeys: string[];
  bindings: Array<{
    key: string;
    gesture: string;
    output: string;
    label: string;
  }>;
  calibration?: Record<string, KeyCalibration>;
  createdAt: number;
  updatedAt: number;
}

interface KeyCalibration {
  singleTapMax: number;
  longPressMin: number;
  longPressMax: number;
  superLongMin: number;
  superLongMax: number;
  cancelThreshold: number;
  multiPressWindow: number;
  debounceDelay: number;
  confidence: number;
  calibratedAt: number;
}

// GUI gesture names → engine Omega gesture names
const GUI_TO_ENGINE_GESTURE: Record<string, string> = {
  quick: "quick",
  long: "long",
  super_long: "long", // maps to long in Omega (no super_long)
  q_toggle: "quick_toggle",
  l_toggle: "long_toggle",
  quick_f2: "quick_f2",
  long_f2: "long_f2",
};

function guiBindingsToMacros(bindings: PersistedProfile["bindings"]): Array<{
  name: string;
  trigger: { key: string; gesture: string };
  sequence: Array<{ key: string; bufferTier: string }>;
  enabled: boolean;
}> {
  return bindings
    .filter((b) => b.key && b.output && b.gesture)
    .map((b) => {
      const engineGesture = GUI_TO_ENGINE_GESTURE[b.gesture] ?? b.gesture;
      return {
        name: b.label || `${b.key} → ${b.output}`,
        trigger: { key: b.key.toUpperCase(), gesture: engineGesture },
        sequence: [{ key: b.output, bufferTier: "low" }],
        enabled: true,
      };
    });
}

function getProfileStorePath(): string {
  return path.join(app.getPath("userData"), "gui-profiles.json");
}

function loadGuiProfiles(): PersistedProfile[] {
  const filePath = getProfileStorePath();
  console.log(
    "[gui-profiles] loading from:",
    filePath,
    "exists:",
    fs.existsSync(filePath),
  );
  try {
    if (!fs.existsSync(filePath)) return [];
    const raw = fs.readFileSync(filePath, "utf-8");
    const parsed = JSON.parse(raw);
    const result = Array.isArray(parsed) ? parsed : [];
    console.log("[gui-profiles] loaded", result.length, "profiles");
    return result;
  } catch {
    return [];
  }
}

function saveGuiProfiles(profiles: PersistedProfile[]): void {
  const filePath = getProfileStorePath();
  console.log(
    `[gui-profiles] saving ${profiles.length} profiles to:`,
    filePath,
  );
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(profiles, null, 2), "utf-8");
  console.log(`[gui-profiles] ✅ saved (${fs.statSync(filePath).size} bytes)`);
}

// ============================================================================
// GESTURE DEFINITIONS PERSISTENCE
// ============================================================================

interface GestureDefinition {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  category: "tap" | "hold" | "toggle" | "multi-tap";
  calibrationSteps: string[];
}

const DEFAULT_GESTURE_DEFINITIONS: GestureDefinition[] = [
  { id: "quick", name: "Quick", description: "Single quick tap and release", enabled: true, category: "tap", calibrationSteps: ["single_tap"] },
  { id: "long", name: "Long", description: "Hold for ~500ms then release", enabled: true, category: "hold", calibrationSteps: ["long_hold"] },
  { id: "super_long", name: "Super Long", description: "Hold for ~1 second then release", enabled: true, category: "hold", calibrationSteps: ["super_long_hold"] },
  { id: "q_toggle", name: "Quick Toggle", description: "Two quick taps to toggle state", enabled: true, category: "toggle", calibrationSteps: ["single_tap", "double_tap"] },
  { id: "l_toggle", name: "Long Toggle", description: "Two long holds to toggle state", enabled: true, category: "toggle", calibrationSteps: ["long_hold", "double_tap"] },
  { id: "quick_f2", name: "Quick F2", description: "Quick tap variant for secondary layer", enabled: false, category: "tap", calibrationSteps: ["single_tap"] },
  { id: "long_f2", name: "Long F2", description: "Long hold variant for secondary layer", enabled: false, category: "hold", calibrationSteps: ["long_hold"] },
  { id: "double", name: "Double Tap", description: "Double-tap the key quickly", enabled: false, category: "multi-tap", calibrationSteps: ["single_tap", "double_tap"] },
  { id: "triple", name: "Triple Tap", description: "Triple-tap the key quickly", enabled: false, category: "multi-tap", calibrationSteps: ["single_tap", "triple_tap"] },
  { id: "quadruple", name: "Quadruple Tap", description: "Quadruple-tap the key quickly", enabled: false, category: "multi-tap", calibrationSteps: ["single_tap", "quadruple_tap"] },
];

function getGestureDefsStorePath(): string {
  return path.join(app.getPath("userData"), "gesture-definitions.json");
}

function loadGestureDefinitions(): GestureDefinition[] {
  const filePath = getGestureDefsStorePath();
  try {
    if (!fs.existsSync(filePath)) return [...DEFAULT_GESTURE_DEFINITIONS];
    const raw = fs.readFileSync(filePath, "utf-8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [...DEFAULT_GESTURE_DEFINITIONS];
  } catch {
    return [...DEFAULT_GESTURE_DEFINITIONS];
  }
}

function saveGestureDefinitions(defs: GestureDefinition[]): void {
  const filePath = getGestureDefsStorePath();
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(defs, null, 2), "utf-8");
  console.log(`[gesture-defs] ✅ saved ${defs.length} definitions`);
}

// ============================================================================
// MOCK DATA (fallback when engine modules unavailable)
// ============================================================================

const MOCK = {
  profiles: [
    { name: "Default", keys: 6, gestures: 12, active: true, backend: "mock" },
    { name: "Gaming", keys: 8, gestures: 24, active: false, backend: "mock" },
    {
      name: "Productivity",
      keys: 4,
      gestures: 8,
      active: false,
      backend: "mock",
    },
  ],

  thresholds: {
    "1": 180,
    "2": 175,
    "3": 190,
    "4": 185,
    "5": 170,
    "6": 195,
    A: 200,
    S: 210,
  } as Record<string, number>,

  calibrationData: {
    key: "1",
    samples: [178, 182, 175, 190, 180, 177, 185, 183, 179, 181],
    mean: 181,
    stdDev: 4.2,
    threshold: 180,
    confidence: 0.95,
    calibratedAt: Date.now(),
  },

  timingStats: {
    totalSamples: 500,
    tiers: {
      low: { mean: 32, stdDev: 8, min: 18, max: 50, samples: 200 },
      medium: { mean: 65, stdDev: 12, min: 40, max: 95, samples: 200 },
      high: { mean: 110, stdDev: 20, min: 70, max: 160, samples: 100 },
    },
  },

  conflictMap: {
    activeConflicts: 0,
    rules: [
      {
        keys: ["1", "2"],
        type: "mutex",
        description: "Keys 1 and 2 share a cooldown group",
      },
      {
        keys: ["A", "S"],
        type: "priority",
        description: "Key A takes priority over key S",
      },
    ],
  },

  queueStatus: {
    pending: 0,
    inFlight: 0,
    maxConcurrent: 3,
    totalProcessed: 0,
    averageLatency: 0,
    pressure: "none" as const,
  },

  backendInfo: {
    name: "mock",
    connected: false,
    port: "N/A",
    firmware: "N/A",
    latency: 0,
    capabilities: ["keyDown", "keyUp", "modifiers"],
  },
};

// ============================================================================
// ENGINE BRIDGE CLASS
// ============================================================================

export class EngineBridge {
  private _mock = true;
  private _running = false;
  private _startedAt = 0;
  private _gesturesDetected = 0;
  private _sequencesExecuted = 0;
  private currentBackend = "mock";
  private activeProfileName = "";
  private sendEvent: SendEvent = () => {};

  // Dynamically loaded module constructors / factories
  private ProfileLoaderClass: any = null;
  private ExecutorFactoryClass: any = null;
  private HumanRandomizerClass: any = null;
  private getQueuePressureMonitorFn: any = null;
  private getCalibrationManagerFn: any = null;
  private omegaProfilesMod: any = null;
  private getHumanBufferDelayFn: any = null;
  private InputListenerClass: any = null;
  private createOmegaDetectorFn: any = null;
  private compileProfileFn: any = null;
  private defaultGestureSettings: any = null;

  // Live instances
  private profileLoader: any = null;
  private executor: any = null;
  private inputListener: any = null;
  private gestureDetector: any = null;
  private cooldownManager: any = null;

  // Calibration session state
  private calListener: any = null;
  private calKey: string | null = null;
  private calStep: string | null = null;
  private calKeyDownTimes: Map<string, number> = new Map();
  private calLastKeyUpTime: number | null = null;
  private calMultiTapGaps: number[] = [];
  private calSamples: number[] = [];
  private calCompletions = 0;
  private calSamplesNeeded = 10;
  private calResolve: (() => void) | null = null;
  private calRawData: Map<
    string,
    {
      singleTaps: number[];
      longHolds: number[];
      superLongHolds: number[];
      doubleTapGaps: number[];
      tripleTapGaps: number[];
      quadrupleTapGaps: number[];
    }
  > = new Map();

  // ========================================================================
  // INITIALIZATION
  // ========================================================================

  async init(sendEvent: SendEvent): Promise<void> {
    this.sendEvent = sendEvent;

    try {
      const distRoot = path.resolve(__dirname, "..", "dist");
      // Use Function trick to prevent TypeScript from compiling import() to require()
      const dynamicImport = new Function(
        "specifier",
        "return import(specifier)",
      ) as (specifier: string) => Promise<any>;
      const load = (mod: string) =>
        dynamicImport(pathToFileURL(path.join(distRoot, `${mod}.js`)).href);

      // Load modules that don't depend on native addons first
      const [plMod, cmMod, hrMod, qpMod, calMod, opMod, ilMod, ogdMod, pcMod] =
        await Promise.all([
          load("profileLoader"),
          load("cooldownManager"),
          load("humanRandomizer"),
          load("queuePressureMonitor"),
          load("calibrationManager"),
          load("omegaProfiles"),
          load("inputListener"),
          load("omegaGestureDetector"),
          load("profileCompiler"),
        ]);

      // executorFactory imports robotjs (native addon) — load separately so it
      // doesn't crash the entire init if the native module version mismatches
      let efMod: any = null;
      try {
        efMod = await load("executorFactory");
      } catch (efErr: unknown) {
        const efMsg = efErr instanceof Error ? efErr.message : String(efErr);
        console.warn(
          `⚠️ Engine bridge: executorFactory unavailable (${efMsg}) — executor features disabled`,
        );
      }

      // Store constructors / factories
      this.ProfileLoaderClass = plMod.ProfileLoader;
      this.ExecutorFactoryClass = efMod?.ExecutorFactory ?? null;
      this.HumanRandomizerClass = hrMod.default || hrMod.HumanRandomizer;
      this.getQueuePressureMonitorFn = qpMod.getQueuePressureMonitor;
      this.getCalibrationManagerFn = calMod.getCalibrationManager;
      this.omegaProfilesMod = opMod;
      this.getHumanBufferDelayFn = hrMod.getHumanBufferDelay;

      // Additional module refs for full pipeline
      this.InputListenerClass = ilMod.InputListener;
      this.createOmegaDetectorFn = ogdMod.createOmegaGestureDetector;
      this.compileProfileFn = pcMod.compileProfile;
      this.defaultGestureSettings = plMod.DEFAULT_GESTURE_SETTINGS;

      // CooldownManager is used during engine start
      const CooldownManagerClass = cmMod.CooldownManager;
      this.cooldownManager = new CooldownManagerClass();

      // Initialize ProfileLoader (pure fs, always works)
      const profilesDir = path.resolve(__dirname, "..", "profiles");
      this.profileLoader = new this.ProfileLoaderClass(profilesDir);

      this._mock = false;
      console.log("✅ Engine bridge: live mode (engine modules loaded)");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`⚠️ Engine bridge: mock mode — ${msg}`);
      this._mock = true;
    }
  }

  get mock(): boolean {
    return this._mock;
  }

  // ========================================================================
  // ENGINE CONTROL
  // ========================================================================

  getStatus() {
    return {
      running: this._running,
      backend: this.currentBackend,
      activeProfile: this.activeProfileName || "None",
      uptime: this._running ? Date.now() - this._startedAt : 0,
      gesturesDetected: this._gesturesDetected,
      sequencesExecuted: this._sequencesExecuted,
      activeExecutions: this.executor?.getActiveExecutionCount?.() ?? 0,
      queueDepth: 0,
      mock: this._mock,
    };
  }

  async start(_profileKey: string) {
    if (this._mock) {
      this._running = true;
      this._startedAt = Date.now();
      this.activeProfileName = "Default";
      return { status: "started", mock: true };
    }

    try {
      // ── 1. Find the active GUI profile ──────────────────────────
      const guiProfiles = loadGuiProfiles();
      console.log(`[engine] Found ${guiProfiles.length} GUI profiles`);
      const activeGui = guiProfiles.find((p) => p.active) ?? guiProfiles[0];

      if (!activeGui || activeGui.bindings.length === 0) {
        console.warn(
          "⚠️ No active GUI profile with bindings — starting in mock mode",
        );
        this._running = true;
        this._startedAt = Date.now();
        this.activeProfileName = "No Profile";
        return { status: "started", mock: true };
      }

      console.log(
        `[engine] Active profile: "${activeGui.name}" with ${activeGui.bindings.length} bindings`,
      );
      for (const b of activeGui.bindings) {
        console.log(
          `  [binding] ${b.key} (${b.gesture}) → ${b.output}  "${b.label}"`,
        );
      }

      // ── 2. Create executor (may be null if robotjs unavailable) ─
      if (this.ExecutorFactoryClass) {
        try {
          const result = await this.ExecutorFactoryClass.createBest(
            (event: any) => {
              if (event.type === "started") {
                this._sequencesExecuted++;
              }
              this.sendEvent("event:execution", {
                id: `exec-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                gesture: event.bindingName || "",
                key: "",
                step: 0,
                totalSteps: 1,
                startedAt: Date.now(),
              });
            },
          );
          this.executor = result.executor;
          this.currentBackend = result.backend;
          console.log(
            `[engine] Executor ready (backend: ${this.currentBackend})`,
          );
        } catch (exErr: unknown) {
          const exMsg = exErr instanceof Error ? exErr.message : String(exErr);
          console.warn(
            `[engine] Executor creation failed: ${exMsg} — running in log-only mode`,
          );
          this.executor = null;
          this.currentBackend = "none";
        }
      } else {
        console.warn(
          "[engine] No ExecutorFactory available — running in log-only mode (key presses will be detected but not sent)",
        );
        this.executor = null;
        this.currentBackend = "none";
      }

      // ── 3. Convert GUI bindings → MacroBindings ────────────────
      const macroBindings = guiBindingsToMacros(activeGui.bindings);
      console.log(`[engine] Converted ${macroBindings.length} macro bindings`);

      // Build a lookup: inputKey → gesture → MacroBinding
      const bindingLookup = new Map<string, Map<string, any>>();
      for (const mb of macroBindings) {
        const key = mb.trigger.key;
        if (!bindingLookup.has(key)) bindingLookup.set(key, new Map());
        bindingLookup.get(key)!.set(mb.trigger.gesture, mb);
      }
      console.log(
        `[engine] Binding lookup keys: [${[...bindingLookup.keys()].join(", ")}]`,
      );

      // ── 4. Create gesture detector ─────────────────────────────
      const settings = this.defaultGestureSettings;
      console.log(`[engine] Gesture settings:`, JSON.stringify(settings));
      this.gestureDetector = this.createOmegaDetectorFn(
        settings,
        (event: any) => {
          this._gesturesDetected++;
          const { inputKey, gesture } = event;

          console.log(
            `🎯 [GESTURE DETECTED] key="${inputKey}" gesture="${gesture}"`,
          );

          // Look up binding
          const keyMap = bindingLookup.get(inputKey);
          const binding = keyMap?.get(gesture);

          this.sendEvent("event:gesture", {
            key: inputKey,
            gesture,
            timestamp: Date.now(),
            binding: binding ? { name: binding.name, output: binding.sequence.map((s: any) => s.key) } : null,
          });

          if (binding) {
            console.log(
              `  ⚡ [MATCH] "${binding.name}" → output: ${JSON.stringify(binding.sequence.map((s: any) => s.key))}`,
            );
            if (this.executor) {
              this.executor.executeDetached(binding);
              console.log(`  ✅ [EXECUTED] via ${this.currentBackend}`);
            } else {
              console.log(
                `  ⚠️ [NO EXECUTOR] would have sent: ${binding.sequence.map((s: any) => s.key).join(", ")}`,
              );
            }
          } else {
            console.log(
              `  ❌ [NO BINDING] for ${inputKey}→${gesture} (available gestures for key: ${keyMap ? [...keyMap.keys()].join(", ") : "none"})`,
            );
          }
        },
      );

      // Tell detector which keys have bindings (for instant-quick optimization)
      const bindingEntries = macroBindings.map((mb) => ({
        inputKey: mb.trigger.key,
        gesture: mb.trigger.gesture,
      }));
      if (this.gestureDetector.setExistingBindings) {
        this.gestureDetector.setExistingBindings(bindingEntries);
      }

      // ── 4b. Load per-key calibration profiles ──────────────────
      if (
        activeGui.calibration &&
        Object.keys(activeGui.calibration).length > 0
      ) {
        const perKeyProfiles: Record<string, any> = {};
        for (const [key, cal] of Object.entries(activeGui.calibration)) {
          perKeyProfiles[key] = {
            multiPressWindow: cal.multiPressWindow,
            debounceDelay: cal.debounceDelay,
            longPressMin: cal.longPressMin,
            longPressMax: cal.longPressMax,
            superLongMin: cal.superLongMin,
            superLongMax: cal.superLongMax,
            cancelThreshold: cal.cancelThreshold,
          };
        }
        this.gestureDetector.loadKeyProfiles(perKeyProfiles);
        console.log(
          `[engine] Loaded calibration for ${Object.keys(perKeyProfiles).length} keys: [${Object.keys(perKeyProfiles).join(", ")}]`,
        );
      } else {
        console.log(
          `[engine] No per-key calibration data — using global defaults`,
        );
      }

      // ── 5. Create input listener & wire to detector ────────────
      let keyEventCount = 0;
      this.inputListener = new this.InputListenerClass((event: any) => {
        if (!this._running) return;
        if ("key" in event) {
          keyEventCount++;
          // Log first 20 key events, then every 50th to avoid spam
          if (keyEventCount <= 20 || keyEventCount % 50 === 0) {
            console.log(
              `🔑 [INPUT] key="${event.key}" type="${event.type}" (#${keyEventCount})`,
            );
          }
          // Forward raw key events to renderer
          this.sendEvent("event:key", {
            key: event.key,
            type: event.type,
            timestamp: Date.now(),
          });
          if (event.type === "down") {
            this.gestureDetector.handleKeyDown(event.key);
          } else {
            this.gestureDetector.handleKeyUp(event.key);
          }
        } else if ("button" in event) {
          console.log(
            `🖱️ [INPUT] button="${event.button}" type="${event.type}"`,
          );
          if (event.type === "down") {
            this.gestureDetector.handleMouseDown?.(event.button);
          } else {
            this.gestureDetector.handleMouseUp?.(event.button);
          }
        }
      });
      await this.inputListener.start();

      // ── 6. Mark running ────────────────────────────────────────
      this.activeProfileName = activeGui.name;
      this._running = true;
      this._startedAt = Date.now();

      const inputCount = activeGui.inputKeys.length;
      const bindingCount = macroBindings.length;
      console.log(
        `✅ Engine started: profile "${activeGui.name}" (${inputCount} input keys, ${bindingCount} bindings, backend: ${this.currentBackend})`,
      );
      return { status: "started", mock: false, profile: activeGui.name };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`❌ Engine start failed: ${msg}`);
      // Fall back to mock mode
      this._running = true;
      this._startedAt = Date.now();
      this.activeProfileName = "Default (demo)";
      return { status: "started", mock: true };
    }
  }

  async stop() {
    if (this.executor?.destroy) {
      this.executor.destroy();
      this.executor = null;
    }
    if (this.inputListener?.stop) {
      this.inputListener.stop();
      this.inputListener = null;
    }
    if (this.gestureDetector?.destroy) {
      this.gestureDetector.destroy();
      this.gestureDetector = null;
    }

    this._running = false;
    this._startedAt = 0;
    return { status: "stopped", mock: this._mock };
  }

  // ========================================================================
  // PROFILES
  // ========================================================================

  listProfiles() {
    if (!this.profileLoader) {
      return { data: [...MOCK.profiles], mock: true };
    }

    try {
      const filenames: string[] = this.profileLoader.listProfiles();
      if (filenames.length === 0) {
        return { data: [...MOCK.profiles], mock: true };
      }

      const profiles = filenames.map((name: string, i: number) => {
        const profile = this.profileLoader.loadProfile(name);
        const enabledCount =
          profile?.macros?.filter((m: any) => m.enabled)?.length ?? 0;
        return {
          name: name.replace(".json", ""),
          keys: new Set(
            profile?.macros
              ?.filter((m: any) => m.enabled && m.trigger)
              .map((m: any) => m.trigger.key) ?? [],
          ).size,
          gestures: enabledCount,
          active: i === 0,
          backend: this.currentBackend,
        };
      });
      return { data: profiles, mock: false };
    } catch {
      return { data: [...MOCK.profiles], mock: true };
    }
  }

  getActiveProfile() {
    const { data } = this.listProfiles();
    return data.find((p: any) => p.active) ?? data[0];
  }

  createProfile(profile: { name: string }) {
    if (!this.profileLoader) return;
    try {
      const newProfile = {
        name: profile.name,
        description: "",
        macros: [],
        gestureSettings: {
          singleTapMaxMs: 200,
          longPressMinMs: 300,
          multiTapWindowMs: 350,
          superLongMinMs: 600,
        },
      };
      this.profileLoader.saveProfile?.(newProfile, `${profile.name}.json`);
    } catch {
      // Best-effort
    }
  }

  deleteProfile(name: string) {
    if (!this.profileLoader) return;
    try {
      const profilesDir = path.resolve(__dirname, "..", "profiles");
      const filepath = path.join(profilesDir, `${name}.json`);
      const fs = require("fs");
      if (fs.existsSync(filepath)) {
        fs.unlinkSync(filepath);
      }
    } catch {
      // Best-effort
    }
  }

  setActiveProfile(name: string) {
    this.activeProfileName = name;
  }

  // ========================================================================
  // GUI PROFILES (persisted to disk)
  // ========================================================================

  listGuiProfiles(): PersistedProfile[] {
    return loadGuiProfiles();
  }

  saveGuiProfile(profile: PersistedProfile): void {
    console.log(
      "[gui-profiles] saveGuiProfile called with id:",
      profile?.id,
      "name:",
      profile?.name,
    );
    const profiles = loadGuiProfiles();
    const idx = profiles.findIndex((p) => p.id === profile.id);
    if (idx >= 0) {
      profiles[idx] = profile;
    } else {
      profiles.push(profile);
    }
    saveGuiProfiles(profiles);
    console.log(
      "[gui-profiles] saved",
      profiles.length,
      "profiles to",
      getProfileStorePath(),
    );
  }

  deleteGuiProfile(id: string): void {
    const profiles = loadGuiProfiles().filter((p) => p.id !== id);
    saveGuiProfiles(profiles);
  }

  // ========================================================================
  // GESTURE DEFINITIONS
  // ========================================================================

  listGestureDefinitions(): GestureDefinition[] {
    return loadGestureDefinitions();
  }

  saveGestureDefinitions(defs: GestureDefinition[]): void {
    saveGestureDefinitions(defs);
  }

  // ========================================================================
  // CALIBRATION (GUI-driven)
  // ========================================================================

  getThresholds(): { data: Record<string, number>; mock: boolean } {
    // Return thresholds from the active GUI profile's calibration data
    const guiProfiles = loadGuiProfiles();
    const active = guiProfiles.find((p) => p.active) ?? guiProfiles[0];
    if (active?.calibration) {
      const thresholds: Record<string, number> = {};
      for (const [key, cal] of Object.entries(active.calibration)) {
        thresholds[key] = cal.longPressMin;
      }
      return { data: thresholds, mock: false };
    }
    return { data: { ...MOCK.thresholds }, mock: true };
  }

  getCalibrationData(key: string) {
    const guiProfiles = loadGuiProfiles();
    const active = guiProfiles.find((p) => p.active) ?? guiProfiles[0];
    const cal = active?.calibration?.[key];
    if (cal) {
      return {
        data: {
          key,
          samples: [],
          mean: 0,
          stdDev: 0,
          threshold: cal.longPressMin,
          confidence: cal.confidence,
          calibratedAt: cal.calibratedAt,
        },
        mock: false,
      };
    }
    return { data: { ...MOCK.calibrationData, key }, mock: true };
  }

  startCalibration(_keys: string[]) {
    return { status: "calibration_started", mock: this._mock };
  }

  /** Get calibration for every key in the active GUI profile */
  getProfileCalibration(): Record<string, KeyCalibration> | null {
    const guiProfiles = loadGuiProfiles();
    const active = guiProfiles.find((p) => p.active) ?? guiProfiles[0];
    return active?.calibration ?? null;
  }

  /** Start a calibration session: spins up InputListener and captures timing */
  async calibrationStart(
    keys: string[],
    profileId: string,
  ): Promise<{ status: string }> {
    if (!this.InputListenerClass) {
      return { status: "error:no_input_listener" };
    }
    // Stop any running engine listener so they don't conflict
    if (this.inputListener?.stop) {
      this.inputListener.stop();
      this.inputListener = null;
    }
    // Stop any previous cal listener
    if (this.calListener?.stop) {
      this.calListener.stop();
      this.calListener = null;
    }

    // Reset raw data stores for the requested keys
    this.calRawData.clear();
    for (const k of keys) {
      this.calRawData.set(k.toUpperCase(), {
        singleTaps: [],
        longHolds: [],
        superLongHolds: [],
        doubleTapGaps: [],
        tripleTapGaps: [],
        quadrupleTapGaps: [],
      });
    }

    // Spin up an input listener dedicated to calibration
    this.calListener = new this.InputListenerClass((event: any) => {
      if ("key" in event) {
        this.handleCalKeyEvent(event.key, event.type);
      }
    });
    await this.calListener.start();

    console.log(
      `[calibration] session started for keys: [${keys.join(", ")}] profileId=${profileId}`,
    );
    return { status: "started" };
  }

  /** Collect samples for one key+step combination */
  async calibrationCollect(
    key: string,
    step: string,
    samplesNeeded: number,
  ): Promise<{
    samples: number[];
    stats: { mean: number; stdDev: number; min: number; max: number };
  }> {
    this.calKey = key.toUpperCase();
    this.calStep = step;
    this.calSamples = [];
    this.calCompletions = 0;
    this.calMultiTapGaps = [];
    this.calLastKeyUpTime = null;
    this.calKeyDownTimes.clear();
    this.calSamplesNeeded = samplesNeeded;

    console.log(
      `[calibration] collecting ${samplesNeeded} samples for ${key}/${step}`,
    );

    // Wait until enough samples arrive (or 2 min timeout)
    await new Promise<void>((resolve) => {
      this.calResolve = resolve;
      setTimeout(() => {
        this.calResolve = null;
        resolve();
      }, 120_000);
    });

    // Record into raw data
    const rawEntry = this.calRawData.get(this.calKey);
    if (rawEntry) {
      if (step === "single_tap") rawEntry.singleTaps.push(...this.calSamples);
      else if (step === "long_hold")
        rawEntry.longHolds.push(...this.calSamples);
      else if (step === "super_long_hold")
        rawEntry.superLongHolds.push(...this.calSamples);
      else if (step === "double_tap")
        rawEntry.doubleTapGaps.push(...this.calSamples);
      else if (step === "triple_tap")
        rawEntry.tripleTapGaps.push(...this.calSamples);
      else if (step === "quadruple_tap")
        rawEntry.quadrupleTapGaps.push(...this.calSamples);
    }

    const samples = [...this.calSamples];
    const mean = samples.length
      ? samples.reduce((a, b) => a + b, 0) / samples.length
      : 0;
    const stdDev =
      samples.length > 1
        ? Math.sqrt(
            samples.map((v) => (v - mean) ** 2).reduce((a, b) => a + b, 0) /
              (samples.length - 1),
          )
        : 0;

    return {
      samples,
      stats: {
        mean: Math.round(mean * 10) / 10,
        stdDev: Math.round(stdDev * 10) / 10,
        min: samples.length ? Math.round(Math.min(...samples)) : 0,
        max: samples.length ? Math.round(Math.max(...samples)) : 0,
      },
    };
  }

  /** Analyze collected data for a key, calculate thresholds */
  calibrationAnalyze(key: string): KeyCalibration | null {
    const raw = this.calRawData.get(key.toUpperCase());
    if (!raw) return null;

    console.log(`[cal-analyze] Key "${key}" raw data sizes:`);
    console.log(`  singleTaps: ${raw.singleTaps.length} → [${raw.singleTaps.join(", ")}]`);
    console.log(`  longHolds: ${raw.longHolds.length} → [${raw.longHolds.join(", ")}]`);
    console.log(`  superLongHolds: ${raw.superLongHolds.length} → [${raw.superLongHolds.join(", ")}]`);
    console.log(`  doubleTapGaps: ${raw.doubleTapGaps.length} → [${raw.doubleTapGaps.join(", ")}]`);
    console.log(`  tripleTapGaps: ${raw.tripleTapGaps.length} → [${raw.tripleTapGaps.join(", ")}]`);
    console.log(`  quadrupleTapGaps: ${raw.quadrupleTapGaps.length} → [${raw.quadrupleTapGaps.join(", ")}]`);

    // Use the engine's CalibrationManager to calculate thresholds
    if (this.getCalibrationManagerFn) {
      try {
        const calMgr = this.getCalibrationManagerFn({ samplesPerStep: 7 });
        calMgr.reset();
        calMgr.startKeyCalibration(key.toUpperCase());
        for (const d of raw.singleTaps)
          calMgr.recordSingleTap(key.toUpperCase(), d);
        for (const d of raw.longHolds)
          calMgr.recordLongHold(key.toUpperCase(), d);
        for (const d of raw.superLongHolds)
          calMgr.recordSuperLongHold(key.toUpperCase(), d);
        for (const d of raw.doubleTapGaps)
          calMgr.recordDoubleTapGap(key.toUpperCase(), d);
        for (let i = 0; i < raw.tripleTapGaps.length; i += 2) {
          const gaps = raw.tripleTapGaps.slice(i, i + 2);
          if (gaps.length === 2) calMgr.recordTripleTapGaps(key.toUpperCase(), gaps);
        }
        for (let i = 0; i < raw.quadrupleTapGaps.length; i += 3) {
          const gaps = raw.quadrupleTapGaps.slice(i, i + 3);
          if (gaps.length === 3) calMgr.recordQuadrupleTapGaps(key.toUpperCase(), gaps);
        }

        const thresholds = calMgr.analyzeKey(key.toUpperCase());
        if (thresholds) {
          console.log(`[cal-analyze] CalibrationManager result for "${key}":`);
          console.log(`  confidence: ${thresholds.confidence}%`);
          console.log(`  singleTapMax: ${thresholds.singleTapMax}ms`);
          console.log(`  longPressMin: ${thresholds.longPressMin}ms, longPressMax: ${thresholds.longPressMax}ms`);
          console.log(`  superLongMin: ${thresholds.superLongMin}ms, superLongMax: ${thresholds.superLongMax}ms`);
          console.log(`  multiPressWindow: ${thresholds.multiPressWindow}ms`);
          console.log(`  sampleSize: ${thresholds.sampleSize}, outliers: ${thresholds.outlierCount}`);
          if (thresholds.reasoning) {
            console.log(`  reasoning:`);
            for (const r of thresholds.reasoning) console.log(`    - ${r}`);
          }
          return {
            singleTapMax: thresholds.singleTapMax,
            longPressMin: thresholds.longPressMin,
            longPressMax: thresholds.longPressMax,
            superLongMin: thresholds.superLongMin,
            superLongMax: thresholds.superLongMax,
            cancelThreshold: thresholds.cancelThreshold,
            multiPressWindow: thresholds.multiPressWindow,
            debounceDelay: thresholds.debounceDelay,
            confidence: thresholds.confidence,
            calibratedAt: Date.now(),
          };
        }
      } catch (err) {
        console.warn("[calibration] CalibrationManager failed:", err);
      }
    }

    // Fallback: simple statistical calculation
    const mean = (arr: number[]) =>
      arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
    const singleMean = mean(raw.singleTaps);
    const longMean = mean(raw.longHolds);
    const superMean = mean(raw.superLongHolds);

    const singleTapMax = Math.round(
      Math.max(...(raw.singleTaps.length ? raw.singleTaps : [200])) + 50,
    );
    const longPressMin = Math.round(
      Math.min(...(raw.longHolds.length ? raw.longHolds : [400])) - 50,
    );
    const longPressMax = Math.round(
      Math.max(...(raw.longHolds.length ? raw.longHolds : [800])) + 50,
    );
    const superLongMin = longPressMax + 1;
    const superLongMax = Math.round(
      Math.max(...(raw.superLongHolds.length ? raw.superLongHolds : [1200])) +
        100,
    );

    return {
      singleTapMax: Math.max(
        singleTapMax,
        longPressMin > 0 ? longPressMin - 10 : singleTapMax,
      ),
      longPressMin: Math.max(longPressMin, singleTapMax + 10),
      longPressMax,
      superLongMin,
      superLongMax,
      cancelThreshold: superLongMax + 1,
      multiPressWindow: 350,
      debounceDelay: 10,
      confidence: Math.min(
        100,
        Math.round(
          ((raw.singleTaps.length +
            raw.longHolds.length +
            raw.superLongHolds.length +
            raw.doubleTapGaps.length +
            Math.floor(raw.tripleTapGaps.length / 2) +
            Math.floor(raw.quadrupleTapGaps.length / 3)) /
            (7 * 6)) *
            100,
        ),
      ),
      calibratedAt: Date.now(),
    };
  }

  /** Save calibration results to the GUI profile */
  calibrationSave(
    profileId: string,
    calibration: Record<string, KeyCalibration>,
  ): void {
    const profiles = loadGuiProfiles();
    const profile = profiles.find((p) => p.id === profileId);
    if (!profile) {
      console.warn(`[calibration] profile ${profileId} not found`);
      return;
    }
    profile.calibration = { ...(profile.calibration ?? {}), ...calibration };
    profile.updatedAt = Date.now();
    saveGuiProfiles(profiles);
    console.log(
      `[calibration] saved calibration for ${Object.keys(calibration).length} keys to profile "${profile.name}"`,
    );
  }

  /** Stop calibration session */
  calibrationStop(): void {
    if (this.calListener?.stop) {
      this.calListener.stop();
      this.calListener = null;
    }
    this.calKey = null;
    this.calStep = null;
    this.calSamples = [];
    this.calCompletions = 0;
    this.calRawData.clear();
    console.log("[calibration] session stopped");
  }

  /** Internal: handle key events during calibration */
  private handleCalKeyEvent(rawKey: string, type: string): void {
    const key = rawKey.toUpperCase();
    const now = performance.now();

    if (this.calKey && key !== this.calKey) return;

    if (type === "down") {
      if (!this.calKeyDownTimes.has(key)) {
        this.calKeyDownTimes.set(key, now);

        // Multi-tap gap tracking
        if (
          ["double_tap", "triple_tap", "quadruple_tap"].includes(
            this.calStep ?? "",
          )
        ) {
          if (this.calLastKeyUpTime !== null) {
            const gap = now - this.calLastKeyUpTime;
            if (gap < 500) {
              this.calMultiTapGaps.push(gap);
            } else {
              this.calMultiTapGaps = [];
            }
          }
        }
      }
    } else if (type === "up") {
      const downTime = this.calKeyDownTimes.get(key);
      if (downTime !== undefined) {
        const duration = now - downTime;
        this.calKeyDownTimes.delete(key);
        this.calLastKeyUpTime = now;

        this.processCalSample(key, duration);
      }
    }
  }

  private processCalSample(key: string, duration: number): void {
    const step = this.calStep;

    if (
      step === "single_tap" ||
      step === "long_hold" ||
      step === "super_long_hold"
    ) {
      this.calSamples.push(Math.round(duration));
      this.calCompletions++;
      this.sendEvent("event:calibration-sample", {
        key,
        step,
        sampleIndex: this.calCompletions,
        value: Math.round(duration),
      });
      console.log(
        `[cal-sample] ${step} #${this.calCompletions}/${this.calSamplesNeeded}: ${Math.round(duration)}ms`,
      );
      if (this.calCompletions >= this.calSamplesNeeded && this.calResolve) {
        this.calResolve();
        this.calResolve = null;
      }
    } else if (step === "double_tap") {
      if (this.calMultiTapGaps.length >= 1) {
        const gap = Math.round(this.calMultiTapGaps[0]);
        this.calSamples.push(gap);
        this.calCompletions++;
        this.calMultiTapGaps = [];
        this.calLastKeyUpTime = null;
        this.sendEvent("event:calibration-sample", {
          key,
          step,
          sampleIndex: this.calCompletions,
          value: gap,
        });
        console.log(
          `[cal-sample] ${step} #${this.calCompletions}/${this.calSamplesNeeded}: gap=${gap}ms`,
        );
        if (this.calCompletions >= this.calSamplesNeeded && this.calResolve) {
          this.calResolve();
          this.calResolve = null;
        }
      }
    } else if (step === "triple_tap") {
      if (this.calMultiTapGaps.length >= 2) {
        const gaps = this.calMultiTapGaps.slice(0, 2).map((g) => Math.round(g));
        this.calSamples.push(...gaps);
        this.calCompletions++;
        this.calMultiTapGaps = [];
        this.calLastKeyUpTime = null;
        this.sendEvent("event:calibration-sample", {
          key,
          step,
          sampleIndex: this.calCompletions,
          value: gaps[gaps.length - 1],
        });
        console.log(
          `[cal-sample] ${step} #${this.calCompletions}/${this.calSamplesNeeded}: gaps=[${gaps.join(",")}]ms`,
        );
        if (this.calCompletions >= this.calSamplesNeeded && this.calResolve) {
          this.calResolve();
          this.calResolve = null;
        }
      }
    } else if (step === "quadruple_tap") {
      if (this.calMultiTapGaps.length >= 3) {
        const gaps = this.calMultiTapGaps.slice(0, 3).map((g) => Math.round(g));
        this.calSamples.push(...gaps);
        this.calCompletions++;
        this.calMultiTapGaps = [];
        this.calLastKeyUpTime = null;
        this.sendEvent("event:calibration-sample", {
          key,
          step,
          sampleIndex: this.calCompletions,
          value: gaps[gaps.length - 1],
        });
        console.log(
          `[cal-sample] ${step} #${this.calCompletions}/${this.calSamplesNeeded}: gaps=[${gaps.join(",")}]ms`,
        );
        if (this.calCompletions >= this.calSamplesNeeded && this.calResolve) {
          this.calResolve();
          this.calResolve = null;
        }
      }
    }
  }

  // ========================================================================
  // TIMING
  // ========================================================================

  generateTimingSamples(tier: string, count: number): number[] {
    if (this.getHumanBufferDelayFn && !this._mock) {
      try {
        const validTier = tier as "low" | "medium" | "high";
        return Array.from({ length: count }, () =>
          this.getHumanBufferDelayFn(validTier),
        );
      } catch {
        // Fall through to mock
      }
    }

    // Mock: generate random samples around tier center
    const base = tier === "low" ? 32 : tier === "medium" ? 65 : 110;
    const spread = tier === "low" ? 8 : tier === "medium" ? 12 : 20;
    return Array.from({ length: count }, () =>
      Math.round(base + (Math.random() - 0.5) * 2 * spread),
    );
  }

  getTimingStats() {
    // TimingStats are always calculated from the distribution shaping,
    // which requires runtime data. Return mock unless we have real stats.
    return { data: { ...MOCK.timingStats }, mock: this._mock };
  }

  // ========================================================================
  // TRAFFIC
  // ========================================================================

  getConflictMap() {
    if (!this.profileLoader || this._mock) {
      return { data: { ...MOCK.conflictMap }, mock: true };
    }

    try {
      const compiled = this.profileLoader.getCompiledProfile();
      if (!compiled) {
        return { data: { ...MOCK.conflictMap }, mock: true };
      }
      return {
        data: {
          activeConflicts: compiled.conflictKeys?.size ?? 0,
          rules: Array.from(compiled.conflictKeys || []).map(
            (key: unknown) => ({
              keys: [String(key)],
              type: "mutex",
              description: `Key ${String(key)} has conflicting bindings`,
            }),
          ),
        },
        mock: false,
      };
    } catch {
      return { data: { ...MOCK.conflictMap }, mock: true };
    }
  }

  getQueueStatus() {
    if (!this.getQueuePressureMonitorFn || this._mock) {
      return { data: { ...MOCK.queueStatus }, mock: true };
    }

    try {
      const monitor = this.getQueuePressureMonitorFn();
      const snapshot = monitor.getSnapshot();
      return {
        data: {
          pending: 0,
          inFlight: snapshot.outputsInWindow ?? 0,
          maxConcurrent: 3,
          totalProcessed: snapshot.outputsInWindow ?? 0,
          averageLatency: snapshot.estimatedRecoveryMs ?? 0,
          pressure:
            snapshot.currentPressure > 0.7
              ? "high"
              : snapshot.currentPressure > 0.3
                ? "medium"
                : "none",
        },
        mock: false,
      };
    } catch {
      return { data: { ...MOCK.queueStatus }, mock: true };
    }
  }

  // ========================================================================
  // SYSTEM
  // ========================================================================

  async getBackendInfo() {
    if (!this.ExecutorFactoryClass || this._mock) {
      return { data: { ...MOCK.backendInfo }, mock: true };
    }

    try {
      const backends = await this.ExecutorFactoryClass.getAvailableBackends();
      const active = backends.find(
        (b: any) => b.backend === this.currentBackend,
      );
      const available = backends.find((b: any) => b.available);

      return {
        data: {
          name: active?.backend ?? available?.backend ?? "mock",
          connected: active?.available ?? false,
          port: this.currentBackend === "teensy" ? "USB HID" : "N/A",
          firmware: "1.0.0",
          latency: this.currentBackend === "teensy" ? 1.2 : 5.0,
          capabilities: ["keyDown", "keyUp", "modifiers", "media"],
        },
        mock: false,
      };
    } catch {
      return { data: { ...MOCK.backendInfo }, mock: true };
    }
  }

  getActiveExecutions() {
    if (!this.executor || this._mock) {
      return { data: [] as any[], mock: this._mock };
    }

    const count = this.executor.getActiveExecutionCount?.() ?? 0;
    // The executor doesn't expose individual execution details,
    // so we return the count as a summary
    const executions = [];
    for (let i = 0; i < count; i++) {
      executions.push({
        id: `active-${i}`,
        gesture: "unknown",
        key: "",
        step: 0,
        totalSteps: 1,
        startedAt: Date.now(),
      });
    }
    return { data: executions, mock: false };
  }

  // ========================================================================
  // CLEANUP
  // ========================================================================

  async destroy(): Promise<void> {
    await this.stop();
    this.profileLoader = null;
    this.cooldownManager = null;
  }
}
