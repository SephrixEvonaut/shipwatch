export interface EngineStatus {
  running: boolean;
  backend: string;
  activeProfile: string;
  uptime: number;
  gesturesDetected: number;
  sequencesExecuted: number;
  activeExecutions: number;
  queueDepth: number;
  mock?: boolean;
}

export interface Profile {
  name: string;
  keys: number;
  gestures: number;
  active: boolean;
  backend: string;
}

// ─── Gesture definitions (persisted, user-managed) ───────────────
export type CalibrationStep =
  | "single_tap"
  | "long_hold"
  | "super_long_hold"
  | "double_tap"
  | "triple_tap"
  | "quadruple_tap";

export interface GestureDefinition {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  category: "tap" | "hold" | "toggle" | "multi-tap";
  calibrationSteps: CalibrationStep[];
}

// ─── GUI Profile types (persisted to disk) ───────────────────────
export type GestureType = string;

export interface Binding {
  key: string;
  gesture: GestureType;
  output: string;
  label: string;
}

export interface ProfileDef {
  id: string;
  name: string;
  description: string;
  active: boolean;
  inputKeys: string[];
  outputKeys: string[];
  bindings: Binding[];
  calibration?: Record<string, KeyCalibration>;
  createdAt: number;
  updatedAt: number;
}

export interface CalibrationData {
  key: string;
  samples: number[];
  mean: number;
  stdDev: number;
  threshold: number;
  confidence: number;
  calibratedAt: number;
}

export interface KeyCalibration {
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

export interface CalibrationSampleEvent {
  key: string;
  step: string;
  sampleIndex: number;
  value: number;
}

export interface CollectResult {
  samples: number[];
  stats: { mean: number; stdDev: number; min: number; max: number };
}

export interface TimingStats {
  totalSamples: number;
  tiers: Record<
    string,
    { mean: number; stdDev: number; min: number; max: number; samples: number }
  >;
}

export interface ConflictMap {
  activeConflicts: number;
  rules: Array<{ keys: string[]; type: string; description: string }>;
}

export interface QueueStatus {
  pending: number;
  inFlight: number;
  maxConcurrent: number;
  totalProcessed: number;
  averageLatency: number;
  pressure: string;
}

export interface BackendInfo {
  name: string;
  connected: boolean;
  port: string;
  firmware: string;
  latency: number;
  capabilities: string[];
}

export interface ExecutionInfo {
  id: string;
  gesture: string;
  key: string;
  step: number;
  totalSteps: number;
  startedAt: number;
}

export interface KeyEvent {
  key: string;
  type: "down" | "up";
  timestamp: number;
}

export interface GestureEvent {
  key: string;
  gesture: string;
  timestamp: number;
  binding?: { name: string; output: string[] } | null;
}

export interface ElectronAPI {
  startEngine(profileKey: string): Promise<{ status: string }>;
  stopEngine(): Promise<{ status: string }>;
  getEngineStatus(): Promise<EngineStatus>;
  onKeyEvent(callback: (data: KeyEvent) => void): () => void;
  onGestureEvent(callback: (data: GestureEvent) => void): () => void;
  onExecutionEvent(callback: (data: ExecutionInfo) => void): () => void;
  onTrafficEvent(callback: (data: unknown) => void): () => void;
  getProfiles(): Promise<Profile[]>;
  getActiveProfile(): Promise<Profile>;
  createProfile(profile: Partial<Profile>): Promise<void>;
  deleteProfile(name: string): Promise<void>;
  setActiveProfile(name: string): Promise<void>;

  // Persisted GUI profiles
  listGuiProfiles(): Promise<ProfileDef[]>;
  saveGuiProfile(profile: ProfileDef): Promise<void>;
  deleteGuiProfile(id: string): Promise<void>;
  getThresholds(): Promise<Record<string, number>>;
  getCalibrationData(key: string): Promise<CalibrationData>;
  startCalibration(keys: string[]): Promise<void>;

  // GUI calibration wizard
  calibrationSessionStart(
    keys: string[],
    profileId: string,
  ): Promise<{ status: string }>;
  calibrationCollect(
    key: string,
    step: string,
    samplesNeeded: number,
  ): Promise<CollectResult>;
  calibrationAnalyze(key: string): Promise<KeyCalibration | null>;
  calibrationSave(
    profileId: string,
    calibration: Record<string, KeyCalibration>,
  ): Promise<void>;
  calibrationStop(): Promise<void>;
  getProfileCalibration(): Promise<Record<string, KeyCalibration> | null>;
  onCalibrationSample(callback: (data: CalibrationSampleEvent) => void): () => void;
  generateTimingSamples(tier: string, count: number): Promise<number[]>;
  getTimingStats(): Promise<TimingStats>;
  getConflictMap(): Promise<ConflictMap>;
  getQueueStatus(): Promise<QueueStatus>;
  getBackendInfo(): Promise<BackendInfo>;
  getActiveExecutions(): Promise<ExecutionInfo[]>;
  removeAllListeners(): void;

  // Gesture definitions
  listGestureDefinitions(): Promise<GestureDefinition[]>;
  saveGestureDefinitions(defs: GestureDefinition[]): Promise<void>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
